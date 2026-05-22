import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, decodeFunctionData, parseUnits, fallback } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { supabase } from '../../../lib/supabase';
import { sendTelegramNotification } from '../../../lib/telegram';

// 🚀 UPDATED: New Contract Address
const CONTRACT_ADDRESS = '0x038be2c568f20a69931EE4082B424e5a68dB8089';
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY; 

const celoTransports = fallback([
  http('https://forno.celo.org'),
  http('https://rpc.celo-community.org'),
  http('https://1rpc.io/celo'),
  http('https://celo.drpc.org')
]);

const TOKENS = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': 18, // cUSD
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': 6,  // USDC
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': 6   // USDT
};

const REQUEST_ABI = [{
  "name": "requestService",
  "type": "function",
  "stateMutability": "nonpayable",
  "inputs": [
    { "name": "token", "type": "address" },
    { "name": "amount", "type": "uint256" },
    { "name": "prompt", "type": "string" },
    { "name": "serviceType", "type": "string" }
  ]
}];

const DELIVERY_ABI = [{
  "name": "deliverResult",
  "type": "function",
  "stateMutability": "nonpayable",
  "inputs": [
    { "name": "user", "type": "address" },
    { "name": "result", "type": "string" }
  ]
}];

export async function POST(req) {
  let globalTxHash = null;

  try {
    const { prompt, txHash } = await req.json();
    if (!prompt || !txHash) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    globalTxHash = txHash;
    const publicClient = createPublicClient({ chain: celo, transport: celoTransports });

    // 1. Verify Transaction
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success' || receipt.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
      return NextResponse.json({ error: "Invalid transaction" }, { status: 403 });
    }

    const transaction = await publicClient.getTransaction({ hash: txHash });
    const { args } = decodeFunctionData({ abi: REQUEST_ABI, data: transaction.input });
    const [paidToken, paidAmount, , paidServiceType] = args;

    const decimals = TOKENS[paidToken.toLowerCase()];
    if (!decimals || paidAmount < parseUnits('0.10', decimals) || paidServiceType !== 'IMAGE') {
      return NextResponse.json({ error: "Invalid payment or routing" }, { status: 403 });
    }

    const userAddress = receipt.from;

    // 2. Log to DB
    const { data: existingTx } = await supabase.from('transactions').select('*').eq('tx_hash', txHash).single();
    if (!existingTx) {
      await supabase.from('transactions').insert([{
        tx_hash: txHash, 
        prompt: prompt, 
        service_type: 'IMAGE', 
        status: 'PENDING', 
        user_address: userAddress.toLowerCase(),
        token_address: paidToken.toLowerCase()
      }]);
    }

    // 3. ENTERPRISE AI GENERATION
    const togetherApiKey = process.env.TOGETHER_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    let enhancedPrompt = prompt; 
    try {
        const analyzeResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Act as a master Flux prompt engineer. Transform this: "${prompt}" into a detailed image generation prompt. Output ONLY the prompt.` }] }]
            })
        });
        if (analyzeResponse.ok) {
            const analyzeData = await analyzeResponse.json();
            enhancedPrompt = analyzeData.candidates?.[0]?.content?.parts?.[0]?.text.trim() || prompt;
        }
    } catch (e) { console.warn("Analyzer skipped"); }

    const aiResponse = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${togetherApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell",
        prompt: enhancedPrompt, 
        width: 1024, height: 1024, steps: 4, n: 1, response_format: "url"
      })
    });

    if (!aiResponse.ok) throw new Error("Together API Error");
    const aiData = await aiResponse.json();
    const temporaryImageUrl = aiData.data[0].url;

    // 4. STORAGE & DELIVERY
    let permanentImageUrl = temporaryImageUrl;
    try {
        const imgRes = await fetch(temporaryImageUrl);
        const imgBuffer = await imgRes.arrayBuffer();
        const fileName = `img_${Date.now()}_${txHash.substring(0, 6)}.png`;
        await supabase.storage.from('vault').upload(fileName, imgBuffer, { contentType: 'image/png' });
        const { data } = supabase.storage.from('vault').getPublicUrl(fileName);
        permanentImageUrl = data.publicUrl;
    } catch (e) { console.error("Storage error:", e); }

    await supabase.from('transactions').update({ status: 'COMPLETED', result_data: permanentImageUrl }).eq('tx_hash', txHash);

    (async () => {
      try {
        const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
        const agentClient = createWalletClient({ account, chain: celo, transport: celoTransports });
        await agentClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: DELIVERY_ABI,
          functionName: 'deliverResult',
          args: [userAddress, `Image ready: ${permanentImageUrl.substring(0, 30)}...`]
        });
        await sendTelegramNotification(`✅ *Premium Image Delivered*`);
      } catch (err) { console.error("Delivery failed:", err); }
    })();

    return NextResponse.json({ imageUrl: permanentImageUrl });
  } catch (error) {
    console.error("Image API Error:", error);
    if (globalTxHash) await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', globalTxHash);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

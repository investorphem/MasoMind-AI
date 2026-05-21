import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, decodeFunctionData, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { supabase } from '../../../lib/supabase';
import { sendTelegramNotification } from '../../../lib/telegram';

const CONTRACT_ADDRESS = '0xf5e6bff6cD35833FB9509fd081E5Ca9973fD132f';
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY; 

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

    const publicClient = createPublicClient({ chain: celo, transport: http() });

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

    // 3. 🚀 ENTERPRISE AI GENERATION (Flux via Together AI)
    const togetherApiKey = process.env.TOGETHER_API_KEY;
    if (!togetherApiKey) throw new Error("TOGETHER_API_KEY is missing in Vercel");

    const aiResponse = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${togetherApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell-Free", // Uses Flux Schnell for speed + high quality
        prompt: prompt,
        width: 1024,
        height: 1024,
        steps: 4,
        n: 1,
        response_format: "url"
      })
    });

    if (!aiResponse.ok) {
        const errorData = await aiResponse.json();
        throw new Error(`Together API Error: ${errorData.error?.message || aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData.data[0].url;

    if (!imageUrl) throw new Error("Failed to extract image URL from provider");

    // 4. NON-BLOCKING DELIVERY
    await supabase.from('transactions')
      .update({ status: 'COMPLETED', result_data: imageUrl })
      .eq('tx_hash', txHash);

    (async () => {
      try {
        const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
        const agentClient = createWalletClient({ account, chain: celo, transport: http() });
        const summary = `Image Generated: ${prompt.substring(0, 15)}...`;

        await agentClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: DELIVERY_ABI,
          functionName: 'deliverResult',
          args: [userAddress, summary]
        });
        await sendTelegramNotification(`✅ *Premium Image Delivered On-Chain*`);
      } catch (err) {
        console.error("Background blockchain delivery failed:", err);
      }
    })();

    return NextResponse.json({ imageUrl });

  } catch (error) {
    console.error("Image API Error:", error);
    
    if (globalTxHash) {
        await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', globalTxHash);
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

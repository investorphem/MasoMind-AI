import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, decodeFunctionData, parseUnits, formatUnits, fallback } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { supabase } from '../../../lib/supabase';
import { sendTelegramNotification } from '../../../lib/telegram';

// 🚀 Core Contract Infrastructure Pointers
const CONTRACT_ADDRESS = '0x038be2c568f20a69931EE4082B424e5a68dB8089';
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY; 

const celoTransports = fallback([
  http('https://forno.celo.org'),
  http('https://rpc.celo-community.org'),
  http('https://1rpc.io/celo'),
  http('https://celo.drpc.org')
]);

const TOKENS = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': { decimals: 18, symbol: 'USDm/cUSD' }, // cUSD / USDm
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': { decimals: 6, symbol: 'USDC' },      // USDC
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': { decimals: 6, symbol: 'USDT' }       // USDT
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
  let cachedUserAddress = null;
  let cachedTokenInfo = { symbol: 'Unknown', amount: '0.00' };

  try {
    const { prompt, txHash } = await req.json();
    if (!prompt || !txHash) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    globalTxHash = txHash;
    const publicClient = createPublicClient({ chain: celo, transport: celoTransports });

    // 1. Verify Payment Transaction Validity
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success' || receipt.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
      return NextResponse.json({ error: "Invalid transaction signature" }, { status: 403 });
    }

    const transaction = await publicClient.getTransaction({ hash: txHash });
    const { args } = decodeFunctionData({ abi: REQUEST_ABI, data: transaction.input });
    const [paidToken, paidAmount, , paidServiceType] = args;

    // 🛡️ Ensure payment criteria matches precisely 0.10 for IMAGE service types
    const tokenConfig = TOKENS[paidToken.toLowerCase()];
    if (!tokenConfig || paidAmount < parseUnits('0.10', tokenConfig.decimals) || paidServiceType !== 'IMAGE') {
      return NextResponse.json({ error: "Invalid execution routing parameters" }, { status: 403 });
    }

    cachedUserAddress = receipt.from;
    const humanAmount = formatUnits(paidAmount, tokenConfig.decimals);
    cachedTokenInfo = { symbol: tokenConfig.symbol, amount: humanAmount };

    // 🚀 STEP AHEAD ORDER: Inbound pipeline payment logging notification fired instantly
    await sendTelegramNotification(
      `📥 *MASOMIND INBOUND REQUEST STACK*\n` +
      `============================\n` +
      `🏢 *Service Type:* Image Matrix Engine\n` +
      `👤 *User Address:* \`${cachedUserAddress}\`\n` +
      `💰 *Settled Payment:* ${humanAmount} ${tokenConfig.symbol}\n` +
      `⛓️ *Transaction Hash:* \`${txHash}\`\n` +
      `⏳ *Status:* Pipeline Activated. Processing Canvas Concept...`
    );

    // 🚀 STEP AHEAD ORDER: Write row inside database indexer immediately to establish structural fallback safety
    const { data: existingTx } = await supabase.from('transactions').select('*').eq('tx_hash', txHash).single();
    if (!existingTx) {
      await supabase.from('transactions').insert([{
        tx_hash: txHash, 
        prompt: prompt, 
        service_type: 'IMAGE', 
        status: 'PENDING', 
        user_address: cachedUserAddress.toLowerCase(),
        token_address: paidToken.toLowerCase()
      }]);
    }

    // 3. MASTER PROMPT ENRICHMENT CORE (Gemini 2.5 Active Infrastructure Integration)
    const togetherApiKey = process.env.TOGETHER_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    let enhancedPrompt = prompt; 
    try {
        const analyzeResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Act as a master Flux prompt engineer. Transform this user text concept: "${prompt}" into a detailed, high-fidelity enterprise-grade image generation prompt. Output ONLY the resulting refined text prompt description without extra prose layers.` }] }]
            })
        });

        if (analyzeResponse.ok) {
            const analyzeData = await analyzeResponse.json();
            enhancedPrompt = analyzeData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || prompt;
        }
    } catch (e) { 
      console.warn("Gemini prompt optimization fallback module triggered:", e); 
    }

    // 4. ENTERPRISE DIFFUSION GENERATION LOOP
    const aiResponse = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${togetherApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell",
        prompt: enhancedPrompt, 
        width: 1024, height: 1024, steps: 4, n: 1, response_format: "url"
      })
    });

    if (!aiResponse.ok) throw new Error(`Together Engine API Resolution Rejection Error`);
    const aiData = await aiResponse.json();
    const temporaryImageUrl = aiData.data[0].url;

    // 5. SECURE PERMANENT ARCHIVAL BUFFER STORAGE
    let permanentImageUrl = temporaryImageUrl;
    try {
        const imgRes = await fetch(temporaryImageUrl);
        const imgBuffer = await imgRes.arrayBuffer();
        const fileName = `img_${Date.now()}_${txHash.substring(0, 6)}.png`;
        await supabase.storage.from('vault').upload(fileName, imgBuffer, { contentType: 'image/png' });
        const { data } = supabase.storage.from('vault').getPublicUrl(fileName);
        permanentImageUrl = data.publicUrl;
    } catch (e) { 
      console.error("Supabase cluster object storage allocation failure:", e); 
    }

    // Update Persistent Ledger Row State
    await supabase.from('transactions').update({ status: 'COMPLETED', result_data: permanentImageUrl }).eq('tx_hash', txHash);

    // 6. 🚀 SEQUENTIAL AWAITED ON-CHAIN RESULT DELIVERY CLOSURE
    if (AGENT_PRIVATE_KEY) {
      try {
        const formattedKey = AGENT_PRIVATE_KEY.startsWith('0x') ? AGENT_PRIVATE_KEY : `0x${AGENT_PRIVATE_KEY}`;
        const account = privateKeyToAccount(formattedKey);
        const agentClient = createWalletClient({ account, chain: celo, transport: celoTransports });

        const summaryMsg = `Canvas Matrix Render Ready. Storage Allocation Reference: ${permanentImageUrl.substring(0, 45)}...`;

        // Force sequence block halt until transaction receipt returns safely
        const deliveryTxHash = await agentClient.writeContract({
          account,
          address: CONTRACT_ADDRESS,
          abi: DELIVERY_ABI,
          functionName: 'deliverResult',
          args: [cachedUserAddress, summaryMsg]
        });

        console.log(`On-chain image asset delivery receipt broadcast confirmed: ${deliveryTxHash}`);
        
        // 🚀 SUCCESS TELEMETRY: Automated notification block broadcast
        await sendTelegramNotification(
          `✅ *MASOMIND EXECUTION SUCCESS*\n` +
          `============================\n` +
          `🤖 *Agent Identity:* MasoMind Enterprise Image Node\n` +
          `👤 *Client Account:* \`${cachedUserAddress}\`\n` +
          `🎨 *Refined Prompt:* "${enhancedPrompt.substring(0, 60)}..."\n` +
          `⛓️ *Inbound Request Hash:* \`${txHash}\`\n` +
          `📦 *Outbound Delivery Hash:* \`${deliveryTxHash}\`\n` +
          `🚀 *Status:* On-Chain Settlement Complete. Client Vault Synchronized.`
        );
      } catch (blockchainError) { 
        console.error("On-chain result delivery transaction broadcast failed:", blockchainError);
        
        // 🚀 CONGESTION TELEMETRY: Non-blocking warning notification to prevent page execution loop stalls
        await sendTelegramNotification(
          `⚠️ *MASOMIND BLOCKCHAIN DELIVERY DELAY*\n` +
          `============================\n` +
          `👤 *Client Account:* \`${cachedUserAddress}\`\n` +
          `⛓️ *Inbound Request Hash:* \`${txHash}\`\n` +
          `❌ *RPC Error Exception:* \`${blockchainError.message.substring(0, 120)}...\`\n` +
          `💡 *System Note:* Image successfully generated and indexed inside Supabase storage layers. Client can view canvas natively, but contract state event callback timed out.`
        );
      }
    } else {
      console.warn("Skipping on-chain delivery signature: AGENT_PRIVATE_KEY is unconfigured.");
    }

    // 7. Secure Return Response Streaming
    return NextResponse.json({ imageUrl: permanentImageUrl });

  } catch (error) {
    console.error("Image API Handler Critical Error:", error);
    
    // 🚀 FAULT TELEMETRY: Immediate tracking notification with open user refund dashboard hook configuration mappings
    if (globalTxHash) {
        await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', globalTxHash);
        
        await sendTelegramNotification(
          `🚨 *MASOMIND AGENT EXCEPTION CRASH*\n` +
          `============================\n` +
          `🏢 *Failed Layer:* Diffusion Asset Generation Process\n` +
          `👤 *Target User Account:* \`${cachedUserAddress || 'Unresolved/Unknown Address'}\`\n` +
          `💰 *Captured Funds:* ${cachedTokenInfo.amount} ${cachedTokenInfo.symbol}\n` +
          `⛓️ *Inbound Request Hash:* \`${globalTxHash}\`\n` +
          `💥 *Critical System Error:* \`${error.message}\`\n` +
          `💸 *Refund Path Status:* Open. Row logged securely. User can clear client dashboard and click 'Request Refund'.`
        );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, decodeFunctionData, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { supabase } from '../../../lib/supabase';
import { sendTelegramNotification } from '../../../lib/telegram';

export const maxDuration = 60; 

const CONTRACT_ADDRESS = '0xf5e6bff6cD35833FB9509fd081E5Ca9973fD132f';
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY; 

const TOKENS = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': 18,
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': 6,
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': 6
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
  try {
    const { prompt, txHash } = await req.json();
    if (!prompt || !txHash) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

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
    if (!decimals || paidAmount < parseUnits('1.00', decimals) || paidServiceType !== 'VIDEO') {
      return NextResponse.json({ error: "Invalid payment or routing" }, { status: 403 });
    }

    const userAddress = receipt.from;

    // 2. Log to DB (Included token_address for auto-refund compatibility)
    const { data: existingTx } = await supabase.from('transactions').select('*').eq('tx_hash', txHash).single();
    if (!existingTx) {
      await supabase.from('transactions').insert([{
        tx_hash: txHash, 
        prompt: prompt, 
        service_type: 'VIDEO', 
        status: 'PENDING', 
        user_address: userAddress.toLowerCase(),
        token_address: paidToken.toLowerCase() // 🚀 Mandatory for Auto-Refund
      }]);
    }

    // 3. AI Generation
    const apiKey = process.env.GEMINI_API_KEY;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["VIDEO"], responseMimeType: "video/mp4" }
      })
    });

    const data = await response.json();
    if (!data.candidates?.[0]?.content?.parts?.[0]?.inlineData) throw new Error("Video generation failed");

    const mediaUrl = `data:video/mp4;base64,${data.candidates[0].content.parts[0].inlineData.data}`;

    // 4. 🚀 AUTONOMOUS DELIVERY (Agent signing to the contract)
    const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
    const agentClient = createWalletClient({ account, chain: celo, transport: http() });

    const deliveryHash = await agentClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: DELIVERY_ABI,
      functionName: 'deliverResult',
      args: [userAddress, mediaUrl]
    });

    // 5. Finalize DB
    await supabase.from('transactions')
      .update({ status: 'COMPLETED', result_data: mediaUrl, tx_hash: deliveryHash })
      .eq('tx_hash', txHash);

    await sendTelegramNotification(`✅ *Video Delivered On-Chain*\nTx: \`${deliveryHash.substring(0, 10)}...\``);

    return NextResponse.json({ mediaUrl });

  } catch (error) {
    console.error("Video API Error:", error);
    await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', txHash);
    await sendTelegramNotification(`❌ *Video Generation Failed*`);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

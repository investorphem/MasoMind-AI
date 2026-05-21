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
        token_address: paidToken.toLowerCase()
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

    // Explicitly catch Google API errors (like Quota Exceeded)
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Google API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    if (!data.candidates?.[0]?.content?.parts?.[0]?.inlineData) throw new Error("Video generation failed to return media data");

    const mediaUrl = `data:video/mp4;base64,${data.candidates[0].content.parts[0].inlineData.data}`;

    // 4. NON-BLOCKING DELIVERY
    // Save the video to the DB immediately and mark COMPLETED
    await supabase.from('transactions')
      .update({ status: 'COMPLETED', result_data: mediaUrl })
      .eq('tx_hash', txHash);

    // Run Blockchain delivery in the background
    (async () => {
      try {
        const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
        const agentClient = createWalletClient({ account, chain: celo, transport: http() });
        
        // Blockchain cannot handle massive base64 strings. Send a summary instead.
        const summary = `Video Generated: ${prompt.substring(0, 15)}...`;

        await agentClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: DELIVERY_ABI,
          functionName: 'deliverResult',
          args: [userAddress, summary]
        });
        
        await sendTelegramNotification(`✅ *Video Delivered On-Chain*`);
      } catch (err) {
        console.error("Background blockchain delivery failed:", err);
      }
    })();

    // Return the video immediately to the UI
    return NextResponse.json({ mediaUrl });

  } catch (error) {
    console.error("Video API Error:", error);
    
    // Ensure the database registers the failure so the user can request a refund
    await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', txHash);
    
    // Return the actual error message so your UI knows what happened
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

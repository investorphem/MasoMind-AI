import { NextResponse } from 'next/server';
import { createPublicClient, http, decodeFunctionData, parseUnits } from 'viem';
import { celo } from 'viem/chains';
import { supabase } from '../../../lib/supabase';

// Extend Vercel timeout for media generation
export const maxDuration = 60; 

const CONTRACT_ADDRESS = '0x1d7c2c4c5e41dcdbe90b03d71399383dd1464717';
const TOKENS = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': 18,
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': 6,
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': 6
};

const ABI = [{
  "name": "executeService",
  "type": "function",
  "stateMutability": "nonpayable",
  "inputs": [
    { "name": "token", "type": "address" },
    { "name": "amount", "type": "uint256" },
    { "name": "prompt", "type": "string" },
    { "name": "serviceType", "type": "string" }
  ]
}];

export async function POST(req) {
  try {
    const { prompt, txHash } = await req.json();

    if (!prompt || !txHash) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    const { data: existingTx } = await supabase.from('transactions').select('status').eq('tx_hash', txHash).single();
    if (existingTx && existingTx.status === 'COMPLETED') return NextResponse.json({ error: "Replay attack blocked." }, { status: 403 });

    let userAddress = '';
    const publicClient = createPublicClient({ chain: celo, transport: http() });

    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success' || receipt.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
        return NextResponse.json({ error: "Invalid transaction" }, { status: 403 });
      }

      userAddress = receipt.from;
      const transaction = await publicClient.getTransaction({ hash: txHash });
      const { args } = decodeFunctionData({ abi: ABI, data: transaction.input });
      const [paidToken, paidAmount, paidPrompt, paidServiceType] = args;

      const decimals = TOKENS[paidToken.toLowerCase()];
      if (!decimals) return NextResponse.json({ error: "Unsupported stablecoin" }, { status: 403 });

      // MUSIC requires 0.50 stablecoins
      const expectedAmount = parseUnits('0.50', decimals); 
      if (paidAmount < expectedAmount) return NextResponse.json({ error: "Insufficient payment" }, { status: 403 });
      if (paidServiceType !== 'MUSIC') return NextResponse.json({ error: "Invalid routing" }, { status: 403 });

    } catch (err) {
      return NextResponse.json({ error: "Verification failed" }, { status: 403 });
    }

    if (!existingTx) {
      await supabase.from('transactions').insert([{
        tx_hash: txHash, prompt: prompt, service_type: 'MUSIC', status: 'PENDING', user_address: userAddress.toLowerCase()
      }]);
    }

    // GENERATE LYRIA 3 AUDIO
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/lyria-3-clip-preview:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
             responseModalities: ["AUDIO"],
             responseMimeType: "audio/mp3" 
          }
        })
      });

      const data = await response.json();
      
      let mediaUrl = '';
      if (data.candidates && data.candidates[0].content.parts[0].inlineData) {
         const base64Audio = data.candidates[0].content.parts[0].inlineData.data;
         // Format as a data URI so the frontend <audio> tag can play it instantly
         mediaUrl = `data:audio/mp3;base64,${base64Audio}`;
      } else {
         throw new Error("API limits reached or invalid generation");
      }

      await supabase.from('transactions').update({ status: 'COMPLETED' }).eq('tx_hash', txHash);
      return NextResponse.json({ mediaUrl });

    } catch (aiError) {
      await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', txHash);
      throw aiError; 
    }

  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

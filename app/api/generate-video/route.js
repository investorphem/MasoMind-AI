import { NextResponse } from 'next/server';
import { createPublicClient, http, decodeFunctionData, parseUnits } from 'viem';
import { celo } from 'viem/chains';
import { supabase } from '../../../lib/supabase';

// Extend Vercel timeout for media generation
export const maxDuration = 60; 

// UPDATE: Point to your new V2 Contract Address
const CONTRACT_ADDRESS = '0xf5e6bff6cD35833FB9509fd081E5Ca9973fD132f';

const TOKENS = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': 18,
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': 6,
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': 6
};

// UPDATE: ABI function name changed to requestService
const ABI = [{
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

      // VIDEO requires 1.00 stablecoins
      const expectedAmount = parseUnits('1.00', decimals); 
      if (paidAmount < expectedAmount) return NextResponse.json({ error: "Insufficient payment" }, { status: 403 });
      if (paidServiceType !== 'VIDEO') return NextResponse.json({ error: "Invalid routing" }, { status: 403 });

    } catch (err) {
      console.error("Blockchain verification error:", err);
      return NextResponse.json({ error: "Verification failed" }, { status: 403 });
    }

    if (!existingTx) {
      await supabase.from('transactions').insert([{
        tx_hash: txHash, prompt: prompt, service_type: 'VIDEO', status: 'PENDING', user_address: userAddress.toLowerCase()
      }]);
    }

    // GENERATE VEO VIDEO
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
             responseModalities: ["VIDEO"],
             responseMimeType: "video/mp4" 
          }
        })
      });

      const data = await response.json();

      let mediaUrl = '';
      if (data.candidates && data.candidates[0].content.parts[0].inlineData) {
         const base64Video = data.candidates[0].content.parts[0].inlineData.data;
         mediaUrl = `data:video/mp4;base64,${base64Video}`;
      } else {
         throw new Error("API limits reached or invalid generation");
      }

      await supabase.from('transactions').update({ 
        status: 'COMPLETED',
        result_data: mediaUrl
      }).eq('tx_hash', txHash);

      return NextResponse.json({ mediaUrl });

    } catch (aiError) {
      await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', txHash);
      throw aiError; 
    }

  } catch (error) {
    console.error("Video API Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

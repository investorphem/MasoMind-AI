import { NextResponse } from 'next/server';
import { createPublicClient, http, decodeFunctionData, parseUnits } from 'viem';
import { celo } from 'viem/chains';
import { supabase } from '../../../lib/supabase'; // Import your DB client

// IMPORTANT: Your live V2 Contract Address!
const CONTRACT_ADDRESS = '0x1d7c2c4c5e41dcdbe90b03d71399383dd1464717';

// Strict token registry to verify the exact token decimals (pre-lowercased)
const TOKENS = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': 18, // cUSD
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': 6,  // USDC
  '0x48065fbbe25f71c9282ddf5e1cd6d6a88248a566': 6   // USDT
};

// The ABI for the exact function we are analyzing
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

    // Block any request that doesn't include the blockchain receipt
    if (!prompt || !txHash) {
      return NextResponse.json({ error: "Missing required parameters (prompt or txHash)" }, { status: 400 });
    }

    // ==========================================
    // 1. SUPABASE REPLAY-ATTACK CHECK
    // ==========================================
    const { data: existingTx, error: dbError } = await supabase
      .from('transactions')
      .select('status')
      .eq('tx_hash', txHash)
      .single();

    if (existingTx) {
      if (existingTx.status === 'COMPLETED') {
        return NextResponse.json({ error: "Transaction already consumed. Replay attack blocked." }, { status: 403 });
      }
      // If status is PENDING or FAILED, we allow the script to continue to retry the generation!
    }

    // ==========================================
    // 2. BLOCKCHAIN VERIFICATION
    // ==========================================
    const publicClient = createPublicClient({ chain: celo, transport: http() });

    try {
      // Verify the transaction was successful and sent to your company's contract
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success' || receipt.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
        return NextResponse.json({ error: "Invalid or failed transaction" }, { status: 403 });
      }

      // Fetch the raw transaction data to interrogate the payload
      const transaction = await publicClient.getTransaction({ hash: txHash });

      // Decode the exact arguments the user passed to the smart contract
      const { args } = decodeFunctionData({
        abi: ABI,
        data: transaction.input,
      });

      const [paidToken, paidAmount, paidPrompt, paidServiceType] = args;

      // THE VAULT: Perform strict validation on the decoded data
      const decimals = TOKENS[paidToken.toLowerCase()];
      if (!decimals) {
        return NextResponse.json({ error: "Unsupported stablecoin used" }, { status: 403 });
      }

      // Set the exact price required for Image Generation
      const expectedAmount = parseUnits('0.10', decimals); 

      if (paidAmount < expectedAmount) {
         return NextResponse.json({ error: "Insufficient payment amount detected" }, { status: 403 });
      }

      if (paidServiceType !== 'IMAGE') {
         return NextResponse.json({ error: "Payment was not routed for image generation" }, { status: 403 });
      }

    } catch (err) {
      console.error("Blockchain verification error:", err);
      return NextResponse.json({ error: "Transaction verification failed" }, { status: 403 });
    }

    // ==========================================
    // 3. LOCK TRANSACTION AS PENDING
    // ==========================================
    if (!existingTx) {
      await supabase.from('transactions').insert([{
        tx_hash: txHash,
        prompt: prompt,
        service_type: 'IMAGE',
        status: 'PENDING'
      }]);
    }

    // ==========================================
    // 4. GENERATE AI ASSET
    // ==========================================
    try {
      const randomSeed = Math.floor(Math.random() * 1000000);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${randomSeed}`;

      // Mark as COMPLETED in the vault
      await supabase.from('transactions')
        .update({ status: 'COMPLETED' })
        .eq('tx_hash', txHash);

      return NextResponse.json({ imageUrl });

    } catch (aiError) {
      // Mark as FAILED so the frontend auto-recovery can try again later
      await supabase.from('transactions')
        .update({ status: 'FAILED' })
        .eq('tx_hash', txHash);
        
      throw aiError; // Trigger the main catch block
    }

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

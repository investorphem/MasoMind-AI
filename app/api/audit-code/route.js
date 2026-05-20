import { NextResponse } from 'next/server';
import { createPublicClient, http, decodeFunctionData, parseUnits } from 'viem';
import { celo } from 'viem/chains';
import { supabase } from '../../../lib/supabase'; // Import your DB client

// UPDATE: Point to your new V2 Contract Address
const CONTRACT_ADDRESS = '0xf5e6bff6cD35833FB9509fd081E5Ca9973fD132f';

// Strict token registry to verify the exact token decimals (pre-lowercased)
const TOKENS = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': 18, // cUSD
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': 6,  // USDC
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': 6   // USDT
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

    if (!prompt || !txHash) {
      return NextResponse.json({ error: "Missing required parameters (prompt or txHash)" }, { status: 400 });
    }

    // ==========================================
    // 1. SUPABASE REPLAY-ATTACK CHECK
    // ==========================================
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('status')
      .eq('tx_hash', txHash)
      .single();

    if (existingTx && existingTx.status === 'COMPLETED') {
      return NextResponse.json({ error: "Transaction already consumed. Replay attack blocked." }, { status: 403 });
    }

    let userAddress = '';

    // ==========================================
    // 2. BLOCKCHAIN VERIFICATION
    // ==========================================
    const publicClient = createPublicClient({ chain: celo, transport: http() });

    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success' || receipt.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
        return NextResponse.json({ error: "Invalid or failed transaction" }, { status: 403 });
      }

      userAddress = receipt.from;
      const transaction = await publicClient.getTransaction({ hash: txHash });

      const { args } = decodeFunctionData({
        abi: ABI,
        data: transaction.input,
      });

      const [paidToken, paidAmount, paidPrompt, paidServiceType] = args;

      const decimals = TOKENS[paidToken.toLowerCase()];
      if (!decimals) {
        return NextResponse.json({ error: "Unsupported stablecoin used" }, { status: 403 });
      }

      const expectedAmount = parseUnits('0.05', decimals); 

      if (paidAmount < expectedAmount) {
         return NextResponse.json({ error: "Insufficient payment amount detected" }, { status: 403 });
      }

      if (paidServiceType !== 'AUDIT') {
         return NextResponse.json({ error: "Payment was not routed for a code audit" }, { status: 403 });
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
        service_type: 'AUDIT',
        status: 'PENDING',
        user_address: userAddress.toLowerCase()
      }]);
    }

    // ==========================================
    // 4. GENERATE AI AUDIT REPORT
    // ==========================================
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const currentDate = new Date().toISOString().split('T')[0];
      const promptText = `You are an expert Web3 Smart Contract Auditor. Today's date is ${currentDate}. Analyze the following code for vulnerabilities, reentrancy risks, gas optimizations, and syntax errors. Provide a concise, highly professional markdown report. Code:\n\n${prompt}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });

      const data = await response.json();
      const auditReport = data.candidates[0].content.parts[0].text;

      await supabase.from('transactions')
        .update({ 
          status: 'COMPLETED',
          result_data: auditReport
        })
        .eq('tx_hash', txHash);

      return NextResponse.json({ report: auditReport });

    } catch (aiError) {
      await supabase.from('transactions')
        .update({ status: 'FAILED' })
        .eq('tx_hash', txHash);
      throw aiError;
    }

  } catch (error) {
    console.error("Audit API Error:", error);
    return NextResponse.json({ error: "Failed to process audit" }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createPublicClient, http, decodeFunctionData, parseUnits } from 'viem';
import { celo } from 'viem/chains';
import { supabase } from '../../../lib/supabase';
import { sendTelegramNotification } from '../../../lib/telegram'; // Ensure this utility exists

const CONTRACT_ADDRESS = '0xf5e6bff6cD35833FB9509fd081E5Ca9973fD132f';

const TOKENS = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': 18,
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': 6,
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': 6
};

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
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const { data: existingTx } = await supabase
      .from('transactions')
      .select('status')
      .eq('tx_hash', txHash)
      .single();

    if (existingTx && existingTx.status === 'COMPLETED') {
      return NextResponse.json({ error: "Transaction already consumed." }, { status: 403 });
    }

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
      if (!decimals || paidAmount < parseUnits('0.05', decimals) || paidServiceType !== 'AUDIT') {
        return NextResponse.json({ error: "Invalid payment or routing" }, { status: 403 });
      }
    } catch (err) {
      return NextResponse.json({ error: "Verification failed" }, { status: 403 });
    }

    if (!existingTx) {
      await supabase.from('transactions').insert([{
        tx_hash: txHash, prompt: prompt, service_type: 'AUDIT', status: 'PENDING', user_address: userAddress.toLowerCase()
      }]);
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const promptText = `Analyze this code for vulnerabilities and gas optimizations. Provide a professional markdown report. Code:\n\n${prompt}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
      });

      const data = await response.json();
      const auditReport = data.candidates[0].content.parts[0].text;

      await supabase.from('transactions')
        .update({ status: 'COMPLETED', result_data: auditReport })
        .eq('tx_hash', txHash);

      // Notify Success
      await sendTelegramNotification(`✅ *Audit Complete*\nUser: \`${userAddress}\`\nTx: \`${txHash.substring(0, 10)}...\``);

      return NextResponse.json({ report: auditReport });

    } catch (aiError) {
      await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', txHash);
      // Notify Failure
      await sendTelegramNotification(`❌ *Audit Failed*\nUser: \`${userAddress}\`\nTx: \`${txHash.substring(0, 10)}...\``);
      throw aiError;
    }

  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

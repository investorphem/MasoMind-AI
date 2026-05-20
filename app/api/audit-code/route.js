import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, decodeFunctionData, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { supabase } from '../../../lib/supabase';
import { sendTelegramNotification } from '../../../lib/telegram';

const CONTRACT_ADDRESS = '0xf5e6bff6cD35833FB9509fd081E5Ca9973fD132f';
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY; // 🚨 MUST BE SET IN VERCEL

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
  try {
    const { prompt, txHash } = await req.json();

    if (!prompt || !txHash) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

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
    if (!decimals || paidAmount < parseUnits('0.05', decimals) || paidServiceType !== 'AUDIT') {
      return NextResponse.json({ error: "Invalid payment or routing" }, { status: 403 });
    }

    const userAddress = receipt.from;

    // 2. Insert PENDING to DB
    await supabase.from('transactions').insert([{
      tx_hash: txHash, prompt: prompt, service_type: 'AUDIT', status: 'PENDING', user_address: userAddress.toLowerCase()
    }]);

    // 3. AI Generation
    const apiKey = process.env.GEMINI_API_KEY;
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: `Analyze this code: ${prompt}` }] }] })
    });

    const aiData = await aiResponse.json();
    const auditReport = aiData.candidates[0].content.parts[0].text;

    // 4. 🚀 AUTONOMOUS DELIVERY (The Agent acts!)
    const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
    const agentClient = createWalletClient({ account, chain: celo, transport: http() });

    const deliveryHash = await agentClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: DELIVERY_ABI,
      functionName: 'deliverResult',
      args: [userAddress, auditReport]
    });

    // 5. Finalize DB
    await supabase.from('transactions')
      .update({ status: 'COMPLETED', result_data: auditReport, tx_hash: deliveryHash })
      .eq('tx_hash', txHash);

    await sendTelegramNotification(`✅ *Audit Delivered On-Chain*\nTx: \`${deliveryHash.substring(0, 10)}...\``);

    return NextResponse.json({ report: auditReport });

  } catch (error) {
    console.error("Audit API Error:", error);
    await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', txHash);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

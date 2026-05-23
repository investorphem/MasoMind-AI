import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, decodeFunctionData, parseUnits, fallback } from 'viem';
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
  '0x765de816845861e75a25fca122bb6898b8b1282a': 18, // cUSD / USDm
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
    const publicClient = createPublicClient({ chain: celo, transport: celoTransports });

    // 1. Verify Transaction Validity
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success' || receipt.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
      return NextResponse.json({ error: "Invalid transaction signature" }, { status: 403 });
    }

    const transaction = await publicClient.getTransaction({ hash: txHash });
    const { args } = decodeFunctionData({ abi: REQUEST_ABI, data: transaction.input });
    const [paidToken, paidAmount, , paidServiceType] = args;

    // 🛡️ Ensure payment criteria matches precisely 0.05 for AUDIT service types
    const decimals = TOKENS[paidToken.toLowerCase()];
    if (!decimals || paidAmount < parseUnits('0.05', decimals) || paidServiceType !== 'AUDIT') {
      return NextResponse.json({ error: "Invalid execution routing parameters" }, { status: 403 });
    }

    const userAddress = receipt.from;

    // 2. State Sync Logging via Database Indexer
    const { data: existingTx } = await supabase.from('transactions').select('*').eq('tx_hash', txHash).single();
    if (!existingTx) {
      await supabase.from('transactions').insert([{
        tx_hash: txHash, 
        prompt: prompt, 
        service_type: 'AUDIT', 
        status: 'PENDING', 
        user_address: userAddress.toLowerCase(),
        token_address: paidToken.toLowerCase()
      }]);
    }

    // 3. 🚀 FREE TIER GEMINI COMPLIANT CODE AUDITING MATRIX
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY environment variable is missing.");

    const systemPrompt = `You are an elite Web3 Smart Contract Security Engineer and Gas Optimization Auditor. 
    Analyze the provided Solidity/Web3 source code strictly for vulnerabilities (reentrancy, access control bugs, overflows) and gas inefficiencies. 
    Your entire output response format must be written in professional, clean Markdown using definitive headings, tables, code blocks for fixes, and concise explanations.`;

    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `Perform a meticulous security audit on this deployment source payload:\n\n${prompt}` }]
        }],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.2
        }
      })
    });

    if (!aiResponse.ok) {
        const errorData = await aiResponse.json();
        throw new Error(`Google AI Studio Engine Failure: ${errorData.error?.message || aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    
    // Safely parse the text block canditate matching Google's execution schema
    if (!aiData.candidates || !aiData.candidates[0]?.content?.parts[0]?.text) {
      throw new Error("Invalid structure returned from the Gemini modeling endpoint.");
    }
    const report = aiData.candidates[0].content.parts[0].text;

    // 4. PERSISTENT TRANSACTION STATUS RESOLUTION AND DELIVERY CLOSURE
    await supabase.from('transactions')
      .update({ status: 'COMPLETED', result_data: report })
      .eq('tx_hash', txHash);

    (async () => {
      try {
        const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
        const agentClient = createWalletClient({ account, chain: celo, transport: celoTransports });

        // Build summary telemetry payload string
        const summary = `Audit Complete. Status: ${report.includes('CRITICAL') || report.includes('HIGH') ? '⚠️ Vulnerabilities Flagged' : '✅ Operational Standards Confirmed'}. View full markdown report.`;

        await agentClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: DELIVERY_ABI,
          functionName: 'deliverResult',
          args: [userAddress, summary.substring(0, 240)] // Enforces string optimization parameters
        });
        await sendTelegramNotification(`✅ *Gemini Free Flash Audit Settled and Delivered On-Chain*`);
      } catch (err) {
        console.error("Non-blocking background blockchain delivery failed:", err);
      }
    })();

    return NextResponse.json({ report });

  } catch (error) {
    console.error("Audit API Handler Critical Error:", error);
    if (globalTxHash) {
        await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', globalTxHash);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

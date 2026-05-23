import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, decodeFunctionData, parseUnits, fallback } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { supabase } from '../../../lib/supabase';
import { sendTelegramNotification } from '../../../lib/telegram';

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
  "name": "requestService", "type": "function", "stateMutability": "nonpayable",
  "inputs": [
    { "name": "token", "type": "address" }, { "name": "amount", "type": "uint256" },
    { "name": "prompt", "type": "string" }, { "name": "serviceType", "type": "string" }
  ]
}];

const DELIVERY_ABI = [{
  "name": "deliverResult", "type": "function", "stateMutability": "nonpayable",
  "inputs": [
    { "name": "user", "type": "address" }, { "name": "result", "type": "string" }
  ]
}];

export async function POST(req) {
  let globalTxHash = null;

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

    const decimals = TOKENS[paidToken.toLowerCase()];
    if (!decimals || paidAmount < parseUnits('0.05', decimals) || paidServiceType !== 'AUDIT') {
      return NextResponse.json({ error: "Invalid execution routing parameters" }, { status: 403 });
    }

    const userAddress = receipt.from;

    // 2. Dynamic Address Resolution Interceptor
    let finalSolidityCode = prompt;
    const cleanedInput = prompt.trim();
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(cleanedInput);

    if (isAddress) {
      const celoscanApiKey = process.env.CELOSCAN_API_KEY || ''; 
      const celoscanUrl = `https://api.celoscan.io/api?module=contract&action=getsourcecode&address=${cleanedInput}${celoscanApiKey ? `&apikey=${celoscanApiKey}` : ''}`;
      
      const scanRes = await fetch(celoscanUrl);
      if (!scanRes.ok) {
        return NextResponse.json({ error: "Failed to connect to Celo block explorer nodes." }, { status: 502 });
      }

      const scanData = await scanRes.json();
      
      if (scanData.status === "1" && scanData.result?.[0]?.SourceCode) {
        finalSolidityCode = scanData.result[0].SourceCode;
        if (finalSolidityCode.startsWith('{{')) {
          finalSolidityCode = finalSolidityCode.substring(1, finalSolidityCode.length - 1);
        }
      } else {
        return NextResponse.json({ error: "Contract address is unverified on Celoscan. Please paste the raw code instead." }, { status: 400 });
      }
    }

    // 3. State Sync Logging via Database Indexer
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

    // 4. Gemini 2.5 Flash Core Configuration
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY environment variable is missing.");

    // 🚀 ENTERPRISE CONSTRAINT UPDATE: Restricts wide padding blocks and spatial text layout errors
    const systemPrompt = `You are an elite enterprise-level Web3 Smart Contract Security Engineer and Core Auditor representing Masonode Technologies Limited.
    Analyze the provided Solidity/Web3 source code strictly for vulnerabilities (reentrancy, access control bugs, overflows) and gas inefficiencies.
    
    CRITICAL FORMATTING INSTRUCTIONS:
    1. Do NOT under any circumstances add manual horizontal spacing inside Markdown table cells or lines to visually split text columns. Keep the syntax tight (e.g., "| ID | Severity | Description |" with single space wrappers).
    2. Never output long sequences of consecutive blank lines or trailing spatial chunks.
    3. Structure the audit report with tight headings (## and ###) and bulleted lists.
    4. All fixes must be contained inside specific code blocks with clean language syntax labels (e.g., \`\`\`solidity).`;

    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `Perform a meticulous security audit on this deployment source payload:\n\n${finalSolidityCode}` }]
        }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 4096, temperature: 0.1 } // Dropping temp to 0.1 handles absolute alignment deterministic accuracy
      })
    });

    if (!aiResponse.ok) {
        const errorData = await aiResponse.json();
        throw new Error(`Google AI Studio Engine Failure: ${errorData.error?.message || aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    if (!aiData.candidates || !aiData.candidates[0]?.content?.parts[0]?.text) {
      throw new Error("Invalid structure returned from the Gemini modeling endpoint.");
    }
    const report = aiData.candidates[0].content.parts[0].text;

    // 5. Database Status Sync & On-Chain Delivery Trigger
    await supabase.from('transactions').update({ status: 'COMPLETED', result_data: report }).eq('tx_hash', txHash);

    (async () => {
      try {
        const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
        const agentClient = createWalletClient({ account, chain: celo, transport: celoTransports });
        const summary = `Audit Complete. Status: ${report.includes('CRITICAL') || report.includes('HIGH') ? '⚠️ Vulnerabilities Flagged' : '✅ Operational Standards Confirmed'}. View full markdown report.`;

        await agentClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: DELIVERY_ABI,
          functionName: 'deliverResult',
          args: [userAddress, summary.substring(0, 240)]
        });
        await sendTelegramNotification(`✅ *Gemini 2.5 Smart Resolution Audit Delivered On-Chain*`);
      } catch (err) { console.error("Blockchain delivery failed:", err); }
    })();

    return NextResponse.json({ report });

  } catch (error) {
    console.error("Audit API Handler Critical Error:", error);
    if (globalTxHash) await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', globalTxHash);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

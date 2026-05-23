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

    // 2. Multi-Chain Address Detection Rule Blocks
    let finalSolidityCode = prompt;
    const cleanedInput = prompt.trim();
    const isEvmAddress = /^0x[a-fA-F0-9]{40}$/.test(cleanedInput);

    if (isEvmAddress) {
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
        return NextResponse.json({ error: "Contract address is unverified on Celoscan. Please paste the raw code text instead." }, { status: 400 });
      }
    } else if (/^(S[1-9A-HJ-NP-Za-km-z]{26,35})$/.test(cleanedInput)) {
      // Catch Stacks principal strings gracefully with an actionable instructions step response
      return NextResponse.json({ error: "Direct block explorer retrieval is currently optimized for EVM addresses. For non-EVM runtimes like Stacks (Clarity), please paste the raw source code text directly into the console input field." }, { status: 400 });
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

    // Dynamic actual live request generation date parameters calculation
    const currentRequestLiveDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    // 🚀 DYNAMIC PROMPT DESIGN: Explicitly forces multi-language analysis, true dates, and MasoMind IDs
    const systemPrompt = `You are an elite cross-chain Web3 Smart Contract Security Engineer and Core Auditor representing the MasoMind AI Engine Framework.
    Analyze the provided input source code metadata parameter payload strictly for structural bugs, security vulnerabilities, and gas/execution optimization limits.
    
    UNIVERSAL ARCHITECTURE COMPLIANCE:
    The input script can be written in ANY major blockchain smart contract language, including Solidity (EVM), Clarity (Stacks ecosystem), Vyper, or Rust (WASM/Solana paradigms). Dynamically identify the code context syntax structure and evaluate vulnerabilities based strictly on the language rules (e.g., check for check-bounds in Solidity, assert failures in Clarity, or ownership constraints in Rust).

    CRITICAL FORMATTING INSTRUCTIONS:
    1. Always begin your report with this exact premium metadata executive layout box at the very top:
       - **Auditor Hub Infrastructure:** MasoMind Core Automated Network
       - **Audit Live Operational Date:** ${currentRequestLiveDate}
       - **Structural Verification Status:** Active Pipeline Handshake Verified
    2. All vulnerability listings and structural rows inside the tables must use the precise tracking index ID prefix "MASOMIND-0X" (e.g., MASOMIND-01, MASOMIND-02). Do NOT use any other name.
    3. Do NOT add decorative spatial margins or long strings of empty hyphens inside Markdown table rows to visually align layout boxes. Keep text cells clean and unpadded to prevent UI render clipping.
    4. All proposed correction scripts must be contained inside complete standalone code blocks equipped with their explicit language identifier strings (e.g., \`\`\`solidity, \`\`\`clarity, \`\`\`rust).`;

    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `Perform an extensive multi-chain security audit on this smart contract code deployment script:\n\n${finalSolidityCode}` }]
        }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 4096, temperature: 0.1 }
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

    if (AGENT_PRIVATE_KEY) {
      try {
        const formattedKey = AGENT_PRIVATE_KEY.startsWith('0x') ? AGENT_PRIVATE_KEY : `0x${AGENT_PRIVATE_KEY}`;
        const account = privateKeyToAccount(formattedKey);
        const agentClient = createWalletClient({ account, chain: celo, transport: celoTransports });
        const summary = `MasoMind Hub Audit Complete. Status Verified. View detailed markdown metrics matrix.`;

        const deliveryTxHash = await agentClient.writeContract({
          account,
          address: CONTRACT_ADDRESS,
          abi: DELIVERY_ABI,
          functionName: 'deliverResult',
          args: [userAddress, summary.substring(0, 240)]
        });
        await sendTelegramNotification(`✅ *MasoMind Smart Resolution Cross-Chain Audit Delivered On-Chain: ${deliveryTxHash}*`);
      } catch (err) { console.error("Blockchain delivery failed:", err); }
    }

    return NextResponse.json({ report });

  } catch (error) {
    console.error("Audit API Handler Critical Error:", error);
    if (globalTxHash) await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', globalTxHash);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

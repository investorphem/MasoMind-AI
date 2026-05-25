import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, decodeFunctionData, parseUnits, formatUnits, fallback } from 'viem';
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
  '0x765de816845861e75a25fca122bb6898b8b1282a': { decimals: 18, symbol: 'USDm/cUSD' }, 
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': { decimals: 6, symbol: 'USDC' },
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': { decimals: 6, symbol: 'USDT' }
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
  let cachedUserAddress = null;
  let cachedTokenInfo = { symbol: 'Unknown', amount: '0.00' };

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

    const tokenConfig = TOKENS[paidToken.toLowerCase()];
    if (!tokenConfig || paidAmount < parseUnits('0.05', tokenConfig.decimals) || paidServiceType !== 'AUDIT') {
      return NextResponse.json({ error: "Invalid execution routing parameters" }, { status: 403 });
    }

    cachedUserAddress = receipt.from;
    const humanAmount = formatUnits(paidAmount, tokenConfig.decimals);
    cachedTokenInfo = { symbol: tokenConfig.symbol, amount: humanAmount };

    // 🚀 STEP AHEAD ORDER: Inbound pipeline payment logging notification fired instantly
    await sendTelegramNotification(
      `📥 *MASOMIND INBOUND REQUEST STACK*\n` +
      `============================\n` +
      `🏢 *Service Type:* Audit Engine Protocol\n` +
      `👤 *User Address:* \`${cachedUserAddress}\`\n` +
      `💰 *Settled Payment:* ${humanAmount} ${tokenConfig.symbol}\n` +
      `⛓️ *Transaction Hash:* \`${txHash}\`\n` +
      `⏳ *Status:* Pipeline Activated. Processing Source Payload...`
    );

    // 🚀 STEP AHEAD ORDER: Write row inside database indexer immediately to prevent broken refund data profiles
    const { data: existingTx } = await supabase.from('transactions').select('*').eq('tx_hash', txHash).single();
    if (!existingTx) {
      await supabase.from('transactions').insert([{
        tx_hash: txHash, 
        prompt: prompt, 
        service_type: 'AUDIT', 
        status: 'PENDING', 
        user_address: cachedUserAddress.toLowerCase(),
        token_address: paidToken.toLowerCase()
      }]);
    }

    // 2. Multi-Chain Address Resolution Interceptor
    let finalCodeToAudit = prompt;
    const cleanedInput = prompt.trim();
    const isEvmAddress = /^0x[a-fA-F0-9]{40}$/.test(cleanedInput);

    if (isEvmAddress) {
      const celoscanApiKey = process.env.CELOSCAN_API_KEY || ''; 
      const celoscanUrl = `https://api.celoscan.io/api?module=contract&action=getsourcecode&address=${cleanedInput}${celoscanApiKey ? `&apikey=${celoscanApiKey}` : ''}`;

      const scanRes = await fetch(celoscanUrl);
      if (!scanRes.ok) throw new Error("Failed to reach block explorer infrastructure nodes.");

      const scanData = await scanRes.json();

      if (scanData.status === "1" && scanData.result?.[0]?.SourceCode) {
        finalCodeToAudit = scanData.result[0].SourceCode;
        if (finalCodeToAudit.startsWith('{{')) {
          finalCodeToAudit = finalCodeToAudit.substring(1, finalCodeToAudit.length - 1);
        }
      } else {
        throw new Error("Target contract address is unverified on Celoscan explorers. Prompt aborted.");
      }
    } else if (/^(S[1-9A-HJ-NP-Za-km-z]{26,35})$/.test(cleanedInput)) {
      throw new Error("Direct block explorer retrieval is currently optimized for EVM addresses. Please paste your raw Stacks/Clarity source code text configurations straight into the dashboard console input instead.");
    }

    // 3. Gemini 2.5 Flash Core Configuration Pipeline Execution
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY environment variable is missing.");

    const currentRequestLiveDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    // 🚀 MASTER PROMPT ENGINEERING: Upgraded to senior principal auditor archetype specifications
    const systemPrompt = `You are a Senior Principal Web3 Security Engineer and Smart Contract Auditor specializing in high-assurance multi-chain security audits for enterprise-tier decentralized infrastructure. Your tone is strictly analytical, formal, authoritative, and data-dense.

UNIVERSAL SECURITY TARGET PARADIGMS:
Analyze the input payload carefully. Identify the programming language implementation and enforce the corresponding institutional inspection matrices:
1. CLARITY (Stacks Framework): Thoroughly evaluate vulnerabilities native to interpreted, decidable code structures. Focus inspections on:
   - Integer Arithmetic Precision Loss: Identifying whole integer math step truncation vectors (e.g., executing division operations prior to multiplication).
   - Identity / Context Phishing: Detecting reliance on 'tx-sender' inside authorization assertions where 'contract-caller' context gating is contextually mandatory.
   - Fault Tolerance Handling: Ensuring explicit unwrapping patterns ('try!', 'unwrap!', or explicit responses) are validated across all external token transfers or custom maps.
   - Dynamic Post-Condition Compliance: Checking balance mutations for clean runtime consensus execution blocks.
2. SOLIDITY / VYPER (EVM Ecosystem): Inspect code patterns for gas efficiency parameters, storage slot packaging optimization layouts, access control consistency, structural reentrancy bugs, and compiler overflow logic constraints.

MANDATORY REPORT SECTIONS:
Your output must conform to this precise structural blueprint layout. Avoid informal prose conversational fillers.

### [EXECUTIVE HEADER METADATA BOX]
- **Auditor Hub Infrastructure:** MasoMind Core Automated Network
- **Audit Live Operational Date:** ${currentRequestLiveDate}
- **Structural Verification Status:** Active Pipeline Handshake Verified

### Executive Summary
Provide a comprehensive, high-level evaluation detailing the architectural overview of the target repository, systemic security posture, design goals, threat landscape components, and language-specific traits (e.g., explaining Clarity's decidability implications or EVM memory mechanics).

### Vulnerability Summary Table
Generate a clean, dense Markdown table listing all discovered defects using these exact headings:
| Tracking ID | Severity | Title | Category |
All listings must utilize the explicit index prefix "MASOMIND-0X" (e.g., MASOMIND-01, MASOMIND-02). Do NOT use generic or standard numbers.

### Deep-Dive Vulnerability Analysis
For every item indexed in the summary matrix table, compile an extensive technical breakdown categorized as follows:
- **Category:** [Standard Vulnerability Classification]
- **Description:** [Deep contextual review detailing exactly how the flaw operates at runtime]
- **Impact:** [Direct structural, financial, or protocol-wide exploit scenarios]
- **Remediation Recommendation:** [Clear actionable guidance on correcting the logical vulnerabilities]
- **Code Realization Snippets:** Provide direct, well-commented side-by-side code blocks showing the raw vulnerable configuration compared to the secure remediation implementation. Ensure code blocks are properly tagged with their language names (e.g., \`\`\`clarity, \`\`\`solidity).

### Gas & Runtime Interpretation Optimizations
List precise instruction parameters for minimizing memory usage, decreasing deployment size overheads, optimizing variable lookups, or restructuring loops/maps to conserve computing resources at execution time.`;

    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `Perform an extensive multi-chain security audit on this smart contract code deployment script:\n\n${finalCodeToAudit}` }]
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

    // 4. Update Database State to COMPLETED
    await supabase.from('transactions').update({ status: 'COMPLETED', result_data: report }).eq('tx_hash', txHash);

    // 5. Secure On-Chain Result Delivery Action
    if (AGENT_PRIVATE_KEY) {
      try {
        const formattedKey = AGENT_PRIVATE_KEY.startsWith('0x') ? AGENT_PRIVATE_KEY : `0x${AGENT_PRIVATE_KEY}`;
        const account = privateKeyToAccount(formattedKey);
        const agentClient = createWalletClient({ account, chain: celo, transport: celoTransports });

        const summary = `MasoMind Hub Audit Complete. Status Verified. View detailed markdown metrics matrix.`;

        // Force explicit execution constraint inside main execution threads
        const deliveryTxHash = await agentClient.writeContract({
          account,
          address: CONTRACT_ADDRESS,
          abi: DELIVERY_ABI,
          functionName: 'deliverResult',
          args: [cachedUserAddress, summary.substring(0, 240)]
        });

        // 🚀 SUCCESS TELEMETRY: Automated notification broadcast
        await sendTelegramNotification(
          `✅ *MASOMIND EXECUTION SUCCESS*\n` +
          `============================\n` +
          `🤖 *Agent Identity:* MasoMind Enterprise Auditor Node\n` +
          `👤 *Client Account:* \`${cachedUserAddress}\`\n` +
          `📊 *Vulnerability Findings:* ${report.includes('CRITICAL') || report.includes('HIGH') ? '⚠️ Vulnerabilities Flagged' : '🛡️ Safe/Clean Score'}\n` +
          `⛓️ *Inbound Request Hash:* \`${txHash}\`\n` +
          `📦 *Outbound Delivery Hash:* \`${deliveryTxHash}\`\n` +
          `🚀 *Status:* On-Chain Settlement Complete. Client Workspace Sync Active.`
        );
      } catch (blockchainError) {
        console.error("On-chain delivery transaction broadcast failed:", blockchainError);

        // 🚀 CONGESTION TELEMETRY: Non-blocking warning notification to prevent rendering loops
        await sendTelegramNotification(
          `⚠️ *MASOMIND BLOCKCHAIN DELIVERY DELAY*\n` +
          `============================\n` +
          `👤 *Client Account:* \`${cachedUserAddress}\`\n` +
          `⛓️ *Inbound Request Hash:* \`${txHash}\`\n` +
          `❌ *RPC Error Exception:* \`${blockchainError.message.substring(0, 120)}...\`\n` +
          `💡 *System Note:* Audit successfully compiled and indexed inside Supabase database tables. Client can read report natively, but contract state event callback timed out.`
        );
      }
    }

    return NextResponse.json({ report });

  } catch (error) {
    console.error("Audit API Handler Critical Error:", error);

    // 🚀 FAULT TELEMETRY: Immediate tracking notification with open user refund states mapping
    if (globalTxHash) {
        await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', globalTxHash);

        await sendTelegramNotification(
          `🚨 *MASOMIND AGENT EXCEPTION CRASH*\n` +
          `============================\n` +
          `🏢 *Failed Layer:* Audit Generation Process\n` +
          `👤 *Target User Account:* \`${cachedUserAddress || 'Unresolved/Unknown Address'}\`\n` +
          `💰 *Captured Funds:* ${cachedTokenInfo.amount} ${cachedTokenInfo.symbol}\n` +
          `⛓️ *Inbound Request Hash:* \`${globalTxHash}\`\n` +
          `💥 *Critical System Error:* \`${error.message}\`\n` +
          `💸 *Refund Path Status:* Open. Row logged securely. User can clear client dashboard and click 'Request Refund'.`
        );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

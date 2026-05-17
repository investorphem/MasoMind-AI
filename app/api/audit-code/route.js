import { NextResponse } from 'next/server';
import { createPublicClient, http, decodeFunctionData, parseUnits } from 'viem';
import { celo } from 'viem/chains';

// IMPORTANT: Replace this with your newly deployed V2 Contract Address!
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
    // The frontend sends the smart contract code inside the "prompt" variable
    const { prompt, txHash } = await req.json();

    // Block any request that doesn't include the blockchain receipt
    if (!prompt || !txHash) {
      return NextResponse.json({ error: "Missing required parameters (prompt or txHash)" }, { status: 400 });
    }

    const publicClient = createPublicClient({ chain: celo, transport: http() });

    try {
      // 1. Verify the transaction was successful and sent to your company's contract
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success' || receipt.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
        return NextResponse.json({ error: "Invalid or failed transaction" }, { status: 403 });
      }

      // 2. Fetch the raw transaction data to interrogate the payload
      const transaction = await publicClient.getTransaction({ hash: txHash });

      // 3. Decode the exact arguments the user passed to the smart contract
      const { args } = decodeFunctionData({
        abi: ABI,
        data: transaction.input,
      });

      const [paidToken, paidAmount, paidPrompt, paidServiceType] = args;

      // 4. THE VAULT: Perform strict validation on the decoded data
      const decimals = TOKENS[paidToken.toLowerCase()];
      if (!decimals) {
        return NextResponse.json({ error: "Unsupported stablecoin used" }, { status: 403 });
      }

      // Set the exact price required for the Code Audit (0.05)
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

    // 5. If it passes all security checks, securely query the Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptText = `You are an expert Web3 Smart Contract Auditor. Analyze the following code for vulnerabilities, reentrancy risks, gas optimizations, and syntax errors. Provide a concise, highly professional markdown report. Code:\n\n${prompt}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
      })
    });

    const data = await response.json();
    const auditReport = data.candidates[0].content.parts[0].text;

    return NextResponse.json({ report: auditReport });

  } catch (error) {
    console.error("Audit API Error:", error);
    return NextResponse.json({ error: "Failed to process audit" }, { status: 500 });
  }
}

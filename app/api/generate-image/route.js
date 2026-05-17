import { NextResponse } from 'next/server';
import { createPublicClient, http, decodeFunctionData, parseUnits } from 'viem';
import { celo } from 'viem/chains';

// IMPORTANT: Replace this with your newly deployed V2 Contract Address!
const CONTRACT_ADDRESS = 'YOUR_NEW_V2_CONTRACT_ADDRESS';

// Strict token registry to verify the exact token decimals
const TOKENS = {
  '0x765DE816845861e75A25fCA122bb6898B8B1282a'.toLowerCase(): 18, // cUSD
  '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'.toLowerCase(): 6,  // USDC
  '0x48065fbBE25f71C9282ddf5e1cD6D6A88248a566'.toLowerCase(): 6   // USDT
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

    // 5. If it passes all security checks, securely generate the asset
    const randomSeed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${randomSeed}`;

    return NextResponse.json({ imageUrl });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

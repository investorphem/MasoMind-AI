import { NextResponse } from 'next/server';
import { createPublicClient, http, decodeFunctionData, parseUnits } from 'viem';
import { celo } from 'viem/chains';
import { supabase } from '../../../lib/supabase'; // Import your DB client
import { sendTelegramNotification } from '../../../lib/telegram'; // Import Telegram helper

// UPDATE: Point to your new V2 Contract Address
const CONTRACT_ADDRESS = '0xf5e6bff6cD35833FB9509fd081E5Ca9973fD132f';

// Strict token registry
const TOKENS = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': 18, // cUSD
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': 6,  // USDC
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': 6   // USDT
};

// UPDATE: Function name changed to requestService
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
        return NextResponse.json({ error: "Unsupported stablecoin" }, { status: 403 });
      }

      // SECURITY TIER: Ensure the user actually paid the 0.10 required for images
      const expectedAmount = parseUnits('0.10', decimals); 
      if (paidAmount < expectedAmount) {
         return NextResponse.json({ error: "Insufficient payment amount detected" }, { status: 403 });
      }

      // Ensure serviceType matches the route's purpose
      if (paidServiceType !== 'IMAGE') {
         return NextResponse.json({ error: "Payment not routed for image generation" }, { status: 403 });
      }

    } catch (err) {
      console.error("Blockchain verification error:", err);
      return NextResponse.json({ error: "Transaction verification failed" }, { status: 403 });
    }

    if (!existingTx) {
      await supabase.from('transactions').insert([{
        tx_hash: txHash,
        prompt: prompt,
        service_type: 'IMAGE',
        status: 'PENDING',
        user_address: userAddress.toLowerCase()
      }]);
    }

    try {
      const randomSeed = Math.floor(Math.random() * 1000000);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&model=flux&enhance=true&seed=${randomSeed}`;

      await supabase.from('transactions')
        .update({ 
          status: 'COMPLETED',
          result_data: imageUrl
        })
        .eq('tx_hash', txHash);

      // Notify Success via Telegram
      await sendTelegramNotification(`✅ *Asset Generated*\nType: IMAGE\nUser: \`${userAddress}\`\nTx: \`${txHash.substring(0, 10)}...\``);

      return NextResponse.json({ imageUrl });

    } catch (aiError) {
      await supabase.from('transactions')
        .update({ status: 'FAILED' })
        .eq('tx_hash', txHash);
        
      // Notify Failure via Telegram so you can investigate
      await sendTelegramNotification(`❌ *Generation Failed*\nType: IMAGE\nUser: \`${userAddress}\`\nTx: \`${txHash.substring(0, 10)}...\``);
      
      throw aiError;
    }

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

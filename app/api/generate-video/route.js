import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, decodeFunctionData, parseUnits, fallback } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { supabase } from '../../../lib/supabase';
import { sendTelegramNotification } from '../../../lib/telegram';

export const maxDuration = 60; 

const CONTRACT_ADDRESS = '0xf5e6bff6cD35833FB9509fd081E5Ca9973fD132f';
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY; 

// 🚀 ENTERPRISE RPC CONFIGURATION
const celoTransports = fallback([
  http('https://forno.celo.org'),
  http('https://rpc.celo-community.org'),
  http('https://1rpc.io/celo'),
  http('https://celo.drpc.org')
]);

const TOKENS = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': 18,
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': 6,
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': 6
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

// High-fidelity cinematic MP4 loops for the Video Engine
const CINEMATIC_VIDEOS = {
  cyberpunk: "https://assets.mixkit.co/videos/preview/mixkit-futuristic-city-traffic-in-the-rain-31627-large.mp4",
  nature: "https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-a-beautiful-green-forest-4375-large.mp4",
  space: "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-1610-large.mp4",
  car: "https://assets.mixkit.co/videos/preview/mixkit-driving-a-car-through-a-futuristic-tunnel-31631-large.mp4",
  default: "https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-a-blue-and-pink-wave-31613-large.mp4"
};

export async function POST(req) {
  let globalTxHash = null; 

  try {
    const { prompt, txHash } = await req.json();
    if (!prompt || !txHash) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    globalTxHash = txHash;
    const publicClient = createPublicClient({ chain: celo, transport: celoTransports });

    // 1. Verify Transaction
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success' || receipt.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
      return NextResponse.json({ error: "Invalid transaction" }, { status: 403 });
    }

    const transaction = await publicClient.getTransaction({ hash: txHash });
    const { args } = decodeFunctionData({ abi: REQUEST_ABI, data: transaction.input });
    const [paidToken, paidAmount, , paidServiceType] = args;

    // Verify they paid 1.00 for the VIDEO service
    const decimals = TOKENS[paidToken.toLowerCase()];
    if (!decimals || paidAmount < parseUnits('1.00', decimals) || paidServiceType !== 'VIDEO') {
      return NextResponse.json({ error: "Invalid payment or routing" }, { status: 403 });
    }

    const userAddress = receipt.from;

    // 2. Log to DB
    const { data: existingTx } = await supabase.from('transactions').select('*').eq('tx_hash', txHash).single();
    if (!existingTx) {
      await supabase.from('transactions').insert([{
        tx_hash: txHash, 
        prompt: prompt, 
        service_type: 'VIDEO', 
        status: 'PENDING', 
        user_address: userAddress.toLowerCase(),
        token_address: paidToken.toLowerCase()
      }]);
    }

    // 3. 🚀 ADAPTIVE VIDEO ROUTER
    let mediaUrl = CINEMATIC_VIDEOS.default;
    const cleanPrompt = prompt.toLowerCase();

    if (cleanPrompt.includes('cyber') || cleanPrompt.includes('city') || cleanPrompt.includes('neon')) {
      mediaUrl = CINEMATIC_VIDEOS.cyberpunk;
    } else if (cleanPrompt.includes('forest') || cleanPrompt.includes('nature') || cleanPrompt.includes('mountain')) {
      mediaUrl = CINEMATIC_VIDEOS.nature;
    } else if (cleanPrompt.includes('space') || cleanPrompt.includes('star') || cleanPrompt.includes('galaxy')) {
      mediaUrl = CINEMATIC_VIDEOS.space;
    } else if (cleanPrompt.includes('car') || cleanPrompt.includes('drive') || cleanPrompt.includes('race')) {
      mediaUrl = CINEMATIC_VIDEOS.car;
    }

    // 4. NON-BLOCKING DELIVERY
    await supabase.from('transactions')
      .update({ status: 'COMPLETED', result_data: mediaUrl })
      .eq('tx_hash', txHash);

    (async () => {
      try {
        const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
        const agentClient = createWalletClient({ account, chain: celo, transport: celoTransports });
        const summary = `Video Settled: ${prompt.substring(0, 15)}...`;

        await agentClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: DELIVERY_ABI,
          functionName: 'deliverResult',
          args: [userAddress, summary]
        });

        await sendTelegramNotification(`✅ *Cinematic Video Track Settled On-Chain*`);
      } catch (err) {
        console.error("Background blockchain delivery failed:", err);
      }
    })();

    return NextResponse.json({ mediaUrl });

  } catch (error) {
    console.error("Video API Error:", error);

    if (globalTxHash) {
        await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', globalTxHash);
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, decodeFunctionData, parseUnits, fallback } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { supabase } from '../../../lib/supabase';
import { sendTelegramNotification } from '../../../lib/telegram';

export const maxDuration = 60; 

// 🚀 UPDATED: Valid Contract Address Configuration
const CONTRACT_ADDRESS = '0x038be2c568f20a69931EE4082B424e5a68dB8089';
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY; 

const celoTransports = fallback([
  http('https://forno.celo.org'),
  http('https://rpc.celo-community.org'),
  http('https://1rpc.io/celo'),
  http('https://celo.drpc.org')
]);

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

// 🎯 FIX: Swapped out hotlink-protected Mixkit assets for unblocked vectors that stream everywhere
const PREMIUM_LOOPS = {
  synthwave: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  lofi: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  orchestral: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  electronic: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  default: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"
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

    const decimals = TOKENS[paidToken.toLowerCase()];
    if (!decimals || paidAmount < parseUnits('0.50', decimals) || paidServiceType !== 'MUSIC') {
      return NextResponse.json({ error: "Invalid payment or routing" }, { status: 403 });
    }

    const userAddress = receipt.from;

    // 2. Log to DB
    const { data: existingTx } = await supabase.from('transactions').select('*').eq('tx_hash', txHash).single();
    if (!existingTx) {
      await supabase.from('transactions').insert([{
        tx_hash: txHash, 
        prompt: prompt, 
        service_type: 'MUSIC', 
        status: 'PENDING', 
        user_address: userAddress.toLowerCase(),
        token_address: paidToken.toLowerCase() 
      }]);
    }

    // 3. ADAPTIVE GENERATION ROUTER
    let mediaUrl = PREMIUM_LOOPS.default;
    const cleanPrompt = prompt.toLowerCase();
    if (cleanPrompt.includes('synth') || cleanPrompt.includes('cyber')) mediaUrl = PREMIUM_LOOPS.synthwave;
    else if (cleanPrompt.includes('chill') || cleanPrompt.includes('lo-fi')) mediaUrl = PREMIUM_LOOPS.lofi;
    else if (cleanPrompt.includes('epic') || cleanPrompt.includes('orchestra')) mediaUrl = PREMIUM_LOOPS.orchestral;
    else if (cleanPrompt.includes('dance') || cleanPrompt.includes('electronic')) mediaUrl = PREMIUM_LOOPS.electronic;

    // 4. DELIVERY
    await supabase.from('transactions').update({ status: 'COMPLETED', result_data: mediaUrl }).eq('tx_hash', txHash);

    (async () => {
      try {
        const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
        const agentClient = createWalletClient({ account, chain: celo, transport: celoTransports });
        await agentClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: DELIVERY_ABI,
          functionName: 'deliverResult',
          args: [userAddress, `Music Settled: ${mediaUrl.substring(0, 30)}...`]
        });
        await sendTelegramNotification(`✅ *Premium Music Track Settled On-Chain*`);
      } catch (err) { console.error("Background blockchain delivery failed:", err); }
    })();

    return NextResponse.json({ mediaUrl });
  } catch (error) {
    console.error("Music API Error:", error);
    if (globalTxHash) await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', globalTxHash);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

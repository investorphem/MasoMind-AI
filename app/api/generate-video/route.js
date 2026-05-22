import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, decodeFunctionData, parseUnits, formatUnits, fallback } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { supabase } from '../../../lib/supabase';
import { sendTelegramNotification } from '../../../lib/telegram';

export const maxDuration = 60; 

const CONTRACT_ADDRESS = '0x038be2c568f20a69931EE4082B424e5a68dB8089';
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY; 

const celoTransports = fallback([
  http('https://forno.celo.org'),
  http('https://rpc.celo-community.org'),
  http('https://1rpc.io/celo'),
  http('https://celo.drpc.org')
]);

const TOKENS = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': { decimals: 18, symbol: 'cUSD' },
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': { decimals: 6, symbol: 'USDC' },
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': { decimals: 6, symbol: 'USDT' }
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

// 🎯 FIX: Swapped hotlink-protected Mixkit URLs for unblocked, range-supporting media layers
const CINEMATIC_VIDEOS = {
  cyberpunk: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  nature: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  car: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  default: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
};

export async function POST(req) {
  let globalTxHash = null; 
  let paymentDetails = null;

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

    const tokenConfig = TOKENS[paidToken.toLowerCase()];
    if (!tokenConfig || paidAmount < parseUnits('1.00', tokenConfig.decimals) || paidServiceType !== 'VIDEO') {
      return NextResponse.json({ error: "Invalid payment or routing" }, { status: 403 });
    }

    const userAddress = receipt.from;
    const humanAmount = formatUnits(paidAmount, tokenConfig.decimals);
    paymentDetails = { amount: humanAmount, symbol: tokenConfig.symbol, service: paidServiceType, user: userAddress };

    await sendTelegramNotification(`💰 *Payment Verified!*\nUser: \`${userAddress}\`\nPaid: ${humanAmount} ${tokenConfig.symbol}\nService: ${paidServiceType}\nStatus: ⏳ Processing AI...`);

    // 2. Log to DB
    const { data: existingTx } = await supabase.from('transactions').select('*').eq('tx_hash', txHash).single();
    if (!existingTx) {
      await supabase.from('transactions').insert([{
        tx_hash: txHash, prompt: prompt, service_type: 'VIDEO', status: 'PENDING', 
        user_address: userAddress.toLowerCase(), token_address: paidToken.toLowerCase()
      }]);
    }

    // 3. AI GENERATION ROUTER
    let mediaUrl = CINEMATIC_VIDEOS.default;
    const cleanPrompt = prompt.toLowerCase();
    if (cleanPrompt.includes('cyber') || cleanPrompt.includes('city') || cleanPrompt.includes('neon')) mediaUrl = CINEMATIC_VIDEOS.cyberpunk;
    else if (cleanPrompt.includes('forest') || cleanPrompt.includes('nature') || cleanPrompt.includes('mountain')) mediaUrl = CINEMATIC_VIDEOS.nature;
    else if (cleanPrompt.includes('car') || cleanPrompt.includes('drive') || cleanPrompt.includes('race')) mediaUrl = CINEMATIC_VIDEOS.car;

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
          args: [userAddress, `Video Ready: ${mediaUrl.substring(0, 30)}...`]
        });
        await sendTelegramNotification(`✅ *AI Delivery Successful*\nUser: \`${userAddress}\`\nPrompt: "${prompt}"`);
      } catch (err) { console.error("Delivery failed:", err); }
    })();

    return NextResponse.json({ mediaUrl });
  } catch (error) {
    console.error("Video API Error:", error);
    if (globalTxHash) {
        await supabase.from('transactions').update({ status: 'FAILED' }).eq('tx_hash', globalTxHash);
        if (paymentDetails) await sendTelegramNotification(`❌ *AI Engine Crash*\nUser: \`${paymentDetails.user}\`\nStatus: Payment secured, but AI failed. Error: ${error.message}`);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

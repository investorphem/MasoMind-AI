import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, decodeFunctionData, parseUnits, formatUnits, fallback } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';
import { sendTelegramNotification } from '../../../lib/telegram';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// 🚀 FIXED: Synchronized with your active multi-tab contract deployment
const CONTRACT_ADDRESS = '0x038be2c568f20a69931EE4082B424e5a68dB8089';
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY; 

// 🚀 FIXED: Integrated cluster array to prevent single node connectivity drops
const celoTransports = fallback([
  http('https://forno.celo.org'),
  http('https://rpc.celo-community.org'),
  http('https://1rpc.io/celo'),
  http('https://celo.drpc.org')
]);

const TOKEN_CONFIG = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': { decimals: 18, symbol: 'USDm/cUSD' }, 
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': { decimals: 6, symbol: 'USDC' },
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': { decimals: 6, symbol: 'USDT' }
};

export async function POST(req) {
  let cachedUserAddress = null;
  let cachedService = 'Unknown';

  try {
    const { txHash } = await req.json();
    if (!txHash) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    const publicClient = createPublicClient({ chain: celo, transport: celoTransports });

    // 1. Check Database State
    const { data: tx, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('tx_hash', txHash)
      .single();

    if (!tx) return NextResponse.json({ error: "Transaction index not found" }, { status: 404 });
    
    cachedUserAddress = tx.user_address;
    cachedService = tx.service_type;

    if (tx.status !== 'FAILED') {
      return NextResponse.json({ error: "Only FAILED transactions can be refunded" }, { status: 400 });
    }
    if (tx.refund_tx) {
      return NextResponse.json({ error: "Autonomous refund already finalized for this index" }, { status: 400 });
    }

    // 2. Verify original payment status on-chain
    try {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        if (receipt.status !== 'success') {
            return NextResponse.json({ error: "Original transaction failed on-chain layout rules" }, { status: 403 });
        }
        if (receipt.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
            return NextResponse.json({ error: "Target transaction envelope not directed to MasoMind contracts" }, { status: 403 });
        }
    } catch (e) {
        return NextResponse.json({ error: "On-chain verification protocol timeout" }, { status: 403 });
    }

    // 3. Process Refund Amount Map Calculation
    const config = TOKEN_CONFIG[tx.token_address.toLowerCase()];
    if (!config) return NextResponse.json({ error: "Unsupported ERC20 asset configuration" }, { status: 400 });

    const amounts = { IMAGE: '0.10', AUDIT: '0.05', MUSIC: '0.50', VIDEO: '1.00' };
    const priceStr = amounts[tx.service_type] || '0';
    const refundAmount = parseUnits(priceStr, config.decimals);

    if (refundAmount === BigInt(0)) {
      return NextResponse.json({ error: "Invalid execution category value matching structural configurations" }, { status: 400 });
    }

    // 4. 🚀 FIXED: Context-Safe Account & Client Signer Generation
    if (!AGENT_PRIVATE_KEY) throw new Error("AGENT_PRIVATE_KEY secret parameter is unconfigured.");
    const formattedKey = AGENT_PRIVATE_KEY.startsWith('0x') ? AGENT_PRIVATE_KEY : `0x${AGENT_PRIVATE_KEY}`;
    const account = privateKeyToAccount(formattedKey);
    const agentWalletClient = createWalletClient({ account, chain: celo, transport: celoTransports });

    // Execute the native ERC20 stablecoin settlement transfer directly out of the agent treasury balance
    const refundHash = await agentWalletClient.writeContract({
      account,
      address: tx.token_address,
      abi: [{
        "name": "transfer",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [{ "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }],
        "outputs": [{ "name": "", "type": "bool" }]
      }],
      functionName: 'transfer',
      args: [tx.user_address, refundAmount],
    });

    // 5. Finalize Local Index State Status inside Database Engine
    await supabase.from('transactions')
      .update({ status: 'REFUNDED', refund_tx: refundHash })
      .eq('tx_hash', txHash);

    // 🚀 ENTERPRISE TELEMETRY: Full success output tracking alert
    await sendTelegramNotification(
      `💸 *MASOMIND AUTONOMOUS REFUND SETTLED*\n` +
      `============================\n` +
      `🏢 *Layer Category:* Capital Recovery Ledger\n` +
      `👤 *Recipient Address:* \`${tx.user_address}\`\n` +
      `🛠️ *Failed Service:* ${tx.service_type} Engine Protocol\n` +
      `💰 *Returned Funds:* ${priceStr} ${config.symbol}\n` +
      `📦 *Refund Settlement Hash:* \`${refundHash}\`\n` +
      `🚀 *Status:* Treasury Balance Corrected. Client Handshake Repaid Successfully.`
    );

    return NextResponse.json({ success: true, refundHash });

  } catch (error) {
    console.error("Autonomous Refund Error:", error);

    // 🚀 ENTERPRISE TELEMETRY: Real-time alerting for processing failures
    await sendTelegramNotification(
      `🚨 *MASOMIND AUTOMATED REFUND CRASH*\n` +
      `============================\n` +
      `👤 *Impacted Account:* \`${cachedUserAddress || 'Unknown User'}\`\n` +
      `🛠️ *Service Target:* ${cachedService} Routine\n` +
      `⛓️ *Inbound Action Hash:* \`${globalTxHash || 'None Provided'}\`\n` +
      `💥 *Execution Exception:* \`${error.message}\`\n` +
      `⚠️ *Action Required:* Check agent wallet stablecoin liquidity pools immediately.`
    );

    return NextResponse.json({ error: "Failed to process autonomous refund process." }, { status: 500 });
  }
}

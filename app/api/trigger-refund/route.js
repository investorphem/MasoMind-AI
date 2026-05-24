import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { sendTelegramNotification } from '../../../lib/telegram';
import { createWalletClient, createPublicClient, http, fallback, parseUnits } from 'viem'; 
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';

// 🚀 FIXED: Synchronized with your active multi-service router deployment
const CONTRACT_ADDRESS = '0x038be2c568f20a69931EE4082B424e5a68dB8089';
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;

// 🚀 FIXED: Integrated cluster array to prevent single node connectivity drops
const celoTransports = fallback([
  http('https://forno.celo.org'),
  http('https://rpc.celo-community.org'),
  http('https://1rpc.io/celo'),
  http('https://celo.drpc.org')
]);

// Token Registry for dynamic refunds
const TOKEN_CONFIG = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': { decimals: 18, symbol: 'USDm/cUSD' },
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': { decimals: 6, symbol: 'USDC' },
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': { decimals: 6, symbol: 'USDT' }
};

export async function POST(req) {
  let cachedUserAddress = null;
  let cachedService = 'Unknown';

  try {
    const { txHash, userAddress } = await req.json();
    if (!txHash || !userAddress) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    cachedUserAddress = userAddress;

    // 1. Check Database State
    const { data: tx, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('tx_hash', txHash)
      .eq('user_address', userAddress.toLowerCase())
      .single();

    if (!tx) return NextResponse.json({ error: "Transaction index not found" }, { status: 404 });
    cachedService = tx.service_type;

    if (tx.status !== 'FAILED') {
      return NextResponse.json({ error: "Only FAILED transactions can be refunded" }, { status: 403 });
    }
    if (tx.refund_tx) {
      return NextResponse.json({ error: "Autonomous refund already finalized for this index" }, { status: 403 });
    }
    if (!tx.token_address) {
      return NextResponse.json({ error: "Missing token tracking metadata in ledger row" }, { status: 400 });
    }

    const config = TOKEN_CONFIG[tx.token_address.toLowerCase()];
    if (!config) return NextResponse.json({ error: "Unsupported ERC20 asset configuration" }, { status: 400 });

    // 2. 🚀 BULLETPROOF CHECK: Verify original payment physically hit the blockchain
    try {
      const publicClient = createPublicClient({ chain: celo, transport: celoTransports });
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

      if (receipt.status !== 'success') {
          return NextResponse.json({ error: "Original transaction failed on-chain layout rules. Nothing to refund." }, { status: 403 });
      }
      if (receipt.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
          return NextResponse.json({ error: "Target transaction envelope not directed to MasoMind contracts." }, { status: 403 });
      }
    } catch (e) {
      return NextResponse.json({ error: "On-chain verification protocol timeout" }, { status: 403 });
    }

    // 3. Determine Amount
    const amounts = { IMAGE: '0.10', AUDIT: '0.05', MUSIC: '0.50', VIDEO: '1.00' };
    const amountStr = amounts[tx.service_type] || '0';
    const amountValue = parseFloat(amountStr);

    if (amountValue <= 0) {
      return NextResponse.json({ error: "Invalid execution category value matching configurations" }, { status: 400 });
    }

    // 4. AUTONOMOUS LOGIC: Auto-process if <= $1.00, otherwise queue for verification checks
    if (amountValue <= 1.00) {
      if (!AGENT_PRIVATE_KEY) throw new Error("AGENT_PRIVATE_KEY secret parameter is unconfigured.");
      
      // 🚀 FIXED: Context-Safe Account & Client Signer Generation
      const formattedKey = AGENT_PRIVATE_KEY.startsWith('0x') ? AGENT_PRIVATE_KEY : `0x${AGENT_PRIVATE_KEY}`;
      const account = privateKeyToAccount(formattedKey);
      const agentClient = createWalletClient({ account, chain: celo, transport: celoTransports });

      const refundAmount = parseUnits(amountStr, config.decimals);

      // Execute the native ERC20 token settlement transfer out of the agent treasury balance
      const refundHash = await agentClient.writeContract({
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
        args: [userAddress, refundAmount],
      });

      // Finalize DB Ledger Indices
      await supabase.from('transactions')
        .update({ status: 'REFUNDED', refund_tx: refundHash })
        .eq('tx_hash', txHash);

      // 🚀 ENTERPRISE TELEMETRY: Full success output tracking alert
      await sendTelegramNotification(
        `💸 *MASOMIND AUTONOMOUS REFUND SETTLED*\n` +
        `============================\n` +
        `🏢 *Layer Category:* Capital Recovery Ledger (Auto)\n` +
        `👤 *Recipient Address:* \`${userAddress}\`\n` +
        `🛠️ *Failed Service:* ${tx.service_type} Engine Protocol\n` +
        `💰 *Returned Funds:* ${amountStr} ${config.symbol}\n` +
        `📦 *Refund Settlement Hash:* \`${refundHash}\"\n` +
        `🚀 *Status:* Treasury Balance Corrected. Client Handshake Repaid Automatically.`
      );

      return NextResponse.json({ success: true, message: "Refund processed automatically", refundHash });

    } else {
      // Queue for manual approval (Over $1.00 threshold settings protection parameters)
      await supabase.from('transactions').update({ status: 'REFUND_PENDING' }).eq('tx_hash', txHash);
      
      // 🚀 ENTERPRISE TELEMETRY: Security limit warning broadcast
      await sendTelegramNotification(
        `🚨 *MASOMIND MANUAL REFUND REQUIRED*\n` +
        `============================\n` +
        `🏢 *Layer Category:* Risk Mitigation Threshold Breached\n` +
        `👤 *Target User Account:* \`${userAddress}\`\n` +
        `🛠️ *Impacted Service:* ${tx.service_type} Loop\n` +
        `💰 *Pending Allocation:* ${amountStr} ${config.symbol}\n` +
        `⚠️ *Action Required:* Amount exceeds autocheck threshold limits. Please access Admin Settlement Dashboard.`
      );

      return NextResponse.json({ success: true, message: "Refund queued for manual approval validation profiles" });
    }

  } catch (error) {
    console.error("Refund Routing Failure Engine Exception:", error);
    
    // 🚀 ENTERPRISE TELEMETRY: Real-time alerting for processing failures
    await sendTelegramNotification(
      `🚨 *MASOMIND AUTOMATED REFUND CRASH*\n` +
      `============================\n` +
      `👤 *Impacted Account:* \`${cachedUserAddress || 'Unknown User'}\`\n` +
      `🛠️ *Service Target:* ${cachedService} Routine\n` +
      `⛓️ *Inbound Action Hash:* \`${globalTxHash || 'None Provided'}\`\n` +
      `💥 *Execution Exception:* \`${error.message || 'Unknown Exception'}\`\n` +
      `⚠️ *Action Required:* Inspect operational balance layers immediately.`
    );
    
    return NextResponse.json({ error: error.message || "Failed to process autonomous recovery pipeline steps" }, { status: 500 });
  }
}

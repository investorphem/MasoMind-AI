import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { sendTelegramNotification } from '../../../lib/telegram';
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem'; 
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';

const CONTRACT_ADDRESS = '0xf5e6bff6cD35833FB9509fd081E5Ca9973fD132f';
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;

// Token Registry for dynamic refunds
const TOKEN_CONFIG = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': { decimals: 18, symbol: 'cUSD' },
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': { decimals: 6, symbol: 'USDC' },
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': { decimals: 6, symbol: 'USDT' }
};

export async function POST(req) {
  try {
    const { txHash, userAddress } = await req.json();

    // 1. Check Database State
    const { data: tx, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('tx_hash', txHash)
      .eq('user_address', userAddress.toLowerCase())
      .single();

    if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    if (tx.status !== 'FAILED') return NextResponse.json({ error: "Only FAILED transactions can be refunded" }, { status: 403 });
    if (tx.refund_tx) return NextResponse.json({ error: "Refund already processed" }, { status: 403 });
    if (!tx.token_address) return NextResponse.json({ error: "Missing token address in ledger" }, { status: 400 });

    const config = TOKEN_CONFIG[tx.token_address.toLowerCase()];
    if (!config) return NextResponse.json({ error: "Unsupported token type" }, { status: 400 });

    // 2. 🚀 BULLETPROOF CHECK: Verify original payment physically hit the blockchain
    try {
      const publicClient = createPublicClient({ chain: celo, transport: http() });
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      
      if (receipt.status !== 'success') {
          return NextResponse.json({ error: "Original transaction failed on-chain. Nothing to refund." }, { status: 403 });
      }
      if (receipt.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
          return NextResponse.json({ error: "Payment was not routed to the MasoMind contract." }, { status: 403 });
      }
    } catch (e) {
      return NextResponse.json({ error: "Could not verify original on-chain payment." }, { status: 403 });
    }

    // 3. Determine Amount
    const amounts = { IMAGE: '0.10', AUDIT: '0.05', MUSIC: '0.50', VIDEO: '1.00' };
    const amountStr = amounts[tx.service_type] || '0';
    const amountValue = parseFloat(amountStr);

    if (amountValue <= 0) {
      return NextResponse.json({ error: "Invalid service amount" }, { status: 400 });
    }

    // 4. AUTONOMOUS LOGIC: Auto-process if <= $1.00, otherwise queue
    if (amountValue <= 1.00) {
      // Execute automatically via Agent Wallet
      const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
      const agentClient = createWalletClient({ account, chain: celo, transport: http() });

      const refundAmount = parseUnits(amountStr, config.decimals);

      const refundHash = await agentClient.writeContract({
        address: tx.token_address, // Uses the exact token they paid with
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

      // Finalize DB
      await supabase.from('transactions')
        .update({ status: 'REFUNDED', refund_tx: refundHash })
        .eq('tx_hash', txHash);

      await sendTelegramNotification(`✅ *Auto-Refund Executed*\n\nService: ${tx.service_type}\nAmount: ${amountStr} ${config.symbol}\nTx: \`${refundHash.substring(0, 10)}...\``);
      
      return NextResponse.json({ success: true, message: "Refund processed automatically", refundHash });

    } else {
      // Queue for manual approval (Over $1.00 threshold)
      await supabase.from('transactions').update({ status: 'REFUND_PENDING' }).eq('tx_hash', txHash);
      await sendTelegramNotification(`🚨 *Manual Refund Required*\n\nService: ${tx.service_type}\nAmount: ${amountStr} ${config.symbol}\nUser: \`${userAddress.substring(0, 10)}...\`\nPlease check Settlement Dashboard.`);
      
      return NextResponse.json({ success: true, message: "Refund queued for manual approval" });
    }

  } catch (error) {
    console.error("Refund Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process refund" }, { status: 500 });
  }
}

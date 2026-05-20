import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { sendTelegramNotification } from '../../../lib/telegram';
import { createWalletClient, http, parseUnits } from 'viem'; // 🚀 Added viem
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';

const USDT_ADDRESS = '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e';

export async function POST(req) {
  try {
    const { txHash, userAddress } = await req.json();

    const { data: tx, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('tx_hash', txHash)
      .eq('user_address', userAddress.toLowerCase())
      .single();

    if (!tx || tx.status !== 'FAILED') {
      return NextResponse.json({ error: "Not eligible for refund" }, { status: 403 });
    }

    // 🚀 AUTONOMOUS LOGIC: Auto-process if under $1.00, otherwise queue for human
    const amounts = { IMAGE: '0.10', AUDIT: '0.05', MUSIC: '0.50', VIDEO: '1.00' };
    const amountStr = amounts[tx.service_type] || '0';
    
    if (parseFloat(amountStr) <= 1.00) {
      // Execute automatically via Agent Wallet
      const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
      const client = createWalletClient({ account, chain: celo, transport: http() });

      const refundHash = await client.writeContract({
        address: USDT_ADDRESS,
        abi: [{"name":"transfer","type":"function","stateMutability":"nonpayable","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]}],
        functionName: 'transfer',
        args: [userAddress, parseUnits(amountStr, 6)],
      });

      await supabase.from('transactions')
        .update({ status: 'REFUNDED', refund_tx: refundHash })
        .eq('tx_hash', txHash);

      await sendTelegramNotification(`✅ *Auto-Refund Executed*\n\nService: ${tx.service_type}\nAmount: ${amountStr} USDT`);
      return NextResponse.json({ success: true, message: "Refund processed automatically" });

    } else {
      // Queue for manual approval (your existing flow)
      await supabase.from('transactions').update({ status: 'REFUND_PENDING' }).eq('tx_hash', txHash);
      await sendTelegramNotification(`🚨 *Manual Refund Required*\n\nAmount: ${amountStr} USDT. Please check Settlement Dashboard.`);
      return NextResponse.json({ success: true, message: "Refund queued for manual approval" });
    }

  } catch (error) {
    console.error("Refund Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

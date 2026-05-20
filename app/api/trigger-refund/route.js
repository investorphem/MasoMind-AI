import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { sendTelegramNotification } from '../../../lib/telegram'; // Your helper

export async function POST(req) {
  try {
    const { txHash, userAddress } = await req.json();

    // 1. Verify the transaction exists and is in a failed state
    const { data: tx, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('tx_hash', txHash)
      .eq('user_address', userAddress.toLowerCase())
      .single();

    if (!tx || tx.status !== 'FAILED') {
      return NextResponse.json({ error: "Unauthorized or transaction not eligible for refund" }, { status: 403 });
    }

    // 2. Mark the transaction as PENDING_REFUND
    await supabase.from('transactions')
      .update({ status: 'REFUND_PENDING' })
      .eq('tx_hash', txHash);

    // 3. Send the Telegram Alert
    // We include the user address, the amount, and the transaction hash for your reference
    await sendTelegramNotification(
      `🚨 *Refund Requested*\n\n` +
      `👤 User: \`${userAddress}\`\n` +
      `💰 Service: ${tx.service_type}\n` +
      `🔗 Tx: \`${txHash.substring(0, 10)}...\`\n\n` +
      `Please check the Settlement Dashboard to process.`
    );

    return NextResponse.json({ success: true, message: "Refund request submitted" });

  } catch (error) {
    console.error("Refund Trigger Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(req) {
  const { txHash, userAddress } = await req.json();

  // Verify that the user requesting the refund is the one who paid
  const { data: tx } = await supabase
    .from('transactions')
    .select('*')
    .eq('tx_hash', txHash)
    .eq('user_address', userAddress.toLowerCase())
    .single();

  if (!tx || tx.status !== 'FAILED') {
    return NextResponse.json({ error: "Unauthorized or invalid status" }, { status: 403 });
  }

  // Set status to REFUND_PENDING
  await supabase.from('transactions')
    .update({ status: 'REFUND_PENDING' })
    .eq('tx_hash', txHash);

  return NextResponse.json({ success: true });
}

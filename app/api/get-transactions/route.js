import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_address', address.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return NextResponse.json({ transactions: data || [] });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch ledger" }, { status: 500 });
  }
}

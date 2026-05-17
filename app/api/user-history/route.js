import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET(req) {
  try {
    // Get the wallet address from the URL query parameters
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: "Missing wallet address" }, { status: 400 });
    }

    // Fetch the user's transaction history, newest first
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_address', address.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ transactions: data });

  } catch (error) {
    console.error("History API Error:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

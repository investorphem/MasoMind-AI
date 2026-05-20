import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  
  // Get pagination params (default to page 1, 10 items per page)
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    // Calculate the start and end indices for Supabase
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Fetch data AND the exact total count of rows for this user
    const { data, count, error } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_address', address.toLowerCase())
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    // Calculate total pages
    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({ 
      transactions: data || [],
      pagination: {
        totalItems: count || 0,
        totalPages: totalPages,
        currentPage: page,
        itemsPerPage: limit
      }
    });
    
  } catch (err) {
    console.error("Ledger Fetch Error:", err);
    return NextResponse.json({ error: "Failed to fetch ledger" }, { status: 500 });
  }
}

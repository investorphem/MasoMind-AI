import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

// 🚀 CRITICAL FIX: Forces Next.js to skip static generation and evaluate this route dynamically at runtime
export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    
    // 1. Get pagination params (default to page 1, 10 items per page)
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!address) {
      return NextResponse.json({ error: "Missing wallet address" }, { status: 400 });
    }

    // 2. Calculate the start and end indices for the Supabase query
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 3. Fetch the data AND the exact total count of rows for this user
    const { data, count, error } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_address', address.toLowerCase())
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    // 4. Calculate total pages
    const totalPages = Math.ceil((count || 0) / limit);

    // 5. Return the data along with the pagination metadata
    return NextResponse.json({ 
      transactions: data || [],
      pagination: {
        totalItems: count || 0,
        totalPages: totalPages,
        currentPage: page,
        itemsPerPage: limit
      }
    });

  } catch (error) {
    console.error("History API Error:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

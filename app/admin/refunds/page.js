'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { RefreshCw, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function AdminRefunds() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRefunds = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('status', 'REFUND_PENDING')
      .order('timestamp', { ascending: false });
    setRefunds(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchRefunds(); }, []);

  const processRefund = async (tx) => {
    // 1. Trigger your contract interaction logic here
    // 2. Once the blockchain transaction confirms, update DB:
    await supabase.from('transactions')
      .update({ status: 'REFUNDED' })
      .eq('tx_hash', tx.tx_hash);
      
    fetchRefunds();
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Treasury Settlement</h1>
          <button onClick={fetchRefunds} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          {refunds.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">No pending refunds.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950/50 uppercase text-[10px] text-zinc-500 tracking-widest">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Service</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {refunds.map(tx => (
                  <tr key={tx.tx_hash} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="p-4 font-mono text-emerald-500">{tx.user_address.substring(0,10)}...</td>
                    <td className="p-4">{tx.service_type}</td>
                    <td className="p-4">Pending</td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => processRefund(tx)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-[10px] transition-all"
                      >
                        SEND REFUND
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { supabase } from '../../../lib/supabase';
import { RefreshCw, CheckCircle, AlertCircle, Send } from 'lucide-react';

export default function AdminRefunds() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const { writeContractAsync } = useWriteContract();

  const fetchRefunds = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('status', 'REFUND_PENDING');
    setRefunds(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchRefunds(); }, []);

  const processRefund = async (tx) => {
    try {
      // Assuming a simple ERC20 transfer function on your contract or calling the token contract
      // This is a placeholder for your refund logic
      const hash = await writeContractAsync({
        address: tx.token_address, // Ensure you store this in your DB
        abi: [{"name":"transfer","type":"function","stateMutability":"nonpayable","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}]}],
        functionName: 'transfer',
        args: [tx.user_address, parseUnits(tx.amount.toString(), 18)],
      });

      await supabase.from('transactions').update({ status: 'REFUNDED', refund_tx: hash }).eq('tx_hash', tx.tx_hash);
      fetchRefunds();
    } catch (err) {
      console.error("Refund failed:", err);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto text-zinc-100">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <AlertCircle className="text-amber-500" /> Settlement Dashboard
      </h1>
      
      <div className="space-y-4">
        {refunds.map(tx => (
          <div key={tx.tx_hash} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400">User: {tx.user_address}</p>
              <p className="text-sm font-bold text-amber-500">{tx.amount} USDT</p>
            </div>
            <button 
              onClick={() => processRefund(tx)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-2"
            >
              <Send className="w-3 h-3" /> Process Refund
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

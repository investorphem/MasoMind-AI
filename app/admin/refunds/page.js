'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { RefreshCw, Send, ShieldAlert, Lock } from 'lucide-react';
import { useAccount, useWriteContract, useConnect } from 'wagmi';
import { parseUnits } from 'viem';

const ADMIN_WALLET = '0xec24bafbc989a9be5f6f0ead8848753b5e4ae0b6'.toLowerCase();

const TOKEN_CONFIG = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': { symbol: 'USDm', decimals: 18 },
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': { symbol: 'USDC', decimals: 6 },
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': { symbol: 'USDT', decimals: 6 }
};

export default function AdminRefunds() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { connect, connectors } = useConnect();

  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const fetchRefunds = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'REFUND_PENDING')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRefunds(data || []);
    } catch (err) {
      console.error("Supabase Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (isConnected && address?.toLowerCase() === ADMIN_WALLET) {
      fetchRefunds(); 
    }
  }, [address, isConnected]);

  const getRefundAmount = (serviceType) => {
    const prices = { 'IMAGE': '0.10', 'AUDIT': '0.05', 'MUSIC': '0.50', 'VIDEO': '1.00' };
    return prices[serviceType] || '0.00';
  };

  const processRefund = async (tx) => {
    if (!tx.user_address || !tx.token_address) {
      alert("Missing refund details in database.");
      return;
    }
    setProcessingId(tx.tx_hash);

    try {
      const tokenAddr = tx.token_address.toLowerCase();
      const config = TOKEN_CONFIG[tokenAddr];
      if (!config) throw new Error("Unknown Token");

      const amountToRefund = parseUnits(getRefundAmount(tx.service_type), config.decimals);

      const refundHash = await writeContractAsync({
        address: tx.token_address,
        abi: [{"name":"transfer","type":"function","stateMutability":"nonpayable","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]}],
        functionName: 'transfer',
        args: [tx.user_address, amountToRefund],
      });

      await supabase.from('transactions')
        .update({ status: 'REFUNDED', refund_tx: refundHash })
        .eq('tx_hash', tx.tx_hash);

      fetchRefunds();
    } catch (err) {
      console.error("Refund failed:", err);
      alert("Transaction failed. Check your admin wallet balance.");
    } finally {
      setProcessingId(null);
    }
  };

  if (!isConnected || address?.toLowerCase() !== ADMIN_WALLET) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-zinc-100 p-4">
        <Lock className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold tracking-widest text-red-400 mb-6">RESTRICTED AREA</h2>
        <button 
          onClick={() => {
            const connector = connectors.find(c => c.id === 'injected') || connectors[0];
            connect({ connector });
          }}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
        >
          Connect Admin Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-emerald-500" />
            <h1 className="text-2xl font-bold tracking-tight">Treasury Settlement</h1>
          </div>
          <button onClick={fetchRefunds} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
            <RefreshCw className={`w-5 h-5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-950 text-[10px] text-zinc-500 tracking-widest uppercase">
              <tr>
                <th className="p-5">User</th>
                <th className="p-5">Service</th>
                <th className="p-5">Asset</th>
                <th className="p-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {refunds.map(tx => (
                <tr key={tx.tx_hash} className="hover:bg-zinc-800/30">
                  <td className="p-5 font-mono text-emerald-500 text-xs">{tx.user_address.substring(0,6)}...</td>
                  <td className="p-5 font-bold text-xs">{tx.service_type}</td>
                  <td className="p-5 text-amber-500 text-xs">{TOKEN_CONFIG[tx.token_address?.toLowerCase()]?.symbol || 'Unknown'}</td>
                  <td className="p-5 text-right">
                    <button 
                      onClick={() => processRefund(tx)}
                      disabled={processingId === tx.tx_hash}
                      className="px-4 py-2 bg-emerald-600 rounded-lg font-bold text-[10px] flex items-center gap-2 ml-auto"
                    >
                      {processingId === tx.tx_hash ? '...' : <Send className="w-3 h-3" />}
                      REFUND
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

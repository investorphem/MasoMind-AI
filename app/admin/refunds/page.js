'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { RefreshCw, Send, ShieldAlert, CheckCircle2, Lock } from 'lucide-react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';

// 🚨 SECURITY: Replace this with your exact owner wallet address (in lowercase)
const ADMIN_WALLET = '0x1234567890abcdef1234567890abcdef12345678'; 

// Celo USDT Address for executing the refund
const USDT_ADDRESS = '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e';

export default function AdminRefunds() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const fetchRefunds = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('status', 'REFUND_PENDING')
      .order('created_at', { ascending: false }); // FIXED: Schema uses created_at
    setRefunds(data || []);
    setLoading(false);
  };

  useEffect(() => { 
    if (address?.toLowerCase() === ADMIN_WALLET) {
      fetchRefunds(); 
    }
  }, [address]);

  // Determine how much to refund based on the service type
  const getRefundAmount = (serviceType) => {
    switch (serviceType) {
      case 'IMAGE': return '0.10';
      case 'AUDIT': return '0.05';
      case 'MUSIC': return '0.50';
      case 'VIDEO': return '1.00';
      default: return '0.00';
    }
  };

  const processRefund = async (tx) => {
    if (!tx.user_address) return;
    setProcessingId(tx.tx_hash);

    try {
      const amountStr = getRefundAmount(tx.service_type);
      const amountToRefund = parseUnits(amountStr, 6); // USDT has 6 decimals

      // 1. Send the USDT back to the user directly from the Admin wallet
      const refundHash = await writeContractAsync({
        address: USDT_ADDRESS,
        abi: [{"name":"transfer","type":"function","stateMutability":"nonpayable","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]}],
        functionName: 'transfer',
        args: [tx.user_address, amountToRefund],
      });

      // 2. Once the blockchain transaction is sent, update Supabase securely
      await supabase.from('transactions')
        .update({ 
          status: 'REFUNDED',
          refund_tx: refundHash 
        })
        .eq('tx_hash', tx.tx_hash);

      fetchRefunds();
    } catch (err) {
      console.error("Refund failed:", err);
      alert("Blockchain transaction failed. Please check your wallet balance and try again.");
    } finally {
      setProcessingId(null);
    }
  };

  // 🛡️ SECURITY BARRIER: Block non-admins
  if (!isConnected || address?.toLowerCase() !== ADMIN_WALLET.toLowerCase()) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-zinc-100 p-4">
        <Lock className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold tracking-widest text-red-400">RESTRICTED AREA</h2>
        <p className="text-sm text-zinc-500 mt-2">Connect the authorized treasury wallet to access.</p>
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
          <button onClick={fetchRefunds} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors">
            <RefreshCw className={`w-5 h-5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
          {refunds.length === 0 ? (
            <div className="p-16 flex flex-col items-center text-zinc-500">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/20 mb-4" />
              <p>No pending refunds in the queue.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950 uppercase text-[10px] text-zinc-500 tracking-widest border-b border-zinc-800">
                <tr>
                  <th className="p-5 font-bold">User</th>
                  <th className="p-5 font-bold">Service</th>
                  <th className="p-5 font-bold">Refund Amount</th>
                  <th className="p-5 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {refunds.map(tx => (
                  <tr key={tx.tx_hash} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="p-5 font-mono text-emerald-500">
                      {tx.user_address ? `${tx.user_address.substring(0,6)}...${tx.user_address.substring(38)}` : 'Unknown'}
                    </td>
                    <td className="p-5 font-bold">{tx.service_type}</td>
                    <td className="p-5 text-amber-500 font-mono">{getRefundAmount(tx.service_type)} USDT</td>
                    <td className="p-5 text-right">
                      <button 
                        onClick={() => processRefund(tx)}
                        disabled={processingId === tx.tx_hash}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 rounded-lg font-bold text-[10px] transition-all flex items-center gap-2 ml-auto"
                      >
                        {processingId === tx.tx_hash ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        {processingId === tx.tx_hash ? 'SENDING...' : 'SEND REFUND'}
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

'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { RefreshCw, Send, ShieldAlert, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';

const ADMIN_WALLET = '0xec24bafbc989a9be5f6f0ead8848753b5e4ae0b6'.toLowerCase(); // Forced lowercase
const USDT_ADDRESS = '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e';

export default function AdminRefunds() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [debugMode, setDebugMode] = useState(false);

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
      alert("Failed to load refunds. Check Supabase connection.");
    } finally {
      setLoading(false);
    }
  };

  // 🚀 FIXED: Enhanced Effect Watcher
  useEffect(() => { 
    if (isConnected && address?.toLowerCase() === ADMIN_WALLET) {
      fetchRefunds(); 
    }
  }, [address, isConnected]);

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
      const amountToRefund = parseUnits(amountStr, 6);

      const refundHash = await writeContractAsync({
        address: USDT_ADDRESS,
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
      alert("Blockchain transaction failed. Check your wallet balance.");
    } finally {
      setProcessingId(null);
    }
  };

    // 🛡️ SECURITY BARRIER
  if (!isConnected || address?.toLowerCase() !== ADMIN_WALLET) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-zinc-100 p-4">
        <Lock className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold tracking-widest text-red-400 mb-6">RESTRICTED AREA</h2>
        
        {/* ADD YOUR WALLET CONNECT BUTTON HERE SO YOU CAN LOG IN */}
        <div className="mb-8">
           {/* If you use AppKit/Web3Modal, this is the standard tag. 
               If you use a custom button component, replace this with your component (e.g. <ConnectButton />) */}
           <appkit-button /> 
        </div>

        {/* Debugging helper to fix your login issue */}
        <button onClick={() => setDebugMode(!debugMode)} className="text-[10px] text-zinc-500 hover:text-zinc-300 underline transition-colors">
           {debugMode ? 'Hide Diagnostics' : 'Why am I blocked?'}
        </button>
        
        {debugMode && (
          <div className="mt-4 p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-left max-w-sm w-full overflow-hidden break-all space-y-2">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
               <span className="text-zinc-500">Status:</span>
               <span className={isConnected ? "text-emerald-500" : "text-amber-500"}>
                 {isConnected ? 'Wallet Connected' : 'Wallet Disconnected'}
               </span>
            </div>
            
            <div className="flex flex-col gap-1 pt-2">
               <span className="text-zinc-500">Your Wallet:</span>
               <span className={address?.toLowerCase() === ADMIN_WALLET ? "text-emerald-500" : "text-red-400"}>
                 {address ? address.toLowerCase() : 'None'}
               </span>
            </div>

            <div className="flex flex-col gap-1 pt-2">
               <span className="text-zinc-500">Required Admin:</span>
               <span className="text-emerald-500">{ADMIN_WALLET}</span>
            </div>
          </div>
        )}
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
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-950 uppercase text-[10px] text-zinc-500 tracking-widest border-b border-zinc-800">
              <tr>
                <th className="p-5 font-bold">User Address</th>
                <th className="p-5 font-bold">Service</th>
                <th className="p-5 font-bold">USDT</th>
                <th className="p-5 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {refunds.map(tx => (
                <tr key={tx.tx_hash} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="p-5 font-mono text-emerald-500 text-xs">
                    {tx.user_address ? `${tx.user_address.substring(0,6)}...${tx.user_address.substring(38)}` : 'N/A'}
                  </td>
                  <td className="p-5 font-bold text-xs">{tx.service_type}</td>
                  <td className="p-5 text-amber-500 font-mono text-xs">{getRefundAmount(tx.service_type)}</td>
                  <td className="p-5 text-right">
                    <button 
                      onClick={() => processRefund(tx)}
                      disabled={processingId === tx.tx_hash}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-zinc-950 rounded-lg font-bold text-[10px] transition-all flex items-center gap-2 ml-auto"
                    >
                      {processingId === tx.tx_hash ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      {processingId === tx.tx_hash ? 'SENDING...' : 'REFUND'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {refunds.length === 0 && !loading && (
             <div className="p-16 text-center text-zinc-500 italic">No pending settlements required.</div>
          )}
        </div>
      </div>
    </div>
  );
}

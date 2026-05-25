'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { RefreshCw, Send, ShieldAlert, Lock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
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

  const [mounted, setMounted] = useState(false);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

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
      showToast("Failed to fetch pending ledger settlements.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (mounted && isConnected && address?.toLowerCase() === ADMIN_WALLET) {
      fetchRefunds(); 
    }
  }, [address, isConnected, mounted]);

  const getRefundAmount = (serviceType) => {
    const prices = { 'IMAGE': '0.10', 'AUDIT': '0.05', 'MUSIC': '0.50', 'VIDEO': '1.00' };
    return prices[serviceType] || '0.00';
  };

  const handleConnectAdmin = () => {
    try {
      if (!connectors || connectors.length === 0) {
        showToast("No wallet extensions detected.", "error");
        return;
      }
      const connector = connectors.find(c => c.id === 'injected') || connectors[0];
      connect({ connector });
    } catch (err) {
      showToast("Wallet connection failed.", "error");
    }
  };

  const processRefund = async (tx) => {
    if (!tx.user_address || !tx.token_address) {
      showToast("Missing destination parameters in database row.", "error");
      return;
    }
    setProcessingId(tx.tx_hash);

    try {
      const tokenAddr = tx.token_address.toLowerCase();
      const config = TOKEN_CONFIG[tokenAddr];
      if (!config) throw new Error("Unsupported token specification");

      const priceStr = getRefundAmount(tx.service_type);
      const amountToRefund = parseUnits(priceStr, config.decimals);

      const refundHash = await writeContractAsync({
        address: tx.token_address,
        abi: [{"name":"transfer","type":"function","stateMutability":"nonpayable","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]}],
        functionName: 'transfer',
        args: [tx.user_address, amountToRefund],
      });

      await supabase.from('transactions')
        .update({ status: 'REFUNDED', refund_tx: refundHash })
        .eq('tx_hash', tx.tx_hash);

      showToast(`Refund successfully broadcasted!`, "success");
      fetchRefunds();
    } catch (err) {
      console.error("Refund failed:", err);
      showToast("Execution failed. Verify your balance layer.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-100">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!isConnected || address?.toLowerCase() !== ADMIN_WALLET) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-zinc-100 p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-950/20 via-[#09090b] to-[#09090b] relative">
        
        {toast.visible && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-11/12 max-w-xs animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-zinc-950/90 border-red-500/30 text-red-400 shadow-2xl backdrop-blur-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-[11px] font-mono font-bold tracking-wide">{toast.message}</p>
            </div>
          </div>
        )}

        <Lock className="w-12 h-12 text-red-500/80 mb-4 animate-pulse" />
        <h2 className="text-sm font-bold tracking-widest text-red-400 mb-2 uppercase font-mono">Restricted Access Gateway</h2>
        <p className="text-xs text-zinc-500 max-w-[250px] text-center leading-relaxed mb-6">Administrative connection required to manage asset recovery settlement vaults.</p>
        
        <button 
          onClick={handleConnectAdmin}
          className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-mono font-bold text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] tracking-wider uppercase"
        >
          Connect Admin Signer
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/10 via-[#09090b] to-[#09090b] relative">
      
      {toast.visible && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-11/12 max-w-xs animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl bg-zinc-950/90 ${
            toast.type === 'success' ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/30 text-red-400'
          }`}>
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <p className="text-[11px] font-mono font-bold tracking-wide">{toast.message}</p>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto space-y-6 pt-4">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-md font-bold tracking-wider text-white uppercase">Treasury Settlement Desk</h1>
              <p className="text-[10px] text-zinc-500 font-mono">Node ID: {address.substring(0, 6)}...{address.substring(address.length - 4)}</p>
            </div>
          </div>
          <button onClick={fetchRefunds} disabled={loading} className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-md">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-zinc-950/80 border-b border-zinc-800/80 text-[10px] text-zinc-500 tracking-widest uppercase font-mono">
              <tr>
                <th className="p-4 font-bold">Recipient Client</th>
                <th className="p-4 font-bold">Service Target</th>
                <th className="p-4 font-bold">Token Asset</th>
                <th className="p-4 font-bold text-right">Action Vector</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 font-sans text-zinc-300">
              {refunds.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-zinc-500 font-medium font-mono text-[11px] tracking-wide bg-zinc-950/10">
                    No pending treasury escrow refunds found.
                  </td>
                </tr>
              ) : (
                refunds.map(tx => {
                  const safeUserAddress = tx.user_address || '';
                  const safeTokenAddress = tx.token_address?.toLowerCase() || '';
                  return (
                    <tr key={tx.tx_hash} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="p-4 font-mono text-emerald-400 font-bold">
                        {safeUserAddress ? `${safeUserAddress.substring(0, 6)}...${safeUserAddress.substring(safeUserAddress.length - 4)}` : '0xUnknown'}
                      </td>
                      <td className="p-4 font-bold text-zinc-200 tracking-wide text-[11px]">{tx.service_type || 'UNDEFINED'}</td>
                      <td className="p-4 font-mono font-bold text-amber-500">{TOKEN_CONFIG[safeTokenAddress]?.symbol || 'Unknown'}</td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => processRefund(tx)}
                          disabled={processingId === tx.tx_hash}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl font-mono font-bold text-[10px] tracking-wider uppercase transition-all disabled:opacity-30 shadow-[0_0_10px_rgba(16,185,129,0.1)] flex items-center gap-1.5 ml-auto"
                        >
                          {processingId === tx.tx_hash ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Settle ({getRefundAmount(tx.service_type)})
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

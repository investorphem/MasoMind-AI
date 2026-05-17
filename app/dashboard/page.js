'use client';
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Sparkles, Loader2, History, ArrowLeft, ExternalLink, Image as ImageIcon, Code, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const { isConnected, address } = useAccount();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!address) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/user-history?address=${address}`);
        const data = await res.json();
        if (data.transactions) {
          setTransactions(data.transactions);
        }
      } catch (error) {
        console.error("Failed to load history", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [address]);

  // Calculate Metrics
  const totalRequests = transactions.length;
  const totalSpent = transactions.reduce((acc, tx) => {
    return acc + (tx.service_type === 'IMAGE' ? 0.10 : 0.05);
  }, 0).toFixed(2);

  const truncateAddress = (str) => `${str.slice(0, 6)}...${str.slice(-4)}`;

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-zinc-100 font-sans p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#09090b] to-[#09090b]">
      
      <header className="flex flex-col gap-4 py-4 px-2 mb-6 border-b border-white/5 pb-4">
        <div className="flex justify-between items-center w-full max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 bg-zinc-900/80 rounded-lg border border-zinc-800 hover:bg-zinc-800 transition-colors">
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </Link>
            <div>
              <h1 className="font-bold text-lg tracking-wider text-white flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" /> LEDGER
              </h1>
              <p className="text-[10px] text-emerald-500/70 uppercase tracking-widest font-mono">On-Chain Analytics</p>
            </div>
          </div>

          {isConnected && (
            <div className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-xs font-mono text-zinc-400">
              {truncateAddress(address)}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto space-y-6">
        {!isConnected ? (
          <div className="w-full rounded-3xl glass-panel border border-zinc-800/50 flex flex-col items-center justify-center p-12 text-center shadow-2xl">
            <History className="w-12 h-12 text-zinc-700 mb-4" />
            <h3 className="text-zinc-300 font-medium mb-2">Wallet Disconnected</h3>
            <p className="text-sm text-zinc-500 max-w-sm">Connect your wallet on the home screen to view your transaction history and AI generation receipts.</p>
            <Link href="/" className="mt-6 px-6 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-sm font-medium hover:bg-emerald-500/20 transition-all">
              Return Home
            </Link>
          </div>
        ) : loading ? (
           <div className="w-full flex justify-center py-20">
             <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
           </div>
        ) : (
          <>
            {/* Enterprise Metrics Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-panel border border-zinc-800/50 rounded-2xl p-5 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><History className="w-16 h-16" /></div>
                <p className="text-xs text-zinc-500 font-semibold tracking-wider uppercase mb-1 z-10">Total Invocations</p>
                <p className="text-3xl font-bold text-white z-10">{totalRequests}</p>
              </div>
              <div className="glass-panel border border-zinc-800/50 rounded-2xl p-5 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles className="w-16 h-16" /></div>
                <p className="text-xs text-zinc-500 font-semibold tracking-wider uppercase mb-1 z-10">Total Volume (Est)</p>
                <p className="text-3xl font-bold text-emerald-400 z-10">{totalSpent} <span className="text-sm text-zinc-500">cUSD/USDT</span></p>
              </div>
            </div>

            {/* Transaction Ledger */}
            <div className="glass-panel border border-zinc-800/50 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900/50 text-[10px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800/50">
                      <th className="p-4 font-medium">Service</th>
                      <th className="p-4 font-medium">Intent / Prompt</th>
                      <th className="p-4 font-medium">Date (UTC)</th>
                      <th className="p-4 font-medium text-right">Status / Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-sm">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-zinc-500">No transactions found for this address.</td>
                      </tr>
                    ) : (
                      transactions.map((tx) => (
                        <tr key={tx.tx_hash} className="hover:bg-zinc-900/30 transition-colors group">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {tx.service_type === 'IMAGE' ? <ImageIcon className="w-4 h-4 text-emerald-400" /> : <Code className="w-4 h-4 text-blue-400" />}
                              <span className="font-mono text-xs">{tx.service_type}</span>
                            </div>
                          </td>
                          <td className="p-4 max-w-[200px] truncate text-zinc-400 text-xs" title={tx.prompt}>
                            {tx.prompt}
                          </td>
                          <td className="p-4 text-zinc-500 text-xs font-mono">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-4 text-right flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                              {tx.status === 'COMPLETED' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                              <span className={`text-[10px] font-bold tracking-wide ${tx.status === 'COMPLETED' ? 'text-emerald-500' : 'text-red-500'}`}>{tx.status}</span>
                            </div>
                            <a href={`https://celoscan.io/tx/${tx.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-zinc-500 hover:text-emerald-400 flex items-center gap-1 transition-colors">
                              {truncateAddress(tx.tx_hash)} <ExternalLink className="w-2 h-2" />
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

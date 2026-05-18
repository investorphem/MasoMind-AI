'use client';
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { 
  ArrowLeft, History, ExternalLink, Image as ImageIcon, 
  Code, Music, Video, XCircle, Download, Loader2, Share2 
} from 'lucide-react';

export default function Dashboard() {
  const { isConnected, address } = useAccount();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null); 

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    const fetchLedger = async () => {
      try {
        // Securely fetch through your backend API instead of client-side Supabase
        const res = await fetch(`/api/get-transactions?address=${address}`);
        const data = await res.json();
        
        if (data.transactions) {
          setTransactions(data.transactions);
        }
      } catch (err) {
        console.error('Error fetching ledger:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLedger();
  }, [address]);

  const truncateHash = (hash) => {
    if (!hash) return '';
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
  };

  const getServiceIcon = (type) => {
    switch (type) {
      case 'IMAGE': return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case 'AUDIT': return <Code className="w-4 h-4 text-emerald-400" />;
      case 'MUSIC': return <Music className="w-4 h-4 text-emerald-400" />;
      case 'VIDEO': return <Video className="w-4 h-4 text-emerald-400" />;
      default: return <History className="w-4 h-4 text-emerald-400" />;
    }
  };

  const downloadAsset = async (tx) => {
    if (!tx.result_data || tx.service_type === 'AUDIT') return;
    
    try {
      if (navigator.share && tx.service_type === 'IMAGE') {
        await navigator.share({
          title: 'MasoMind Asset',
          text: `Prompt: ${tx.prompt}`,
          url: tx.result_data
        });
      } else {
        if (tx.service_type === 'IMAGE') {
           window.open(tx.result_data, '_blank');
        } else {
           const a = document.createElement("a");
           a.href = tx.result_data;
           a.download = `MasoMind-${tx.service_type}-${Date.now()}.${tx.service_type === 'MUSIC' ? 'mp3' : 'mp4'}`;
           document.body.appendChild(a);
           a.click();
           document.body.removeChild(a);
        }
      }
    } catch (err) {
      console.error("Share failed:", err);
      window.open(tx.result_data, '_blank');
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] text-zinc-100 p-4">
        <div className="p-4 bg-zinc-900 rounded-full border border-zinc-800 mb-4 shadow-inner">
          <History className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold mb-2 tracking-wider">WALLET DISCONNECTED</h2>
        <p className="text-sm text-zinc-500 mb-6 text-center max-w-xs">Connect your Web3 wallet on the home screen to view your Enterprise Ledger.</p>
        <Link href="/" className="px-6 py-3 bg-emerald-500 text-zinc-950 font-bold text-xs rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)]">
          Return to App
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-zinc-100 font-sans p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#09090b] to-[#09090b]">
      
      <header className="flex items-center justify-between py-4 mb-4 border-b border-white/5 pb-4">
        <Link href="/" className="flex items-center gap-2 p-2 bg-zinc-900/80 rounded-full border border-zinc-800 hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
        </Link>
        <div className="flex flex-col items-end">
          <h1 className="font-bold text-lg tracking-wider text-white">LEDGER</h1>
          <p className="text-[10px] text-emerald-500/70 uppercase tracking-widest font-mono">Invocation History</p>
        </div>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto relative">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center glass-panel rounded-3xl border border-zinc-800/50 p-8">
            <History className="w-10 h-10 text-zinc-600 mb-4" />
            <p className="text-sm text-zinc-400">No transactions found.</p>
            <p className="text-xs text-zinc-600 mt-2">Generate your first asset to see it here.</p>
          </div>
        ) : (
          <div className="space-y-3 pb-20">
            {transactions.map((tx) => (
              <div 
                key={tx.id || tx.tx_hash} 
                onClick={() => { if (tx.status === 'COMPLETED' && tx.result_data) setSelectedTx(tx); }}
                className={`glass-panel p-4 rounded-2xl border border-zinc-800/80 flex items-center gap-4 transition-all ${tx.status === 'COMPLETED' && tx.result_data ? 'cursor-pointer hover:bg-zinc-800/50 hover:border-emerald-500/50 shadow-lg' : 'opacity-70'}`}
              >
                <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800/80 shadow-inner">
                  {getServiceIcon(tx.service_type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : 'Unknown Date'}
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold tracking-wider ${tx.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : tx.status === 'FAILED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                      {tx.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 font-medium truncate mb-1 pr-2">{tx.prompt}</p>
                  <a href={`https://celoscan.io/tx/${tx.tx_hash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-emerald-500/70 hover:text-emerald-400 transition-colors w-fit" onClick={(e) => e.stopPropagation()}>
                    {truncateHash(tx.tx_hash)} <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl border border-zinc-700 shadow-2xl overflow-hidden relative bg-zinc-950/90">
            
            <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-2">
                {getServiceIcon(selectedTx.service_type)}
                <span className="text-xs font-bold text-zinc-200 tracking-wider uppercase">{selectedTx.service_type} ASSET</span>
              </div>
              <button onClick={() => setSelectedTx(null)} className="p-1 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col items-center justify-center min-h-[300px]">
              {selectedTx.service_type === 'IMAGE' && (
                <img src={selectedTx.result_data} alt="Saved AI Asset" className="w-full rounded-2xl shadow-xl border border-zinc-800" />
              )}
              {selectedTx.service_type === 'AUDIT' && (
                <div className="w-full prose prose-invert prose-emerald text-xs whitespace-pre-wrap font-mono leading-relaxed bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                  {selectedTx.result_data}
                </div>
              )}
              {selectedTx.service_type === 'MUSIC' && (
                <div className="w-full flex flex-col items-center space-y-6">
                  <div className="p-6 bg-emerald-500/10 rounded-full border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                    <Music className="w-16 h-16 text-emerald-400" />
                  </div>
                  <audio controls className="w-full" src={selectedTx.result_data} />
                </div>
              )}
              {selectedTx.service_type === 'VIDEO' && (
                <video controls className="w-full aspect-video rounded-2xl border border-zinc-800 shadow-xl" src={selectedTx.result_data} />
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
              <p className="text-[10px] text-zinc-500 mb-3 italic px-1 line-clamp-2">"{selectedTx.prompt}"</p>
              {selectedTx.service_type !== 'AUDIT' && (
                <button 
                  onClick={() => downloadAsset(selectedTx)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2"
                >
                  {selectedTx.service_type === 'IMAGE' ? <Share2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                  {selectedTx.service_type === 'IMAGE' ? 'Share / Save Asset' : 'Download Media'}
                </button>
              )}
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}

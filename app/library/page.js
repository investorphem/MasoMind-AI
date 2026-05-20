'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, FileText, Image as ImageIcon, Music, Video, Download, Code, AlertCircle, Loader2, XCircle, PlayCircle, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAccount } from 'wagmi';

export default function LibraryPage() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState('MEDIA');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    const fetchVaultAssets = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/get-transactions?address=${address}&limit=50`);
        const data = await res.json();

        if (data.transactions) {
          const SEVEN_DAYS_MS = 604800000;
          const now = Date.now();

          const validAssets = data.transactions
            .filter(tx => (now - new Date(tx.created_at).getTime()) < SEVEN_DAYS_MS)
            .map(tx => ({
              id: tx.tx_hash,
              type: tx.service_type,
              category: tx.service_type === 'AUDIT' ? 'DOCUMENT' : 'MEDIA',
              data: tx.result_data,
              prompt: tx.prompt,
              timestamp: tx.created_at,
              status: tx.status
            }));

          setItems(validAssets);
        }
      } catch (err) {
        console.error("Failed to sync cloud vault:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVaultAssets();
  }, [address]);

  const handleRefund = async (item) => {
    if (!address) return;
    setRequesting(item.id);
    try {
      const res = await fetch('/api/trigger-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: item.id, userAddress: address })
      });

      if (res.ok) {
        alert('Refund request submitted to MasoMind Treasury.');
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'REFUND_PENDING' } : i));
      } else {
        alert('Failed to request refund. It may have already been processed.');
      }
    } catch (err) {
      console.error(err);
    }
    setRequesting(null);
  };

  // 🚀 BULLETPROOF MINIPAY FIX: No Blob URLs!
  const downloadAsset = async (item) => {
    try {
      // 1. Direct Links (Images): Open safely in a new tab where MiniPay allows saving natively
      if (item.type === 'IMAGE' && item.data.startsWith('http')) {
        window.open(item.data, '_blank');
        return;
      }

      // 2. Text (Audits): Use native text share
      if (item.type === 'AUDIT') {
        if (navigator.share) {
          await navigator.share({ title: 'MasoMind Security Audit', text: item.data });
        } else {
          alert("Please use the 'Copy' button in the report viewer to save this audit.");
        }
        return;
      }

      // 3. Media (Audio/Video): Try native share file, otherwise instruct long-press
      if (item.type === 'MUSIC' || item.type === 'VIDEO') {
        try {
          const response = await fetch(item.data);
          const rawBlob = await response.blob();
          const extension = item.type === 'MUSIC' ? 'mp3' : 'mp4';
          const mimeType = item.type === 'MUSIC' ? 'audio/mp3' : 'video/mp4';
          const file = new File([rawBlob], `MasoMind-${item.type}.${extension}`, { type: mimeType });

          // Try native iOS/Android share sheet first
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: `MasoMind ${item.type}` });
            return;
          }
        } catch (e) {
          console.warn("Native share blocked or unavailable:", e);
        }
        
        // ULTIMATE FALLBACK FOR MINIPAY: User Instruction
        alert(`To save this ${item.type.toLowerCase()}, please long-press the media player above and select "Save" or "Download".`);
      }
    } catch (err) {
      console.error("Download action failed:", err);
      alert("Browser restricted download. Please long-press the media to save it.");
    }
  };

  const mediaItems = items.filter(i => i.category === 'MEDIA');
  const documentItems = items.filter(i => i.category === 'DOCUMENT');

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-zinc-100 font-sans p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#09090b] to-[#09090b]">

      <header className="flex items-center justify-between py-4 mb-2 border-b border-white/5 pb-4 max-w-md mx-auto w-full">
        <Link href="/" className="flex items-center gap-2 p-2 bg-zinc-900/80 rounded-full border border-zinc-800 hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
        </Link>
        <div className="flex flex-col items-end">
          <h1 className="font-bold text-lg tracking-wider text-white">ASSET VAULT</h1>
          <p className="text-[10px] text-emerald-500/70 uppercase tracking-widest font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" /> 7-Day Cloud Retention
          </p>
        </div>
      </header>

      <div className="w-full max-w-md mx-auto mb-6 flex gap-2 p-1 bg-zinc-900/50 border border-zinc-800 rounded-xl">
        <button 
          onClick={() => setActiveTab('MEDIA')} 
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'MEDIA' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'text-zinc-500 hover:bg-zinc-800/50'}`}
        >
          Media
        </button>
        <button 
          onClick={() => setActiveTab('DOCUMENT')} 
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'DOCUMENT' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'text-zinc-500 hover:bg-zinc-800/50'}`}
        >
          Documents
        </button>
      </div>

      <main className="flex-1 w-full max-w-md mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'MEDIA' && mediaItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-center glass-panel rounded-3xl border border-zinc-800/50 p-8">
                <ImageIcon className="w-10 h-10 text-zinc-600 mb-4" />
                <p className="text-sm text-zinc-400">No recent media found.</p>
                <p className="text-xs text-zinc-600 mt-2">Assets generated in the last 7 days will sync across your devices here.</p>
              </div>
            )}

            {activeTab === 'DOCUMENT' && documentItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-center glass-panel rounded-3xl border border-zinc-800/50 p-8">
                <FileText className="w-10 h-10 text-zinc-600 mb-4" />
                <p className="text-sm text-zinc-400">No recent documents found.</p>
                <p className="text-xs text-zinc-600 mt-2">Audits generated in the last 7 days will sync here.</p>
              </div>
            )}

            {activeTab === 'MEDIA' && mediaItems.length > 0 && (
              <div className="grid grid-cols-2 gap-3 pb-8">
                {mediaItems.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedAsset(item)}
                    className="group relative aspect-square bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800/80 cursor-pointer hover:border-emerald-500/50 transition-colors shadow-lg"
                  >
                    <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded border border-white/10 text-[9px] font-mono font-bold text-emerald-400 tracking-wider">
                      {item.type}
                    </div>
                    
                    {item.status === 'FAILED' ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-red-500/5 text-red-500 p-4 text-center">
                        <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-[9px] font-bold">FAILED</span>
                      </div>
                    ) : item.data ? (
                      <>
                        {item.type === 'IMAGE' && <img src={item.data} className="w-full h-full object-cover" loading="lazy" />}
                        {item.type === 'VIDEO' && (
                          <div className="w-full h-full relative">
                            <video src={item.data} className="w-full h-full object-cover opacity-80" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors">
                              <PlayCircle className="w-10 h-10 text-white shadow-2xl" />
                            </div>
                          </div>
                        )}
                        {item.type === 'MUSIC' && (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-500/5">
                            <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                              <Music className="w-8 h-8 text-emerald-400" />
                            </div>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'DOCUMENT' && documentItems.map(item => (
              <div key={item.id} className="glass-panel rounded-3xl border border-zinc-800/80 p-5 space-y-4 mb-4 shadow-lg bg-zinc-900/40">
                <div className="flex items-center justify-between border-b border-zinc-800/50 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-1 bg-zinc-900 rounded border border-zinc-700 font-mono text-emerald-400 font-bold tracking-wider">
                      AUDIT
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800/80 shadow-inner">
                  <div className="p-4 h-48 overflow-y-auto custom-scrollbar text-[10px]">
                    <div className="prose prose-invert prose-emerald max-w-none">
                      <ReactMarkdown>{item.data || '*Failed to generate audit*'}</ReactMarkdown>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => downloadAsset(item)} 
                    disabled={!item.data}
                    className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" /> Share MD
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </main>

      {/* EXPANDED ASSET MODAL */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-md max-h-[95vh] flex flex-col rounded-3xl border border-zinc-700 shadow-2xl overflow-hidden relative bg-[#09090b]">
            
            <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-2">
                {selectedAsset.type === 'IMAGE' && <ImageIcon className="w-4 h-4 text-emerald-400" />}
                {selectedAsset.type === 'VIDEO' && <Video className="w-4 h-4 text-emerald-400" />}
                {selectedAsset.type === 'MUSIC' && <Music className="w-4 h-4 text-emerald-400" />}
                <span className="text-xs font-bold text-zinc-200 tracking-wider uppercase">{selectedAsset.type} ASSET</span>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="p-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col items-center justify-center min-h-[300px] bg-zinc-950/50">
              {selectedAsset.status === 'FAILED' ? (
                <div className="text-center text-red-400 flex flex-col items-center gap-3">
                  <AlertCircle className="w-12 h-12 text-red-500/50" />
                  <p className="text-sm font-medium">Generation Failed</p>
                  <p className="text-xs text-zinc-500 max-w-[200px]">The AI engine encountered an error. You can request a refund below.</p>
                </div>
              ) : (
                <>
                  {selectedAsset.type === 'IMAGE' && (
                    <img src={selectedAsset.data} alt="Expanded Asset" className="w-full rounded-2xl shadow-xl border border-zinc-800" />
                  )}
                  {selectedAsset.type === 'MUSIC' && (
                    <div className="w-full flex flex-col items-center space-y-8 py-8">
                      <div className="p-8 bg-emerald-500/10 rounded-full border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                        <Music className="w-20 h-20 text-emerald-400" />
                      </div>
                      <audio controls autoPlay className="w-full px-4" src={selectedAsset.data} />
                    </div>
                  )}
                  {selectedAsset.type === 'VIDEO' && (
                    <video controls autoPlay className="w-full aspect-video rounded-2xl border border-zinc-800 shadow-xl bg-black" src={selectedAsset.data} />
                  )}
                </>
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 space-y-4">
              <p className="text-[11px] text-zinc-400 italic leading-relaxed px-1 max-h-20 overflow-y-auto custom-scrollbar">
                "{selectedAsset.prompt}"
              </p>
              
              <div className="flex gap-2">
                {selectedAsset.status === 'FAILED' ? (
                  <button 
                    onClick={() => handleRefund(selectedAsset)}
                    disabled={requesting === selectedAsset.id}
                    className="flex-1 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    {requesting === selectedAsset.id ? <Clock className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
                    {requesting === selectedAsset.id ? 'Requesting...' : 'Request Refund'}
                  </button>
                ) : (
                  <button 
                    onClick={() => downloadAsset(selectedAsset)}
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download / Share
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, FileText, Image as ImageIcon, Music, Video, Download, Trash2, Code, Loader2, XCircle, PlayCircle, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAccount } from 'wagmi';

export default function LibraryPage() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState('MEDIA');
  const [mediaFilter, setMediaFilter] = useState('ALL');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
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

          const deletedIds = JSON.parse(localStorage.getItem('masomind_deleted_assets') || '[]');

          const validAssets = data.transactions
            .filter(tx => (now - new Date(tx.created_at).getTime()) < SEVEN_DAYS_MS)
            .filter(tx => tx.status === 'COMPLETED' && tx.result_data) 
            .filter(tx => !deletedIds.includes(tx.tx_hash)) 
            .map(tx => ({
              id: tx.tx_hash,
              type: tx.service_type,
              category: tx.service_type === 'AUDIT' ? 'DOCUMENT' : 'MEDIA',
              data: tx.result_data,
              prompt: tx.prompt,
              timestamp: tx.created_at
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

  const deleteItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
    const deletedIds = JSON.parse(localStorage.getItem('masomind_deleted_assets') || '[]');
    localStorage.setItem('masomind_deleted_assets', JSON.stringify([...deletedIds, id]));
    if (selectedAsset?.id === id) setSelectedAsset(null);
  };

    // 🚀 SERVER-PROXY HIDDEN FORM FIX (Bypasses MiniPay Restrictions)
  const downloadAsset = async (item) => {
    try {
      if (item.type === 'AUDIT') {
        if (navigator.share) {
          await navigator.share({ title: 'MasoMind Security Audit', text: item.data });
        } else {
          navigator.clipboard.writeText(item.data);
          alert("Audit copied to clipboard!");
        }
        return;
      }

      // 🚀 NATIVE SUPABASE DOWNLOAD FOR IMAGES
      if (item.type === 'IMAGE') {
        let finalUrl = item.data;
        if (finalUrl.includes('supabase.co')) {
          finalUrl = finalUrl.includes('?') 
            ? `${finalUrl}&download=MasoMind-Premium.png` 
            : `${finalUrl}?download=MasoMind-Premium.png`;
        } else {
          finalUrl = `/api/download?url=${encodeURIComponent(item.data)}&type=IMAGE`;
        }

        const link = document.createElement('a');
        link.href = finalUrl;
        link.setAttribute('download', 'MasoMind-Premium.png');
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        return;
      }

      // 🚀 THE FIX FOR LIBRARY MEDIA DOWNLOADS
      if (item.data.startsWith('http')) {
        window.location.href = `/api/download?url=${encodeURIComponent(item.data)}&action=download`;
        return;
      }

      // Create a hidden form to submit the Base64 data directly to the Next.js server
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/download';

      const dataInput = document.createElement('input');
      dataInput.type = 'hidden';
      dataInput.name = 'fileData';
      dataInput.value = item.data;
      form.appendChild(dataInput);

      const typeInput = document.createElement('input');
      typeInput.type = 'hidden';
      typeInput.name = 'fileType';
      typeInput.value = item.type;
      form.appendChild(typeInput);

      document.body.appendChild(form);
      form.submit(); // Forces native mobile download via server headers
      document.body.removeChild(form);

    } catch (err) {
      console.error("Download action failed:", err);
      alert("Failed to initiate download.");
    }
  };

  const allMediaItems = items.filter(i => i.category === 'MEDIA');
  const filteredMediaItems = mediaFilter === 'ALL' 
    ? allMediaItems 
    : allMediaItems.filter(i => i.type === mediaFilter);

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

      <div className="w-full max-w-md mx-auto mb-4 flex gap-2 p-1 bg-zinc-900/50 border border-zinc-800 rounded-xl">
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

      {activeTab === 'MEDIA' && allMediaItems.length > 0 && (
        <div className="w-full max-w-md mx-auto mb-6 flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {['ALL', 'IMAGE', 'MUSIC', 'VIDEO'].map(filter => (
            <button 
              key={filter}
              onClick={() => setMediaFilter(filter)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider whitespace-nowrap transition-all border ${mediaFilter === filter ? 'bg-zinc-800 text-zinc-100 border-zinc-700' : 'bg-transparent text-zinc-500 border-zinc-800/50 hover:bg-zinc-900'}`}
            >
              {filter}
            </button>
          ))}
        </div>
      )}

      <main className="flex-1 w-full max-w-md mx-auto pb-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'MEDIA' && filteredMediaItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-center glass-panel rounded-3xl border border-zinc-800/50 p-8 mt-4">
                <ImageIcon className="w-10 h-10 text-zinc-600 mb-4" />
                <p className="text-sm text-zinc-400">No {mediaFilter !== 'ALL' ? mediaFilter.toLowerCase() : 'media'} assets found.</p>
                <p className="text-xs text-zinc-600 mt-2">Successful generations will sync across your devices here.</p>
              </div>
            )}

            {activeTab === 'DOCUMENT' && documentItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-center glass-panel rounded-3xl border border-zinc-800/50 p-8 mt-4">
                <FileText className="w-10 h-10 text-zinc-600 mb-4" />
                <p className="text-sm text-zinc-400">No recent documents found.</p>
                <p className="text-xs text-zinc-600 mt-2">Smart contract security audits will appear here.</p>
              </div>
            )}

            {activeTab === 'MEDIA' && filteredMediaItems.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {filteredMediaItems.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedAsset(item)}
                    className="group relative aspect-square bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800/80 cursor-pointer hover:border-emerald-500/50 transition-colors shadow-lg"
                  >
                    <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded border border-white/10 text-[9px] font-mono font-bold text-emerald-400 tracking-wider">
                      {item.type}
                    </div>

                                        {item.type === 'IMAGE' && (
                      <img 
                        src={item.data} 
                        className="w-full h-full object-cover" 
                        loading="lazy" 
                        onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1024"; }}
                      />
                    )}
                    {item.type === 'VIDEO' && (
                      <div className="w-full h-full relative">
                        {/* 🚀 PROXY STREAM FIX */}
                        <video 
                          src={item.data.startsWith('http') ? `/api/download?url=${encodeURIComponent(item.data)}&action=stream` : item.data} 
                          className="w-full h-full object-cover opacity-80" 
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                          <PlayCircle className="w-10 h-10 text-white shadow-2xl" />
                        </div>
                      </div>
                    )}
                    {item.type === 'MUSIC' && (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-500/5">
                        <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/20 mb-2">
                          <Music className="w-8 h-8 text-emerald-400" />
                        </div>
                      </div>
                    )}
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
                      <ReactMarkdown>{item.data}</ReactMarkdown>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => downloadAsset(item)} 
                    className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" /> Share MD
                  </button>
                  <button 
                    onClick={() => deleteItem(item.id)} 
                    className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all border border-red-500/20 flex items-center justify-center"
                    title="Remove from Vault"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </main>

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
                            {selectedAsset.type === 'IMAGE' && (
                <img 
                  src={selectedAsset.data} 
                  alt="Expanded Asset" 
                  className="w-full rounded-2xl shadow-xl border border-zinc-800" 
                  onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1024"; }}
                />
              )}
              {selectedAsset.type === 'MUSIC' && (
                <div className="w-full flex flex-col items-center space-y-8 py-8">
                  <div className="p-8 bg-emerald-500/10 rounded-full border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                    <Music className="w-20 h-20 text-emerald-400" />
                  </div>
                  {/* 🚀 PROXY STREAM FIX */}
                  <audio 
                    key={selectedAsset.data} 
                    controls 
                    autoPlay 
                    className="w-full px-4" 
                    src={selectedAsset.data.startsWith('http') ? `/api/download?url=${encodeURIComponent(selectedAsset.data)}&action=stream` : selectedAsset.data} 
                  />
                </div>
              )}
              {selectedAsset.type === 'VIDEO' && (
                {/* 🚀 PROXY STREAM FIX */}
                <video 
                  controls 
                  autoPlay 
                  className="w-full aspect-video rounded-2xl border border-zinc-800 shadow-xl bg-black" 
                  src={selectedAsset.data.startsWith('http') ? `/api/download?url=${encodeURIComponent(selectedAsset.data)}&action=stream` : selectedAsset.data} 
                />
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 space-y-4">
              <p className="text-[11px] text-zinc-400 italic leading-relaxed px-1 max-h-20 overflow-y-auto custom-scrollbar">
                "{selectedAsset.prompt}"
              </p>

              <div className="flex gap-2">
                <button 
                  onClick={() => downloadAsset(selectedAsset)}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download
                </button>

                <button 
                  onClick={() => deleteItem(selectedAsset.id)}
                  className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all border border-red-500/20 flex items-center justify-center"
                  title="Remove from Vault"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

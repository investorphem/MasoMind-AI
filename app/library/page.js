'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, FileText, Image as ImageIcon, Music, Video, Download, Trash2, Code, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAccount } from 'wagmi';

export default function LibraryPage() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState('MEDIA');
  const [items, setItems] = useState([]);
  const [requesting, setRequesting] = useState(null);

  useEffect(() => {
    const rawData = localStorage.getItem('masomind_library');
    if (rawData) {
      const parsedData = JSON.parse(rawData);
      // Auto-expire items older than 7 days (7 * 24 * 60 * 60 * 1000 = 604800000ms)
      const SEVEN_DAYS_MS = 604800000;
      const validItems = parsedData.filter(item => (Date.now() - item.timestamp) < SEVEN_DAYS_MS);
      
      setItems(validItems);

      // Clean up localStorage if items expired
      if (validItems.length !== parsedData.length) {
        localStorage.setItem('masomind_library', JSON.stringify(validItems));
      }
    }
  }, []);

  const handleRefund = async (item) => {
    if (!address) return;
    setRequesting(item.id);
    try {
      // Support both naming conventions just in case
      const hashToRefund = item.txHash || item.tx_hash; 
      
      const res = await fetch('/api/trigger-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: hashToRefund, userAddress: address })
      });
      
      if (res.ok) alert('Refund request submitted to MasoMind Treasury.');
      else alert('Failed to request refund. It may have already been processed.');
      
    } catch (err) {
      console.error(err);
    }
    setRequesting(null);
  };

  const deleteItem = (id) => {
    const updatedItems = items.filter(item => item.id !== id);
    setItems(updatedItems);
    localStorage.setItem('masomind_library', JSON.stringify(updatedItems));
  };

  const downloadAsset = async (item) => {
    try {
      let blob, extension;
      if (item.type === 'AUDIT') {
        blob = new Blob([item.data], { type: 'text/markdown' });
        extension = 'md';
      } else {
        const response = await fetch(item.data);
        blob = await response.blob();
        extension = item.type === 'MUSIC' ? 'mp3' : item.type === 'VIDEO' ? 'mp4' : 'jpg';
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `MasoMind-${item.type}-${item.id}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      if (item.type !== 'AUDIT') window.open(item.data, '_blank');
    }
  };

  const mediaItems = items.filter(i => i.category === 'MEDIA');
  const documentItems = items.filter(i => i.category === 'DOCUMENT');

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-zinc-100 font-sans p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#09090b] to-[#09090b]">

      {/* Header */}
      <header className="flex items-center justify-between py-4 mb-2 border-b border-white/5 pb-4 max-w-md mx-auto w-full">
        <Link href="/" className="flex items-center gap-2 p-2 bg-zinc-900/80 rounded-full border border-zinc-800 hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
        </Link>
        <div className="flex flex-col items-end">
          <h1 className="font-bold text-lg tracking-wider text-white">ASSET VAULT</h1>
          <p className="text-[10px] text-emerald-500/70 uppercase tracking-widest font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" /> 7-Day Retention
          </p>
        </div>
      </header>

      {/* Navigation Tabs */}
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

      {/* Main Vault Content */}
      <main className="flex-1 w-full max-w-md mx-auto">
        {activeTab === 'MEDIA' && mediaItems.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center glass-panel rounded-3xl border border-zinc-800/50 p-8">
            <ImageIcon className="w-10 h-10 text-zinc-600 mb-4" />
            <p className="text-sm text-zinc-400">No media assets found.</p>
            <p className="text-xs text-zinc-600 mt-2">Generated images, music, and videos will appear here.</p>
          </div>
        )}

        {activeTab === 'DOCUMENT' && documentItems.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center glass-panel rounded-3xl border border-zinc-800/50 p-8">
            <FileText className="w-10 h-10 text-zinc-600 mb-4" />
            <p className="text-sm text-zinc-400">No documents found.</p>
            <p className="text-xs text-zinc-600 mt-2">Smart contract security audits will appear here.</p>
          </div>
        )}

        {(activeTab === 'MEDIA' ? mediaItems : documentItems).map(item => (
          <div key={item.id} className="glass-panel rounded-3xl border border-zinc-800/80 p-5 space-y-4 mb-4 shadow-lg bg-zinc-900/40">
            <div className="flex items-center justify-between border-b border-zinc-800/50 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-1 bg-zinc-900 rounded border border-zinc-700 font-mono text-emerald-400 font-bold tracking-wider">
                  {item.type}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {new Date(item.timestamp).toLocaleDateString()}
                </span>
              </div>
              {item.status === 'FAILED' && (
                <button 
                  onClick={() => handleRefund(item)} 
                  className="text-[9px] font-bold text-amber-500 flex items-center gap-1 hover:text-amber-400 transition-colors px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20"
                >
                  {requesting === item.id ? <Clock className="w-3 h-3 animate-spin" /> : <AlertCircle className="w-3 h-3" />} 
                  {requesting === item.id ? 'Requesting...' : 'Request Refund'}
                </button>
              )}
            </div>

            <p className="text-xs text-zinc-300 line-clamp-3 italic leading-relaxed">
              "{item.prompt}"
            </p>

            {item.data ? (
              <div className="rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800/80 shadow-inner">
                {item.type === 'IMAGE' && (
                  <img src={item.data} className="w-full h-auto object-cover" alt="Generated Output" />
                )}
                {item.type === 'VIDEO' && (
                  <video src={item.data} controls className="w-full aspect-video bg-black" />
                )}
                {item.type === 'MUSIC' && (
                  <audio src={item.data} controls className="w-full p-4" />
                )}
                {item.type === 'AUDIT' && (
                  <div className="p-4 h-48 overflow-y-auto custom-scrollbar text-[10px]">
                    <div className="prose prose-invert prose-emerald max-w-none">
                      <ReactMarkdown>{item.data}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-red-400 text-xs border border-red-500/20 rounded-2xl bg-red-500/5 flex flex-col items-center gap-2">
                <AlertCircle className="w-6 h-6 text-red-500/50" />
                Generation Failed. Please request a refund above.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => downloadAsset(item)} 
                disabled={!item.data}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Download className="w-3.5 h-3.5" /> 
                {item.type === 'AUDIT' ? 'Save MD' : 'Download'}
              </button>
              <button 
                onClick={() => deleteItem(item.id)} 
                className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all border border-red-500/20 flex items-center justify-center"
                title="Delete from Vault"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

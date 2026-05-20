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
      const SEVEN_DAYS_MS = 604800000;
      const validItems = parsedData.filter(item => (Date.now() - item.timestamp) < SEVEN_DAYS_MS);
      setItems(validItems);
    }
  }, []);

  const handleRefund = async (item) => {
    if (!address) return;
    setRequesting(item.id);
    try {
      const res = await fetch('/api/trigger-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: item.txHash, userAddress: address })
      });
      if (res.ok) alert('Refund request submitted to MasoMind Treasury.');
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

      <div className="w-full max-w-md mx-auto mb-6 flex gap-2 p-1 bg-zinc-900/50 border border-zinc-800 rounded-xl">
        <button onClick={() => setActiveTab('MEDIA')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'MEDIA' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500'}`}>Media</button>
        <button onClick={() => setActiveTab('DOCUMENT')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'DOCUMENT' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500'}`}>Documents</button>
      </div>

      <main className="flex-1 w-full max-w-md mx-auto">
        {(activeTab === 'MEDIA' ? mediaItems : documentItems).map(item => (
          <div key={item.id} className="glass-panel rounded-2xl border border-zinc-800 p-4 space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] px-2 py-1 bg-zinc-900 rounded border border-zinc-700 font-mono text-emerald-400">{item.type}</span>
              {item.status === 'FAILED' && (
                <button onClick={() => handleRefund(item)} className="text-[9px] font-bold text-amber-500 flex items-center gap-1">
                  {requesting === item.id ? '...' : <AlertCircle className="w-3 h-3" />} Request Refund
                </button>
              )}
            </div>

            <p className="text-xs text-zinc-300 line-clamp-2 italic">"{item.prompt}"</p>

            {item.data ? (
              <div className="rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
                {item.type === 'IMAGE' && <img src={item.data} className="w-full h-auto" />}
                {item.type === 'VIDEO' && <video src={item.data} controls className="w-full" />}
                {item.type === 'MUSIC' && <audio src={item.data} controls className="w-full p-4" />}
                {item.type === 'AUDIT' && <div className="p-4 text-[10px]"><ReactMarkdown>{item.data}</ReactMarkdown></div>}
              </div>
            ) : (
              <div className="p-4 text-center text-red-400 text-xs border border-red-500/20 rounded-lg bg-red-500/5">
                Generation Failed. Please request a refund.
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => downloadAsset(item)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium">Download</button>
              <button onClick={() => deleteItem(item.id)} className="p-2 bg-red-500/10 text-red-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

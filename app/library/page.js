'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, FileText, Image as ImageIcon, Music, Video, Download, Trash2, Code } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState('MEDIA');
  const [items, setItems] = useState([]);

  useEffect(() => {
    const rawData = localStorage.getItem('masomind_library');
    if (rawData) {
      const parsedData = JSON.parse(rawData);
      
      // Auto-expire items older than 7 days (7 * 24 * 60 * 60 * 1000)
      const SEVEN_DAYS_MS = 604800000;
      const validItems = parsedData.filter(item => (Date.now() - item.timestamp) < SEVEN_DAYS_MS);
      
      setItems(validItems);
      
      // Update local storage if any items expired
      if (validItems.length !== parsedData.length) {
        localStorage.setItem('masomind_library', JSON.stringify(validItems));
      }
    }
  }, []);

  const deleteItem = (id) => {
    const updatedItems = items.filter(item => item.id !== id);
    setItems(updatedItems);
    localStorage.setItem('masomind_library', JSON.stringify(updatedItems));
  };

  const downloadAsset = async (item) => {
    try {
      let blob;
      let extension;

      if (item.type === 'AUDIT') {
        blob = new Blob([item.data], { type: 'text/markdown' });
        extension = 'md';
      } else {
        const response = await fetch(item.data);
        blob = await response.blob();
        extension = 'jpg';
        if (item.type === 'MUSIC') extension = 'mp3';
        if (item.type === 'VIDEO') extension = 'mp4';
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
      console.error("Download failed:", err);
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

      {/* Tabs */}
      <div className="w-full max-w-md mx-auto mb-6 flex gap-2 p-1 bg-zinc-900/50 border border-zinc-800 rounded-xl">
        <button onClick={() => setActiveTab('MEDIA')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'MEDIA' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <ImageIcon className="w-4 h-4" /> Media
        </button>
        <button onClick={() => setActiveTab('DOCUMENT')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'DOCUMENT' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <FileText className="w-4 h-4" /> Documents
        </button>
      </div>

      {/* Content */}
      <main className="flex-1 w-full max-w-md mx-auto">
        
        {/* MEDIA TAB */}
        {activeTab === 'MEDIA' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {mediaItems.length === 0 ? (
              <div className="p-8 text-center glass-panel rounded-2xl border border-zinc-800/50">
                <ImageIcon className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">No media assets generated.</p>
              </div>
            ) : (
              mediaItems.map(item => (
                <div key={item.id} className="glass-panel rounded-2xl border border-zinc-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] px-2 py-1 bg-zinc-900 rounded border border-zinc-700 font-mono text-emerald-400 flex items-center gap-1">
                      {item.type === 'IMAGE' && <ImageIcon className="w-3 h-3" />}
                      {item.type === 'MUSIC' && <Music className="w-3 h-3" />}
                      {item.type === 'VIDEO' && <Video className="w-3 h-3" />}
                      {item.type}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">{new Date(item.timestamp).toLocaleDateString()}</span>
                  </div>
                  
                  <p className="text-xs text-zinc-300 line-clamp-2 italic">"{item.prompt}"</p>

                  <div className="rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
                    {item.type === 'IMAGE' && <img src={item.data} className="w-full h-auto" alt="AI Generated" />}
                    {item.type === 'VIDEO' && <video src={item.data} controls className="w-full" />}
                    {item.type === 'MUSIC' && <audio src={item.data} controls className="w-full p-4" />}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => downloadAsset(item)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium text-zinc-200 transition-colors">
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'DOCUMENT' && (
          <div className="space-y-4 animate-in fade-in duration-300">
             {documentItems.length === 0 ? (
              <div className="p-8 text-center glass-panel rounded-2xl border border-zinc-800/50">
                <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">No audits or documents generated.</p>
              </div>
            ) : (
              documentItems.map(item => (
                <div key={item.id} className="glass-panel rounded-2xl border border-zinc-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/20 font-mono text-emerald-400 flex items-center gap-1">
                      <Code className="w-3 h-3" /> AUDIT
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">{new Date(item.timestamp).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="h-32 overflow-y-auto custom-scrollbar bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-[10px]">
                    <div className="prose prose-invert prose-emerald max-w-none prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0">
                      <ReactMarkdown>{item.data}</ReactMarkdown>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => downloadAsset(item)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg text-xs font-medium text-emerald-400 border border-emerald-500/20 transition-colors">
                      <Download className="w-3.5 h-3.5" /> Save MD
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

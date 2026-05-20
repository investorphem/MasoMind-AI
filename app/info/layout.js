'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, BookOpen, HelpCircle, Shield, FileText, CheckCircle2 } from 'lucide-react';

export default function InfoLayout({ children }) {
  const pathname = usePathname();

  const tabs = [
    { id: '/info', icon: <HelpCircle className="w-4 h-4" />, label: 'FAQ' },
    { id: '/info/docs', icon: <BookOpen className="w-4 h-4" />, label: 'Docs' },
    { id: '/info/privacy', icon: <Shield className="w-4 h-4" />, label: 'Privacy' },
    { id: '/info/terms', icon: <FileText className="w-4 h-4" />, label: 'Terms' }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-zinc-100 font-sans p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#09090b] to-[#09090b]">
      
      {/* Header */}
      <header className="flex items-center justify-between py-4 mb-2 border-b border-white/5 pb-4">
        <Link href="/" className="flex items-center gap-2 p-2 bg-zinc-900/80 rounded-full border border-zinc-800 hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
        </Link>
        <div className="flex flex-col items-end">
          <h1 className="font-bold text-lg tracking-wider text-white">RESOURCES</h1>
          <p className="text-[10px] text-emerald-500/70 uppercase tracking-widest font-mono">Platform Information</p>
        </div>
      </header>

      {/* Tab Navigation (Using Next.js Links instead of State) */}
      <div className="w-full max-w-md mx-auto mb-6 flex gap-2 p-1 bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-x-auto custom-scrollbar">
        {tabs.map((tab) => {
          const isActive = pathname === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.id}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                isActive 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              {tab.icon} {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Content Area (Injects the child pages here) */}
      <main className="flex-1 w-full max-w-md mx-auto relative glass-panel rounded-3xl border border-zinc-800/80 p-6 bg-zinc-950/80 overflow-y-auto mb-6">
        {children}
      </main>

      {/* Masonode Signature Footer */}
      <footer className="w-full max-w-md mx-auto flex flex-col items-center justify-center pb-8 pt-4">
        <div className="flex items-center gap-1.5 mb-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-bold tracking-widest text-zinc-300 uppercase">Masonode Technologies Limited</span>
        </div>
        <p className="text-[9px] text-zinc-600 font-mono tracking-wider">Registered Corporate Entity • Web3 Infrastructure</p>
      </footer>

    </div>
  );
}

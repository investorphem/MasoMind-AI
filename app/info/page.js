'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, HelpCircle, Shield, FileText, CheckCircle2 } from 'lucide-react';

export default function InfoHub() {
  const [activeTab, setActiveTab] = useState('FAQ');

  const tabs = [
    { id: 'FAQ', icon: <HelpCircle className="w-4 h-4" />, label: 'FAQ' },
    { id: 'DOCS', icon: <BookOpen className="w-4 h-4" />, label: 'Docs' },
    { id: 'PRIVACY', icon: <Shield className="w-4 h-4" />, label: 'Privacy' },
    { id: 'TERMS', icon: <FileText className="w-4 h-4" />, label: 'Terms' }
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

      {/* Tab Navigation */}
      <div className="w-full max-w-md mx-auto mb-6 flex gap-2 p-1 bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-x-auto custom-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <main className="flex-1 w-full max-w-md mx-auto relative glass-panel rounded-3xl border border-zinc-800/80 p-6 bg-zinc-950/80 overflow-y-auto mb-6">
        
        {activeTab === 'FAQ' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-sm font-bold text-emerald-400 border-b border-zinc-800 pb-2">Frequently Asked Questions</h2>
            
            <div>
              <h3 className="text-xs font-bold text-zinc-200 mb-1">What is MasoMind?</h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed">MasoMind is a decentralized Artificial Intelligence suite. It allows users to generate high-fidelity images, music, videos, and smart contract audits by paying natively with Celo ecosystem stablecoins.</p>
            </div>
            
            <div>
              <h3 className="text-xs font-bold text-zinc-200 mb-1">Which tokens are supported?</h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed">We currently support cUSD, USDC, and USDT on the Celo Mainnet. Our multi-token router handles all backend conversions automatically.</p>
            </div>

            <div>
              <h3 className="text-xs font-bold text-zinc-200 mb-1">What happens if a generation fails?</h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed">Your funds are completely safe. MasoMind features an Auto-Recovery Vault. If your payment succeeds but the AI times out, simply tap "Retry API" on the home screen to finish the generation without paying again.</p>
            </div>
          </div>
        )}

        {activeTab === 'DOCS' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-sm font-bold text-emerald-400 border-b border-zinc-800 pb-2">Platform Documentation</h2>
            
            <div>
              <h3 className="text-xs font-bold text-zinc-200 mb-1">Smart Contract Architecture</h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">The MasoMindV2 router is an immutable gateway deployed on Celo Mainnet. It utilizes strict parameter decoding to verify the precise stablecoin, amount, and intent type before authorizing API access.</p>
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800 text-[9px] font-mono text-emerald-500/70">
                Contract: 0xf5e6bff6cD35833FB9509fd081E5Ca9973fD132f
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-zinc-200 mb-1">AI Engines</h3>
              <ul className="text-[11px] text-zinc-400 leading-relaxed space-y-1 list-disc pl-4">
                <li><strong className="text-zinc-300">Image:</strong> Flux.1 HD (1024x1024)</li>
                <li><strong className="text-zinc-300">Audit:</strong> Gemini 2.5 Flash</li>
                <li><strong className="text-zinc-300">Music:</strong> Google Lyria 3</li>
                <li><strong className="text-zinc-300">Video:</strong> Google Veo 3.1</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'PRIVACY' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-sm font-bold text-emerald-400 border-b border-zinc-800 pb-2">Privacy Policy</h2>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              We respect the ethos of Web3. MasoMind operates on a strict minimal-data protocol. 
            </p>
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-200">Data Collection</h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed">We do not require email addresses, names, or traditional accounts. We only log your public wallet address and the transaction hashes required to provide your generated AI assets via the Enterprise Ledger.</p>
              
              <h3 className="text-xs font-bold text-zinc-200">Data Storage</h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed">Prompts and generated media are stored securely in our decentralized vault solely to allow you to retrieve your historical invocations. We do not sell your generation data to third parties.</p>
            </div>
          </div>
        )}

        {activeTab === 'TERMS' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-sm font-bold text-emerald-400 border-b border-zinc-800 pb-2">Terms of Service</h2>
            <div className="space-y-3">
              <p className="text-[11px] text-zinc-400 leading-relaxed">By connecting your Web3 wallet and utilizing the MasoMind protocol, you agree to the following terms:</p>
              
              <h3 className="text-xs font-bold text-zinc-200">Immutable Payments</h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed">All blockchain transactions are final and immutable. Refunds cannot be issued for stablecoin payments successfully verified by the Celo network. In the event of an API failure, our Auto-Recovery system will honor your payment.</p>
              
              <h3 className="text-xs font-bold text-zinc-200">Content Restrictions</h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed">Users are strictly prohibited from utilizing the AI engines to generate illegal, non-consensual, or highly malicious content. The backend providers enforce automated safety filters.</p>
            </div>
          </div>
        )}
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

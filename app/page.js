'use client';
import { useState, useEffect } from 'react';
import { useAccount, useConnect, useWriteContract } from 'wagmi';
import { createPublicClient, custom, parseUnits, formatUnits } from 'viem';
import { celo } from 'viem/chains';
import { Sparkles, Image as ImageIcon, Loader2, Fingerprint, Download, Code, ChevronDown, Music, Video, RefreshCw, XCircle, Share2, Copy, CheckCircle } from 'lucide-react';
import { useMiniPay } from '../hooks/useMiniPay';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

// Define the stablecoins on Celo Mainnet
const TOKENS = {
  cUSD: { address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18, symbol: 'cUSD' },
  USDC: { address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', decimals: 6, symbol: 'USDC' },
  USDT: { address: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e', decimals: 6, symbol: 'USDT' }
};

export default function MasoMindApp() {
  const isMiniPay = useMiniPay();
  const { isConnected, address } = useAccount(); 
  const { connect, connectors } = useConnect();
  const { writeContractAsync, isPending } = useWriteContract();

  const [mode, setMode] = useState('IMAGE'); 
  const [activeToken, setActiveToken] = useState('USDT'); 
  const [balances, setBalances] = useState({ cUSD: '0.00', USDC: '0.00', USDT: '0.00' });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); 

  const [prompt, setPrompt] = useState('');
  const [resultData, setResultData] = useState(null); 
  const [status, setStatus] = useState('');
  const [copied, setCopied] = useState(false);

  const [pendingState, setPendingState] = useState(null);

  const CONTRACT_ADDRESS = '0x1d7c2c4c5e41dcdbe90b03d71399383dd1464717';

  useEffect(() => {
    if (!address) return;
    const fetchBalances = async () => {
      const publicClient = createPublicClient({ chain: celo, transport: custom(window.ethereum || window.parent?.ethereum) });
      const newBalances = { ...balances };

      for (const tokenKey of Object.keys(TOKENS)) {
        const token = TOKENS[tokenKey];
        try {
          const bal = await publicClient.readContract({
            address: token.address,
            abi: [{"name":"balanceOf","type":"function","stateMutability":"view","inputs":[{"name":"account","type":"address"}],"outputs":[{"name":"","type":"uint256"}]}],
            functionName: 'balanceOf',
            args: [address],
          });
          newBalances[tokenKey] = Number(formatUnits(bal, token.decimals)).toFixed(2);
        } catch (e) {
          console.error(`Failed to fetch ${tokenKey}`);
        }
      }
      setBalances(newBalances);
    };
    fetchBalances();
  }, [address]);

  useEffect(() => {
    const hash = localStorage.getItem('pendingTxHash');
    const savedPrompt = localStorage.getItem('pendingPrompt');
    const savedMode = localStorage.getItem('pendingMode');

    if (hash && savedPrompt && savedMode) {
      setPendingState({ hash, prompt: savedPrompt, mode: savedMode });
      setPrompt(savedPrompt);
      setMode(savedMode);
    }
  }, []);

  const copyToClipboard = () => {
    if (!resultData) return;
    navigator.clipboard.writeText(resultData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // FORCED BLOB DOWNLOAD (Handles Media & Markdown Audits)
  const downloadAsset = async () => {
    if (!resultData) return;

    try {
      let blob;
      let extension;
      
      if (mode === 'AUDIT') {
        // Create a text/markdown blob for the audit
        blob = new Blob([resultData], { type: 'text/markdown' });
        extension = 'md';
      } else {
        // Fetch media blob
        const response = await fetch(resultData);
        blob = await response.blob();
        extension = 'jpg';
        if (mode === 'MUSIC') extension = 'mp3';
        if (mode === 'VIDEO') extension = 'mp4';
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `MasoMind-${mode}-${Date.now()}.${extension}`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Blob download failed:", err);
      // Fallback
      if (mode !== 'AUDIT') window.open(resultData, '_blank');
    }
  };

  const invokeAPI = async (targetPrompt, targetHash, targetMode) => {
    setStatus(`Processing AI ${targetMode} Engine...`);
    let endpoint = '/api/generate-image';
    if (targetMode === 'AUDIT') endpoint = '/api/audit-code';
    if (targetMode === 'MUSIC') endpoint = '/api/generate-music';
    if (targetMode === 'VIDEO') endpoint = '/api/generate-video';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: targetPrompt, txHash: targetHash }) 
      });

      const data = await res.json();

      if (data.imageUrl || data.report || data.mediaUrl) {
        setResultData(data.imageUrl || data.report || data.mediaUrl);
        localStorage.removeItem('pendingTxHash');
        localStorage.removeItem('pendingPrompt');
        localStorage.removeItem('pendingMode');
        setPendingState(null);
      } else {
         setStatus(data.error || 'AI limits reached or API failed. You can retry.');
         setTimeout(() => setStatus(''), 5000);
      }
    } catch (err) {
      console.error(err);
      setStatus('Network timeout. Your funds are safe, please retry.');
      setTimeout(() => setStatus(''), 5000);
    }
    setStatus('');
  };

  const executeService = async () => {
    if (!prompt || !address) return;
    setResultData(null);

    if (pendingState) {
      await invokeAPI(pendingState.prompt, pendingState.hash, pendingState.mode);
      return;
    }

    const token = TOKENS[activeToken];
    let priceStr = '0.05'; 
    if (mode === 'IMAGE') priceStr = '0.10';
    if (mode === 'MUSIC') priceStr = '0.50';
    if (mode === 'VIDEO') priceStr = '1.00';

    const amountToCharge = parseUnits(priceStr, token.decimals);

    try {
      const publicClient = createPublicClient({ chain: celo, transport: custom(window.ethereum || window.parent?.ethereum) });

      if (Number(balances[activeToken]) < Number(priceStr)) {
        setStatus(`Low Balance: You need ${priceStr} ${activeToken}.`);
        setTimeout(() => setStatus(''), 5000);
        return; 
      }

      setStatus(`Checking ${activeToken} permissions...`);
      const allowance = await publicClient.readContract({
        address: token.address,
        abi: [{"name":"allowance","type":"function","stateMutability":"view","inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"outputs":[{"name":"","type":"uint256"}]}],
        functionName: 'allowance',
        args: [address, CONTRACT_ADDRESS],
      });

      if (allowance < amountToCharge) {
        setStatus(`Approving ${activeToken} limit...`);
        const approveAmount = parseUnits('10.0', token.decimals); 
        const approveHash = await writeContractAsync({
          address: token.address,
          abi: [{"name":"approve","type":"function","stateMutability":"nonpayable","inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}]}],
          functionName: 'approve',
          args: [CONTRACT_ADDRESS, approveAmount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setStatus(`Executing ${priceStr} ${activeToken} Payment...`);
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: [{
          "name": "executeService",
          "type": "function",
          "stateMutability": "nonpayable",
          "inputs": [
            { "name": "token", "type": "address" },
            { "name": "amount", "type": "uint256" },
            { "name": "prompt", "type": "string" },
            { "name": "serviceType", "type": "string" }
          ]
        }],
        functionName: 'executeService',
        args: [token.address, amountToCharge, prompt, mode],
      });

      setStatus('Confirming transaction on chain...');
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      localStorage.setItem('pendingTxHash', txHash);
      localStorage.setItem('pendingPrompt', prompt);
      localStorage.setItem('pendingMode', mode);
      setPendingState({ hash: txHash, prompt, mode });

      await invokeAPI(prompt, txHash, mode);

    } catch (err) {
      console.error(err);
      setStatus('Transaction rejected or failed.');
      setTimeout(() => setStatus(''), 4000);
    }
  };

  const clearPendingState = () => {
    localStorage.removeItem('pendingTxHash');
    localStorage.removeItem('pendingPrompt');
    localStorage.removeItem('pendingMode');
    setPendingState(null);
    setPrompt('');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-zinc-100 font-sans p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#09090b] to-[#09090b]">

      <header className="flex flex-col gap-4 py-4 px-2 mb-2 border-b border-white/5 pb-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wider text-white flex items-center gap-2">
                MASOMIND
                {isConnected && (
                  <Link href="/dashboard" className="px-2 py-0.5 bg-zinc-800 rounded text-[10px] text-emerald-400 hover:bg-zinc-700 transition-colors border border-zinc-700">Ledger</Link>
                )}
              </h1>
              <p className="text-[10px] text-emerald-500/70 uppercase tracking-widest font-mono">Enterprise Suite</p>
            </div>
          </div>

          {!isMiniPay && !isConnected ? (
             <button 
               onClick={() => {
                 const hasInjectedWallet = typeof window !== 'undefined' && window.ethereum;
                 const targetConnector = hasInjectedWallet 
                   ? connectors.find(c => c.id === 'injected') 
                   : connectors.find(c => c.id === 'walletConnect');

                 if (targetConnector) connect({ connector: targetConnector });
               }} 
               className="flex items-center gap-2 glass-panel hover:bg-zinc-800 text-white px-4 py-2 rounded-full text-xs font-medium shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all border border-zinc-800"
             >
               <Fingerprint className="w-3 h-3 text-emerald-400" /> Connect Wallet
             </button>
          ) : (
            <div className="relative">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 rounded-full px-3 py-1.5 focus:border-emerald-500 transition-all shadow-lg shadow-black/50 hover:bg-zinc-800"
              >
                <span className="font-mono font-bold">{activeToken}</span>
                <span className="text-emerald-500/70 font-mono">({balances[activeToken]})</span>
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />}

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-[#09090b] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50 glass-panel">
                  {Object.keys(TOKENS).map((token) => (
                    <button key={token} onClick={() => { setActiveToken(token); setIsDropdownOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 text-xs hover:bg-zinc-800/80 transition-colors ${activeToken === token ? 'bg-zinc-800/50 border-l-2 border-emerald-500' : 'border-l-2 border-transparent'}`}>
                      <span className={`font-mono font-bold ${activeToken === token ? 'text-emerald-400' : 'text-zinc-300'}`}>{token}</span>
                      <span className="text-zinc-500 font-mono">{balances[token]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {!pendingState && (
          <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-900/50 border border-zinc-800 rounded-xl w-full max-w-md mx-auto">
            <button onClick={() => { setMode('IMAGE'); setResultData(null); }} className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-all ${mode === 'IMAGE' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}><ImageIcon className="w-4 h-4" /> Image</button>
            <button onClick={() => { setMode('AUDIT'); setResultData(null); }} className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-all ${mode === 'AUDIT' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}><Code className="w-4 h-4" /> Audit</button>
            <button onClick={() => { setMode('MUSIC'); setResultData(null); }} className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-all ${mode === 'MUSIC' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}><Music className="w-4 h-4" /> Music</button>
            <button onClick={() => { setMode('VIDEO'); setResultData(null); }} className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-all ${mode === 'VIDEO' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}><Video className="w-4 h-4" /> Video</button>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto">
        {resultData ? (
          <>
            {mode === 'IMAGE' && (
              <div className="relative p-1 rounded-3xl bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-2xl w-full aspect-square group">
                <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full mix-blend-overlay"></div>
                <img src={resultData} alt="AI Canvas" className="w-full h-full object-cover rounded-[22px] relative z-10" />
                <button onClick={downloadAsset} className="absolute bottom-4 right-4 z-20 glass-panel bg-black/50 hover:bg-emerald-500/80 border border-white/10 p-3 rounded-full shadow-lg transition-all flex items-center justify-center">
                  <Download className="w-5 h-5 text-white" />
                </button>
              </div>
            )}
            
            {/* NEW ENTERPRISE AUDIT UI */}
            {mode === 'AUDIT' && (
              <div className="w-full flex flex-col h-[450px] rounded-3xl glass-panel border border-zinc-800/50 shadow-2xl relative overflow-hidden bg-zinc-950/90">
                
                {/* Fixed Top Action Bar */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/80">
                  <div className="flex items-center gap-2">
                    <Code className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="text-xs font-bold text-zinc-100 tracking-wider">SECURITY REPORT</h3>
                      <p className="text-[9px] text-zinc-500 font-mono">Gemini 2.5 Flash</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={copyToClipboard} 
                      className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors text-xs font-medium text-zinc-300"
                    >
                      {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button 
                      onClick={downloadAsset} 
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors text-xs font-medium text-emerald-400"
                    >
                      <Download className="w-3.5 h-3.5" /> MD
                    </button>
                  </div>
                </div>

                {/* Rendered Markdown Area */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                  <div className="prose prose-invert prose-emerald max-w-none prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 prose-headings:text-zinc-100 prose-a:text-emerald-400 prose-code:text-emerald-300 text-sm leading-relaxed">
                    <ReactMarkdown>{resultData}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {mode === 'MUSIC' && (
              <div className="w-full p-8 rounded-3xl glass-panel border border-zinc-800/50 flex flex-col items-center justify-center space-y-6 shadow-2xl bg-gradient-to-b from-zinc-900 to-zinc-950">
                <div className="p-4 bg-emerald-500/10 rounded-full border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                  <Music className="w-12 h-12 text-emerald-400" />
                </div>
                <audio controls className="w-full" src={resultData}>
                  Your browser does not support the audio element.
                </audio>
                <button onClick={downloadAsset} className="w-full py-3 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> Download Track
                </button>
              </div>
            )}
            {mode === 'VIDEO' && (
              <div className="relative p-1 rounded-3xl bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-2xl w-full aspect-video group overflow-hidden">
                <video controls autoPlay className="w-full h-full object-cover rounded-[22px] relative z-10" src={resultData} />
                <button onClick={downloadAsset} className="absolute top-4 right-4 z-20 glass-panel bg-black/50 hover:bg-emerald-500/80 border border-white/10 p-3 rounded-full shadow-lg transition-all flex items-center justify-center">
                  <Download className="w-5 h-5 text-white" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="w-full aspect-square rounded-3xl glass-panel border border-zinc-800/50 flex flex-col items-center justify-center p-8 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent"></div>

            {isPending || status ? (
              <div className="space-y-4 flex flex-col items-center relative z-10">
                <div className="p-4 bg-zinc-900 rounded-full border border-zinc-800 shadow-inner">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                </div>
                <p className="text-sm text-zinc-400 font-medium tracking-wide text-center">{status || 'Processing...'}</p>
              </div>
            ) : pendingState ? (
               <div className="relative z-10 flex flex-col items-center w-full">
                  <div className="p-4 bg-amber-500/10 rounded-full border border-amber-500/20 mb-4 shadow-inner">
                    <RefreshCw className="w-10 h-10 text-amber-500" />
                  </div>
                  <h3 className="text-amber-400 font-bold mb-2 tracking-wide text-sm uppercase">Unfinished Generation</h3>
                  <p className="text-xs text-zinc-400 text-center mb-6 px-4">
                    The payment processed, but AI failed to complete. Retry below without paying again.
                  </p>
               </div>
            ) : (
              <div className="relative z-10 flex flex-col items-center">
                <div className="p-5 bg-zinc-900 rounded-2xl border border-zinc-800 mb-4 shadow-inner">
                  {mode === 'IMAGE' && <ImageIcon className="w-10 h-10 text-zinc-600" />}
                  {mode === 'AUDIT' && <Code className="w-10 h-10 text-zinc-600" />}
                  {mode === 'MUSIC' && <Music className="w-10 h-10 text-zinc-600" />}
                  {mode === 'VIDEO' && <Video className="w-10 h-10 text-zinc-600" />}
                </div>
                <h3 className="text-zinc-300 font-medium mb-1">
                  {mode === 'IMAGE' && 'Generate Asset'}
                  {mode === 'AUDIT' && 'Smart Contract Audit'}
                  {mode === 'MUSIC' && 'AI Music Studio'}
                  {mode === 'VIDEO' && 'AI Video Engine'}
                </h3>
                <p className="text-xs text-zinc-600 max-w-[240px]">
                  {mode === 'IMAGE' && 'Enter an intent below to generate high-fidelity assets.'}
                  {mode === 'AUDIT' && 'Upload Solidity code for an AI security and gas audit.'}
                  {mode === 'MUSIC' && 'Describe the genre, tempo, and mood for a GameFi audio track.'}
                  {mode === 'VIDEO' && 'Describe a scene or provide a script for video generation.'}
                </p>
                <span className="mt-4 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-mono text-emerald-500/70">
                  Cost: {mode === 'IMAGE' ? '0.10' : mode === 'MUSIC' ? '0.50' : mode === 'VIDEO' ? '1.00' : '0.05'} {activeToken}
                </span>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="w-full max-w-md mx-auto mt-8 mb-4">
        <div className="relative flex items-center glass-panel rounded-2xl shadow-2xl p-1">
          {mode === 'AUDIT' ? (
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Paste contract code..."
              rows={2}
              disabled={!!pendingState}
              className="w-full pl-4 pr-32 py-3 bg-transparent focus:outline-none text-sm text-zinc-200 placeholder:text-zinc-600 resize-none disabled:opacity-50"
            />
          ) : (
            <input 
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={!!pendingState}
              placeholder={
                mode === 'IMAGE' ? "Initialize intent..." :
                mode === 'MUSIC' ? "e.g., Upbeat cyberpunk synthwave..." :
                "e.g., A neon cityscape cinematic pan..."
              }
              className="w-full pl-4 pr-32 py-4 bg-transparent focus:outline-none text-sm text-zinc-200 placeholder:text-zinc-600 disabled:opacity-50"
            />
          )}

          {pendingState && (
            <button 
              onClick={clearPendingState}
              className="absolute right-28 p-2 text-zinc-500 hover:text-red-400 transition-colors"
              title="Discard Recovery"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}

          <button 
            onClick={executeService}
            disabled={!prompt || isPending || status !== ''}
            className={`absolute right-2 top-2 bottom-2 px-5 font-bold text-xs rounded-xl transition-all disabled:opacity-30 flex items-center justify-center ${pendingState ? 'bg-amber-500 hover:bg-amber-400 text-zinc-900 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]'}`}
          >
            {pendingState ? 'Retry API' : 'Execute'}
          </button>
        </div>
      </footer>
    </div>
  );
}

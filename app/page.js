'use client';
import { useState, useEffect } from 'react';
import { useAccount, useConnect, useWriteContract } from 'wagmi';
import { createPublicClient, custom, http, parseUnits, formatUnits } from 'viem'; 
import { celo } from 'viem/chains';
import { Image as ImageIcon, Loader2, Fingerprint, Download, Code, ChevronDown, Music, Video, RefreshCw, XCircle, Share2, Copy, CheckCircle, Library, List, AlertCircle } from 'lucide-react';
import { useMiniPay } from '../hooks/useMiniPay';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

// Define the stablecoins on Celo Mainnet
const TOKENS = {
  cUSD: { address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18, symbol: 'cUSD' },
  USDC: { address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', decimals: 6, symbol: 'USDC' },
  USDT: { address: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e', decimals: 6, symbol: 'USDT' }
};

const PLACEHOLDERS = {
  IMAGE: [
    "A neon cyberpunk cityscape at midnight...",
    "A photorealistic portrait of an astronaut...",
    "Isometric 3D rendering of a smart contract vault...",
    "A cinematic shot of a futuristic sports car..."
  ],
  AUDIT: [
    "Paste your ERC20 smart contract here...",
    "Upload staking logic for reentrancy checks...",
    "Paste Solidity code for gas optimization analysis...",
    "Input multi-sig wallet code for a security review..."
  ],
  MUSIC: [
    "An upbeat synthwave track for a racing game...",
    "A lo-fi chill hop beat with soft piano...",
    "Cinematic orchestral music for a boss battle...",
    "A fast-paced electronic dance track..."
  ],
  VIDEO: [
    "A cinematic drone shot over a glowing forest...",
    "A 3D animation of a futuristic city building...",
    "A cyberpunk character walking in the rain...",
    "A time-lapse of a starry night sky over mountains..."
  ]
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

  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);
  const [placeholderText, setPlaceholderText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // 🚀 PREMIUM NOTIFICATION STATE
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const CONTRACT_ADDRESS = '0xf5e6bff6cD35833FB9509fd081E5Ca9973fD132f';

  // 🚀 CUSTOM TOAST FUNCTION
  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: 'success' }), 4000);
  };

  // Token Balance Fetching
  useEffect(() => {
    if (!address) return;
    const fetchBalances = async () => {
      const publicClient = createPublicClient({ 
        chain: celo, 
        transport: http() 
      });
      
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
          console.error(`Failed to fetch ${tokenKey}`, e);
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

  useEffect(() => {
    setCurrentPlaceholderIndex(0);
    setPlaceholderText('');
    setIsDeleting(false);
  }, [mode]);

  useEffect(() => {
    if (pendingState || prompt.length > 0) return;

    const currentExamples = PLACEHOLDERS[mode];
    const fullText = currentExamples[currentPlaceholderIndex];

    let typingSpeed = isDeleting ? 30 : 60;

    const timer = setTimeout(() => {
      if (!isDeleting && placeholderText === fullText) {
        setTimeout(() => setIsDeleting(true), 2500);
      } else if (isDeleting && placeholderText === '') {
        setIsDeleting(false);
        setCurrentPlaceholderIndex((prev) => (prev + 1) % currentExamples.length);
      } else {
        setPlaceholderText(
          isDeleting 
            ? fullText.substring(0, placeholderText.length - 1)
            : fullText.substring(0, placeholderText.length + 1)
        );
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [placeholderText, isDeleting, mode, currentPlaceholderIndex, pendingState, prompt]);

  const copyToClipboard = () => {
    if (!resultData) return;
    navigator.clipboard.writeText(resultData);
    setCopied(true);
    showToast("Audit copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

    const downloadAsset = async () => {
    if (!resultData) return;
    try {
      // 1. Text/Audit Download
      if (mode === 'AUDIT') {
        if (navigator.share) {
          await navigator.share({ title: 'MasoMind Security Audit', text: resultData });
        } else {
          navigator.clipboard.writeText(resultData);
          showToast("Audit copied to clipboard!", "success");
        }
        return;
      }

      // 2. 🚀 NEW: Image Download (URL-based GET Request)
      // This bypasses MiniPay's CORS blocks and triggers native download
      if (mode === 'IMAGE') {
        window.location.href = `/api/download?url=${encodeURIComponent(resultData)}&type=IMAGE`;
        return;
      }

      // 3. Audio/Video Download (Base64 POST Request)
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/download';

      const dataInput = document.createElement('input');
      dataInput.type = 'hidden';
      dataInput.name = 'fileData';
      dataInput.value = resultData;
      form.appendChild(dataInput);

      const typeInput = document.createElement('input');
      typeInput.type = 'hidden';
      typeInput.name = 'fileType';
      typeInput.value = mode;
      form.appendChild(typeInput);

      document.body.appendChild(form);
      form.submit(); 
      document.body.removeChild(form);

    } catch (err) {
      console.error("Download action failed:", err);
      showToast("Failed to initiate download.", "error");
    }
  };

  const saveToLibrary = (generatedData, targetMode, targetPrompt) => {
    const existingLibrary = JSON.parse(localStorage.getItem('masomind_library') || '[]');
    const newItem = {
      id: Date.now().toString(),
      type: targetMode,
      category: targetMode === 'AUDIT' ? 'DOCUMENT' : 'MEDIA',
      data: generatedData,
      prompt: targetPrompt,
      timestamp: Date.now()
    };
    localStorage.setItem('masomind_library', JSON.stringify([newItem, ...existingLibrary]));
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
      const generatedContent = data.imageUrl || data.report || data.mediaUrl;

      if (generatedContent) {
        setResultData(generatedContent);
        saveToLibrary(generatedContent, targetMode, targetPrompt);
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
      const publicClient = createPublicClient({ 
        chain: celo, 
        transport: http() 
      });

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
          abi: [{"name":"approve","type":"function","stateMutability":"nonpayable","inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]}],
          functionName: 'approve',
          args: [CONTRACT_ADDRESS, approveAmount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setStatus(`Executing ${priceStr} ${activeToken} Payment...`);
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: [{
          "name": "requestService",
          "type": "function",
          "stateMutability": "nonpayable",
          "inputs": [
            { "name": "token", "type": "address" },
            { "name": "amount", "type": "uint256" },
            { "name": "prompt", "type": "string" },
            { "name": "serviceType", "type": "string" }
          ]
        }],
        functionName: 'requestService',
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

  const handleRefundFromHome = async () => {
    if (!pendingState || !address) return;
    setStatus('Requesting refund...');
    try {
      const res = await fetch('/api/trigger-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: pendingState.hash, userAddress: address })
      });
      if (res.ok) {
        showToast('Refund request submitted to Treasury.', 'success');
        clearPendingState();
      } else {
        showToast('Failed to request. It may have already been processed.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error while requesting refund.', 'error');
    }
    setStatus('');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-zinc-100 font-sans p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#09090b] to-[#09090b] relative">

      {/* 🚀 PREMIUM TOAST NOTIFICATION UI */}
      {toast.visible && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-4 w-11/12 max-w-sm">
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl ${
            toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-400' : 'bg-red-950/90 border-red-500/40 text-red-400'
          }`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <p className="text-xs font-bold tracking-wide leading-relaxed">{toast.message}</p>
          </div>
        </div>
      )}

      <header className="flex flex-col gap-4 py-4 px-2 mb-2 border-b border-white/5 pb-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 bg-emerald-500/10 rounded-lg border border-emerald-500/20 overflow-hidden text-emerald-400 p-1.5">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%" className="w-full h-full">
                <defs>
                  <linearGradient id="masoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="50%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#14b8a6" />
                  </linearGradient>
                  <linearGradient id="boltGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="8" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                <g transform="translate(0, 10)" filter="url(#glow)">
                  <path d="M236,140 C170,140 130,185 130,250 C130,300 160,335 190,355 C205,365 215,385 220,400 L236,400 Z" fill="none" stroke="url(#masoGradient)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
                  <path d="M165,210 Q195,230 225,210" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" opacity="0.6"/>
                  <path d="M145,270 Q180,280 210,260" fill="none" stroke="#14b8a6" strokeWidth="4" strokeLinecap="round" opacity="0.6"/>
                  <path d="M175,325 Q200,310 220,330" fill="none" stroke="#34d399" strokeWidth="4" strokeLinecap="round" opacity="0.4"/>
                  <path d="M276,140 C342,140 382,185 382,250 C382,300 352,335 322,355 C307,365 297,385 292,400 L276,400 Z" fill="none" stroke="url(#masoGradient)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M310,185 L285,220 L340,220" fill="none" stroke="#14b8a6" strokeWidth="3" strokeLinejoin="round" opacity="0.5"/>
                  <path d="M365,260 L320,280 L350,315" fill="none" stroke="#10b981" strokeWidth="3" strokeLinejoin="round" opacity="0.5"/>
                  <polygon points="270,110 190,260 250,260 220,410 320,230 255,230" fill="url(#boltGradient)" />
                  <circle cx="130" cy="250" r="7" fill="#34d399" />
                  <circle cx="190" cy="155" r="5" fill="#14b8a6" />
                  <circle cx="322" cy="355" r="6" fill="#ffffff" />
                  <circle cx="382" cy="250" r="7" fill="#34d399" />
                  <circle cx="220" cy="400" r="5" fill="#10b981" />
                  <circle cx="292" cy="400" r="5" fill="#10b981" />
                  <circle cx="250" cy="140" r="4" fill="#ffffff" />
                </g>
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg tracking-wider text-white">MASOMIND</h1>
                {isConnected && (
                  <div className="flex gap-1.5 ml-1">
                    <Link href="/library" className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 rounded text-[10px] text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20">
                      <Library className="w-2.5 h-2.5" /> Library
                    </Link>
                    <Link href="/dashboard" className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 rounded text-[10px] text-zinc-400 hover:bg-zinc-700 transition-colors border border-zinc-700">
                      <List className="w-2.5 h-2.5" /> Ledger
                    </Link>
                  </div>
                )}
              </div>
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

            {mode === 'AUDIT' && (
              <div className="w-full flex flex-col h-[450px] rounded-3xl glass-panel border border-zinc-800/50 shadow-2xl relative overflow-hidden bg-zinc-950/90">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/80">
                  <div className="flex items-center gap-2">
                    <Code className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="text-xs font-bold text-zinc-100 tracking-wider">SECURITY REPORT</h3>
                      <p className="text-[9px] text-zinc-500 font-mono">Gemini Flash Analysis</p>
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
                    The payment processed, but AI failed to complete. Retry below without paying again, or request a refund.
                  </p>

                  <button 
                    onClick={handleRefundFromHome}
                    className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                  >
                    <AlertCircle className="w-4 h-4" /> Request Refund
                  </button>

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
              placeholder={prompt ? "" : (placeholderText + (isDeleting ? "" : "|"))}
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
              placeholder={prompt ? "" : (placeholderText + (isDeleting ? "" : "|"))}
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

        <div className="mt-8 mb-2 flex flex-col items-center justify-center space-y-3">
          <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-medium flex-wrap justify-center">
            <Link href="/info" className="hover:text-emerald-400 transition-colors">FAQ</Link>
            <span className="w-1 h-1 rounded-full bg-zinc-800"></span>
            <Link href="/info/docs" className="hover:text-emerald-400 transition-colors">Docs</Link>
            <span className="w-1 h-1 rounded-full bg-zinc-800"></span>
            <Link href="/info/privacy" className="hover:text-emerald-400 transition-colors">Privacy</Link>
            <span className="w-1 h-1 rounded-full bg-zinc-800"></span>
            <Link href="/info/terms" className="hover:text-emerald-400 transition-colors">Terms</Link>
            <span className="w-1 h-1 rounded-full bg-zinc-800"></span>
            <a href="https://t.me/MasoMind" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">Support</a>
          </div>
          <div className="opacity-60">
            <span className="text-[9px] font-mono font-bold text-zinc-500 tracking-widest uppercase">
              © 2026 MASONODE TECHNOLOGIES LIMITED
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

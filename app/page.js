'use client';
import { useState, useEffect } from 'react';
import { useAccount, useConnect, useWriteContract } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { createPublicClient, custom, parseUnits, formatUnits } from 'viem';
import { celo } from 'viem/chains';
import { Sparkles, Image as ImageIcon, Loader2, Fingerprint, Download, Code, Wallet } from 'lucide-react';
import { useMiniPay } from '../hooks/useMiniPay';

// Define the stablecoins on Celo Mainnet
const TOKENS = {
  cUSD: { address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18, symbol: 'cUSD' },
  USDC: { address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', decimals: 6, symbol: 'USDC' },
  USDT: { address: '0x48065fbBE25f71C9282ddf5e1cD6D6A88248a566', decimals: 6, symbol: 'USDT' }
};

export default function MasoMindApp() {
  const isMiniPay = useMiniPay();
  const { isConnected, address } = useAccount(); 
  const { connect } = useConnect();
  const { writeContractAsync, isPending } = useWriteContract();

  const [mode, setMode] = useState('IMAGE'); // 'IMAGE' or 'AUDIT'
  const [activeToken, setActiveToken] = useState('cUSD');
  const [balances, setBalances] = useState({ cUSD: '0.00', USDC: '0.00', USDT: '0.00' });
  
  const [prompt, setPrompt] = useState('');
  const [resultData, setResultData] = useState(null); 
  const [status, setStatus] = useState('');

  // IMPORTANT: Replace this with your newly deployed V2 Contract Address from Remix
  const CONTRACT_ADDRESS = '0x1d7c2c4c5e41dcdbe90b03d71399383dd1464717';

  // 1. Fetch balances for all three tokens when wallet connects
  useEffect(() => {
    if (!address) return;
    const fetchBalances = async () => {
      const publicClient = createPublicClient({ chain: celo, transport: custom(window.ethereum) });
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

  // 2. The Auto-Recovery System (Runs on app load to catch dropped transactions)
  useEffect(() => {
    const recoverLostTransaction = async () => {
      const savedHash = localStorage.getItem('pendingTxHash');
      const savedPrompt = localStorage.getItem('pendingPrompt');
      const savedMode = localStorage.getItem('pendingMode');

      if (savedHash && savedPrompt) {
        setStatus('Recovering interrupted transaction...');
        try {
          const endpoint = savedMode === 'IMAGE' ? '/api/generate-image' : '/api/audit-code';
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: savedPrompt, txHash: savedHash })
          });
          const data = await res.json();
          
          if (data.imageUrl || data.report) {
            setResultData(data.imageUrl || data.report);
            setMode(savedMode);
            // Transaction secure, clear memory
            localStorage.removeItem('pendingTxHash');
            localStorage.removeItem('pendingPrompt');
            localStorage.removeItem('pendingMode');
            setStatus('');
          } else {
            setStatus('Recovery failed. Please try executing again.');
            setTimeout(() => setStatus(''), 4000);
          }
        } catch (e) {
          setStatus('Recovery error. Network might be down.');
          setTimeout(() => setStatus(''), 4000);
        }
      }
    };
    recoverLostTransaction();
  }, []);

  const downloadImage = async () => {
    if (!resultData || mode !== 'IMAGE') return;
    try {
      const response = await fetch(resultData);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `MasoMind-Asset-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const executeService = async () => {
    if (!prompt || !address) return;

    setResultData(null);
    const token = TOKENS[activeToken];
    
    // Configurable Pricing
    const priceStr = mode === 'IMAGE' ? '0.10' : '0.05';
    const amountToCharge = parseUnits(priceStr, token.decimals);

    try {
      const publicClient = createPublicClient({ chain: celo, transport: custom(window.ethereum) });

      // STEP 1: Balance Check
      if (Number(balances[activeToken]) < Number(priceStr)) {
        setStatus(`Low Balance: You need ${priceStr} ${activeToken}.`);
        setTimeout(() => setStatus(''), 5000);
        return; 
      }

      // STEP 2: Smart Allowance
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

      // STEP 3: Execute Payment
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

      // STEP 4: Lock to Memory BEFORE fetching API (The Fail-Safe)
      localStorage.setItem('pendingTxHash', txHash);
      localStorage.setItem('pendingPrompt', prompt);
      localStorage.setItem('pendingMode', mode);

      // STEP 5: Route to Correct API
      setStatus(`Processing AI ${mode === 'IMAGE' ? 'Asset' : 'Audit'}...`);
      
      const endpoint = mode === 'IMAGE' ? '/api/generate-image' : '/api/audit-code';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, txHash }) 
      });
      
      const data = await res.json();
      
      if (data.imageUrl || data.report) {
        setResultData(data.imageUrl || data.report);
        // Safely clear memory since it was successful
        localStorage.removeItem('pendingTxHash');
        localStorage.removeItem('pendingPrompt');
        localStorage.removeItem('pendingMode');
      } else {
         setStatus(data.error || 'API Processing Failed. App will auto-recover.');
         setTimeout(() => setStatus(''), 4000);
      }
      
      setStatus('');
    } catch (err) {
      console.error(err);
      setStatus('Transaction rejected or failed.');
      setTimeout(() => setStatus(''), 4000);
    }
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
              <h1 className="font-bold text-lg tracking-wider text-white">MASOMIND</h1>
              <p className="text-[10px] text-emerald-500/70 uppercase tracking-widest font-mono">Enterprise Suite</p>
            </div>
          </div>

          {!isMiniPay && !isConnected ? (
             <button onClick={() => connect({ connector: injected() })} className="flex items-center gap-2 glass-panel hover:bg-zinc-800 text-white px-4 py-2 rounded-full text-xs font-medium">
               <Fingerprint className="w-3 h-3 text-emerald-400" /> Connect
             </button>
          ) : (
            <div className="flex items-center gap-2 shadow-lg shadow-black/50 rounded-full">
              <select 
                value={activeToken} 
                onChange={(e) => setActiveToken(e.target.value)}
                className="bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 rounded-full px-3 py-2 outline-none focus:border-emerald-500 glass-panel"
              >
                <option value="cUSD">cUSD ({balances.cUSD})</option>
                <option value="USDC">USDC ({balances.USDC})</option>
                <option value="USDT">USDT ({balances.USDT})</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex p-1 bg-zinc-900/50 border border-zinc-800 rounded-xl w-full max-w-md mx-auto">
          <button 
            onClick={() => { setMode('IMAGE'); setResultData(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'IMAGE' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <ImageIcon className="w-4 h-4" /> Gen Asset
          </button>
          <button 
            onClick={() => { setMode('AUDIT'); setResultData(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'AUDIT' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Code className="w-4 h-4" /> Audit Code
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto">
        {resultData ? (
          mode === 'IMAGE' ? (
            <div className="relative p-1 rounded-3xl bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-2xl w-full aspect-square group">
              <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full mix-blend-overlay"></div>
              <img src={resultData} alt="AI Canvas" className="w-full h-full object-cover rounded-[22px] relative z-10" />
              <button onClick={downloadImage} className="absolute bottom-4 right-4 z-20 glass-panel bg-black/50 hover:bg-emerald-500/80 border border-white/10 p-3 rounded-full shadow-lg transition-all flex items-center justify-center">
                <Download className="w-5 h-5 text-white" />
              </button>
            </div>
          ) : (
            <div className="w-full h-[400px] rounded-3xl glass-panel border border-zinc-800/50 p-6 shadow-2xl relative overflow-y-auto custom-scrollbar bg-zinc-950/80">
              <div className="prose prose-invert prose-emerald text-sm whitespace-pre-wrap font-mono leading-relaxed">
                {resultData}
              </div>
            </div>
          )
        ) : (
          <div className="w-full aspect-square rounded-3xl glass-panel border border-zinc-800/50 flex flex-col items-center justify-center p-8 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent"></div>

            {isPending || status ? (
              <div className="space-y-4 flex flex-col items-center relative z-10">
                <div className="p-4 bg-zinc-900 rounded-full border border-zinc-800 shadow-inner">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                </div>
                <p className="text-sm text-zinc-400 font-medium tracking-wide animate-pulse">{status}</p>
              </div>
            ) : (
              <div className="relative z-10 flex flex-col items-center">
                <div className="p-5 bg-zinc-900 rounded-2xl border border-zinc-800 mb-4 shadow-inner">
                  {mode === 'IMAGE' ? <ImageIcon className="w-10 h-10 text-zinc-600" /> : <Code className="w-10 h-10 text-zinc-600" />}
                </div>
                <h3 className="text-zinc-300 font-medium mb-1">{mode === 'IMAGE' ? 'Awaiting Prompt' : 'Paste Smart Contract'}</h3>
                <p className="text-xs text-zinc-600 max-w-[200px]">
                  {mode === 'IMAGE' ? 'Enter an intent below to generate high-fidelity assets.' : 'Upload code for an AI security audit.'}
                </p>
                <span className="mt-4 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-mono text-emerald-500/70">
                  Cost: {mode === 'IMAGE' ? '0.10' : '0.05'} {activeToken}
                </span>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="w-full max-w-md mx-auto mt-8 mb-4">
        <div className="relative flex items-center glass-panel rounded-2xl shadow-2xl p-1">
          {mode === 'IMAGE' ? (
            <input 
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Initialize intent..."
              className="w-full pl-4 pr-28 py-4 bg-transparent focus:outline-none text-sm text-zinc-200 placeholder:text-zinc-600"
            />
          ) : (
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Paste contract code..."
              rows={2}
              className="w-full pl-4 pr-28 py-3 bg-transparent focus:outline-none text-sm text-zinc-200 placeholder:text-zinc-600 resize-none"
            />
          )}
          <button 
            onClick={executeService}
            disabled={!prompt || isPending || status !== ''}
            className="absolute right-2 top-2 bottom-2 px-5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl transition-all disabled:opacity-30 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            Execute
          </button>
        </div>
      </footer>
    </div>
  );
}

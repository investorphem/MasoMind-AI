'use client';
import { useState } from 'react';
import { useAccount, useConnect, useWriteContract } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { createPublicClient, custom, parseEther, formatEther } from 'viem';
import { celo } from 'viem/chains';
import { Sparkles, Image as ImageIcon, Loader2, Fingerprint } from 'lucide-react';
import { useMiniPay } from '../hooks/useMiniPay';

export default function MasoMindApp() {
  const isMiniPay = useMiniPay();
  const { isConnected, address } = useAccount(); // Added address extraction
  const { connect } = useConnect();
  const { writeContractAsync, isPending } = useWriteContract();
  
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [status, setStatus] = useState('');

  const CONTRACT_ADDRESS = '0xa96853decf20e65c7b657722815c515074c4ced0';
  const CUSD_ADDRESS = '0x765DE816845861e75A25fCA122bb6898B8B1282a';

  const triggerGeneration = async () => {
    if (!prompt || !address) return;

    try {
      // Initialize Viem Client to read the blockchain
      const publicClient = createPublicClient({
        chain: celo,
        transport: custom(window.ethereum)
      });

      // 1. PRE-FLIGHT BALANCE CHECK
      setStatus('Checking wallet balance...');
      const balance = await publicClient.readContract({
        address: CUSD_ADDRESS,
        abi: [{"name":"balanceOf","type":"function","stateMutability":"view","inputs":[{"name":"account","type":"address"}],"outputs":[{"name":"","type":"uint256"}]}],
        functionName: 'balanceOf',
        args: [address],
      });

      if (balance < parseEther('0.10')) {
        const readableBalance = Number(formatEther(balance)).toFixed(2);
        setStatus(`Low Balance Alert: You only have ${readableBalance} cUSD.`);
        setTimeout(() => setStatus(''), 5000);
        return; // Stops the transaction completely
      }

      // 2. SMART ALLOWANCE CHECK
      setStatus('Checking contract permissions...');
      const allowance = await publicClient.readContract({
        address: CUSD_ADDRESS,
        abi: [{"name":"allowance","type":"function","stateMutability":"view","inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"outputs":[{"name":"","type":"uint256"}]}],
        functionName: 'allowance',
        args: [address, CONTRACT_ADDRESS],
      });

      // If allowance is less than 0.10 cUSD, ask for approval
      if (allowance < parseEther('0.10')) {
        setStatus('Step 1: Approving cUSD limit...');
        // We approve 10 cUSD so you don't have to do this step again for the next 100 images!
        const approveHash = await writeContractAsync({
          address: CUSD_ADDRESS,
          abi: [{"name":"approve","type":"function","stateMutability":"nonpayable","inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}]}],
          functionName: 'approve',
          args: [CONTRACT_ADDRESS, parseEther('10.0')],
        });

        setStatus('Waiting for blockchain confirmation...');
        // This actively listens for the exact moment the block is verified
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 3. EXECUTE PAYMENT
      setStatus('Step 2: Executing 0.10 cUSD Payment...');
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: [{
          "name": "requestImage",
          "type": "function",
          "stateMutability": "nonpayable",
          "inputs": [{ "name": "prompt", "type": "string" }]
        }],
        functionName: 'requestImage',
        args: [prompt],
      });

      setStatus('Confirming payment on chain...');
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      // 4. GENERATE AI IMAGE
      setStatus('Processing AI Asset via Gemini...');
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      
      const data = await res.json();
      
      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl);
        setStatus('');
      } else {
        setStatus('AI Generation failed. Please retry.');
        setTimeout(() => setStatus(''), 4000);
      }
    } catch (err) {
      console.error(err);
      setStatus('Transaction rejected or failed.');
      setTimeout(() => setStatus(''), 4000);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-zinc-100 font-sans p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#09090b] to-[#09090b]">
      
      <header className="flex justify-between items-center py-4 px-2 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wider text-white">MASOMIND</h1>
            <p className="text-[10px] text-emerald-500/70 uppercase tracking-widest font-mono">Enterprise Agent</p>
          </div>
        </div>
        
        {!isMiniPay && !isConnected ? (
           <button 
             onClick={() => connect({ connector: injected() })}
             className="flex items-center gap-2 glass-panel hover:bg-zinc-800 text-white px-4 py-2 rounded-full text-xs font-medium transition-all"
           >
             <Fingerprint className="w-3 h-3 text-emerald-400" />
             Connect Wallet
           </button>
        ) : (
          <div className="text-xs glass-panel px-4 py-2 rounded-full text-zinc-300 font-mono shadow-lg shadow-black/50">
            <span className="text-emerald-400 mr-2">●</span>0.10 cUSD
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto">
        {generatedImage ? (
          <div className="relative p-1 rounded-3xl bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-2xl w-full aspect-square">
            <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full mix-blend-overlay"></div>
            <img src={generatedImage} alt="AI Canvas" className="w-full h-full object-cover rounded-[22px] relative z-10" />
          </div>
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
                  <ImageIcon className="w-10 h-10 text-zinc-600" />
                </div>
                <h3 className="text-zinc-300 font-medium mb-1">Awaiting Prompt</h3>
                <p className="text-xs text-zinc-600 max-w-[200px]">Enter an intent below to generate high-fidelity assets.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="w-full max-w-md mx-auto mt-8 mb-4">
        <div className="relative flex items-center glass-panel rounded-2xl shadow-2xl p-1">
          <input 
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Initialize intent..."
            className="w-full pl-4 pr-28 py-4 bg-transparent focus:outline-none text-sm text-zinc-200 placeholder:text-zinc-600"
          />
          <button 
            onClick={triggerGeneration}
            disabled={!prompt || isPending || status !== ''}
            className="absolute right-2 top-2 bottom-2 px-5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-emerald-500 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            Execute
          </button>
        </div>
      </footer>
    </div>
  );
}

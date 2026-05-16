'use client';
import { useState } from 'react';
import { useAccount, useConnect, useWriteContract } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { parseEther } from 'viem';
import { Sparkles, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useMiniPay } from '../hooks/useMiniPay';

export default function MasoMindApp() {
  const isMiniPay = useMiniPay();
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const { writeContractAsync, isPending } = useWriteContract(); // USING ASYNC NOW
  
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [status, setStatus] = useState('');

  // IMPORTANT: Make sure this is your actual deployed contract address!
  const CONTRACT_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS';

  const triggerGeneration = async () => {
    if (!prompt) return;
    setStatus('Waiting for wallet approval...');

    try {
      // 1. THIS WILL NOW PAUSE AND FORCE THE MINIPAY POPUP
      const tx = await writeContractAsync({
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

      setStatus('Payment confirmed! Generating masterpiece...');
      
      // 2. Fetch image only AFTER payment is signed
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
        setStatus('Generation failed.');
      }
    } catch (err) {
      console.error(err);
      setStatus('Transaction canceled or failed.');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 justify-between">
      <header className="flex justify-between items-center py-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <span className="font-bold text-lg text-emerald-400">MASOMIND AI</span>
        </div>
        
        {/* Shows standard connect button if NOT in MiniPay */}
        {!isMiniPay && !isConnected ? (
           <button 
             onClick={() => connect({ connector: injected() })}
             className="bg-emerald-600 text-white px-4 py-1 rounded-full text-xs"
           >
             Connect Wallet
           </button>
        ) : (
          <div className="text-xs bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-zinc-400">
            0.10 cUSD / Gen
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center my-6">
        {generatedImage ? (
          <div className="relative border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm aspect-square bg-zinc-900">
            <img src={generatedImage} alt="AI Canvas" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-full aspect-square max-w-sm rounded-2xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center bg-zinc-900/30 p-6 text-center">
            {isPending || status ? (
              <div className="space-y-3 flex flex-col items-center">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                <p className="text-sm text-zinc-400">{status}</p>
              </div>
            ) : (
              <>
                <ImageIcon className="w-12 h-12 text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500">Your generated canvas will render here.</p>
              </>
            )}
          </div>
        )}
      </main>

      <footer className="space-y-3 pb-4">
        <div className="relative flex items-center">
          <input 
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g. A futuristic neon city..."
            className="w-full pl-4 pr-28 py-4 bg-zinc-900 border border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm text-zinc-200"
          />
          <button 
            onClick={triggerGeneration}
            disabled={!prompt || isPending || status !== ''}
            className="absolute right-2 top-2 bottom-2 px-4 bg-emerald-500 text-zinc-950 font-bold text-xs rounded-lg disabled:opacity-40"
          >
            Generate
          </button>
        </div>
      </footer>
    </div>
  );
}

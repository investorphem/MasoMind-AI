'use client';
import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseEther } from 'viem';
import { Sparkles, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useMiniPay } from '../hooks/useMiniPay'; // Auto-connects inside MiniPay

export default function MasoMindApp() {
  const isMiniPay = useMiniPay();
  const { isConnected } = useAccount();
  const { writeContract, isPending } = useWriteContract();
  
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [status, setStatus] = useState('');

  const CONTRACT_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS';

  const triggerGeneration = async () => {
    if (!prompt) return;
    setStatus('Processing micro-payment...');

    try {
      // 1. Submit payment of 0.10 cUSD to Celo Mainnet
      writeContract({
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

      setStatus('Payment confirmed! Generating your masterpiece...');
      
      // 2. Fetch image from your backend server
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
        setStatus('Generation failed. Please try again.');
      }
    } catch (err) {
      setStatus('Transaction canceled.');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 justify-between">
      {/* Premium Header */}
      <header className="flex justify-between items-center py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
          <span className="font-bold text-lg tracking-wider bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            MASOMIND AI
          </span>
        </div>
        <div className="text-xs bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-zinc-400">
          0.10 cUSD / Gen
        </div>
      </header>

      {/* Main Display Window */}
      <main className="flex-1 flex flex-col items-center justify-center my-6">
        {generatedImage ? (
          <div className="relative border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl max-w-full aspect-square bg-zinc-900">
            <img src={generatedImage} alt="AI Canvas" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-full aspect-square max-w-sm rounded-2xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center bg-zinc-900/30 p-6 text-center">
            {isPending || status ? (
              <div className="space-y-3 flex flex-col items-center">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                <p className="text-sm text-zinc-400 font-mono">{status}</p>
              </div>
            ) : (
              <>
                <ImageIcon className="w-12 h-12 text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500">Your generated canvas will render here in real-time.</p>
              </>
            )}
          </div>
        )}
      </main>

      {/* Sticky Mobile Input Control */}
      <footer className="space-y-3">
        <div className="relative flex items-center">
          <input 
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to create..."
            className="w-full pl-4 pr-28 py-4 bg-zinc-900 border border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm text-zinc-200"
          />
          <button 
            onClick={triggerGeneration}
            disabled={!prompt || isPending}
            className="absolute right-2 top-2 bottom-2 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors disabled:opacity-40"
          >
            Generate
          </button>
        </div>
      </footer>
    </div>
  );
}

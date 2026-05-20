export default function DocsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h2 className="text-sm font-bold text-emerald-400 border-b border-zinc-800 pb-2">Platform Documentation</h2>
      
      <div>
        <h3 className="text-xs font-bold text-zinc-200 mb-1">Smart Contract Architecture</h3>
        <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">The MasoMindV2 router is an immutable gateway deployed on Celo Mainnet. It utilizes strict parameter decoding to verify the precise stablecoin, amount, and intent type before authorizing API access.</p>
        <div className="bg-zinc-900 p-2 rounded border border-zinc-800 text-[9px] font-mono text-emerald-500/70 break-all">
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
  );
}

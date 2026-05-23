export default function DocsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h2 className="text-sm font-bold text-emerald-400 border-b border-zinc-800 pb-2 uppercase tracking-wider font-mono">
        Technical Architecture Whitepaper
      </h2>

      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-bold text-zinc-200 mb-1 uppercase tracking-wide font-mono">1. MasoMindV2 Orchestration Layer</h3>
          <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
            The MasoMindV2 router is an immutable, non-custodial gateway deployed directly on Celo Mainnet. The protocol enforces tight parameter decoding at the EVM state level, validating token contracts, precise decimal alignment, and specialized service types before triggering background microservice execution threads.
          </p>
          <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 text-[10px] font-mono text-emerald-400 break-all flex flex-col space-y-1 shadow-inner bg-zinc-950/40">
            <span className="text-zinc-600 uppercase text-[9px] font-bold tracking-wider mb-1">Active Gateway Router Contract</span>
            <span>0x038be2c568f20a69931EE4082B424e5a68dB8089</span>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-zinc-200 mb-1 uppercase tracking-wide font-mono">2. Enterprise AI Model Routing Matrix</h3>
          <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">
            The protocol leverages high-availability API relays to broker requests out to specialized foundation neural network arrays:
          </p>
          <ul className="text-[11px] text-zinc-400 leading-relaxed space-y-2 list-none pl-1">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span><strong className="text-zinc-300 font-mono text-[10px] uppercase">Audio/Vocal:</strong> Google Audio Cluster (High-fidelity human voice synthesis)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span><strong className="text-zinc-300 font-mono text-[10px] uppercase">Video Engine:</strong> Intel Open Edge Nodes / Baseline Progressive MP4</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span><strong className="text-zinc-300 font-mono text-[10px] uppercase">Image Studio:</strong> Black Forest Labs Flux.1-Schnell HD Grid Matrices</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span><strong className="text-zinc-300 font-mono text-[10px] uppercase">Code Auditing:</strong> Anthropic Claude 3.5 Sonnet Enterprise Core</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

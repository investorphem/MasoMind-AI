export default function FAQPage() {
  return (
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
  );
}

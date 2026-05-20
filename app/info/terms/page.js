export default function TermsPage() {
  return (
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
  );
}

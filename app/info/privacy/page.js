export default function PrivacyPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h2 className="text-sm font-bold text-emerald-400 border-b border-zinc-800 pb-2">Privacy Policy</h2>
      <p className="text-[11px] text-zinc-400 leading-relaxed">
        We respect the ethos of Web3. MasoMind operates on a strict minimal-data protocol. 
      </p>
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-200">Data Collection</h3>
        <p className="text-[11px] text-zinc-400 leading-relaxed">We do not require email addresses, names, or traditional accounts. We only log your public wallet address and the transaction hashes required to provide your generated AI assets via the Enterprise Ledger.</p>
        
        <h3 className="text-xs font-bold text-zinc-200">Data Storage</h3>
        <p className="text-[11px] text-zinc-400 leading-relaxed">Prompts and generated media are stored securely in our decentralized vault solely to allow you to retrieve your historical invocations. We do not sell your generation data to third parties.</p>
      </div>
    </div>
  );
}

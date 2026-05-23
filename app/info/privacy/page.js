export default function PrivacyPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h2 className="text-sm font-bold text-emerald-400 border-b border-zinc-800 pb-2 uppercase tracking-wider font-mono">
        Enterprise Privacy Policy
      </h2>
      <p className="text-[11px] text-zinc-400 leading-relaxed">
        MasoMind Technologies Limited operates on a zero-knowledge data minimization philosophy. We align our protocol with strict Web3 security paradigms, ensuring complete programmatic isolation of individual user identities.
      </p>
      
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wide font-mono">1. Cryptographic Identity Metrics</h3>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          The protocol does not maintain records of traditional Personally Identifiable Information (PII). We do not collect names, email credentials, physical addresses, or device telemetry. Our ledger tracking infrastructure restricts logging exclusively to public Web3 wallet addresses, cryptographic asset allowances, and corresponding transaction signatures required to route computational generation requests.
        </p>

        <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wide font-mono">2. Input Data and Prompt Isolation</h3>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Any source code fragments uploaded for security auditing, custom text inputs, titles, genres, or custom vocal lyrics strings are treated as confidential, high-security enterprise data packets. These payloads are processed directly by isolated runtime environments via secure pipelines. MasoMind does not rent, sell, or monetize user prompt histories, codebase parameters, or compiled generation results to third-party data aggregators or advertising networks.
        </p>

        <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wide font-mono">3. Enterprise Media Vault Life Cycle</h3>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Generated binary files (including images, compiled audio tracks, and progressive video containers) are archived securely within our cloud and decentralized vault partitions. This retention exists purely to facilitate continuous availability and secure retrieval via your user-facing historic Ledger. Users can request immediate block erasure of historic transaction rows from the indexing interface at any point.
        </p>
      </div>
    </div>
  );
}

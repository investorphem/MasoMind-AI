export default function TermsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h2 className="text-sm font-bold text-emerald-400 border-b border-zinc-800 pb-2 uppercase tracking-wider font-mono">
        Enterprise Terms of Service
      </h2>
      <div className="space-y-4">
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Welcome to the MasoMind Protocol. By initializing a cryptographic handshake, connecting a non-custodial Web3 wallet interface, or executing smart contract calls through the MasoMind routing layer, you legally enter into a binding execution framework with MasoMind Technologies Limited.
        </p>

        <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wide font-mono">1. Immutable Cryptographic Settlements</h3>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          All stablecoin transactions executed via the <code className="text-emerald-400 font-mono">requestService</code> entrypoint are final, immutable, and settled instantly by the Celo blockchain ledger. Due to the non-custodial and autonomous nature of gas routing, payments cannot be reversed or modified once broadcast to the network. In the anomalous event of an external API provider timeout, the protocol's integrated Treasury Auto-Recovery system preserves the user's transaction state for manual settlement or off-chain administrative mitigation.
        </p>

        <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wide font-mono">2. Synthetic Identity & Public Figure Policy</h3>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          When utilizing the MasoMind AI generation engines (including text, audio, music lyrics, and video matrix rendering), users are strictly prohibited from generating content that infringes upon the <strong>Right of Publicity</strong>, intellectual property, or personal dignity of any real human being—including public figures, political leaders, or private individuals. 
        </p>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          The intentional creation of deceptive deepfakes, non-consensual synthetic impersonations, defamatory character representations, or malicious commercial exploitation of real human voices and likenesses is grounds for immediate protocol-level blacklisting. MasoMind reserves the right to forward diagnostic signature logs to compliance networks if malicious synthetic identity theft is flagged.
        </p>

        <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wide font-mono">3. Algorithmic Filter Liability and Guardrails</h3>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          MasoMind operates down-stream from elite enterprise safety firewalls managed by LLM provider clusters. Prompts, source code inputs, or lyrics strings that trigger safety heuristics (including hate speech, graphic violence, or exploitative data sets) will be rejected automatically. Users acknowledge that algorithmic prompt rejection due to a breach of these safety limits does not entitle the wallet operator to a stablecoin refund under any circumstances.
        </p>
      </div>
    </div>
  );
}

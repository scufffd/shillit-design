"use client";

import { useEffect, useState } from "react";

export default function CTOPage() {
  const [config, setConfig] = useState<{ ctoTreasuryWallet: string | null; ctoFeeLamports: number | null } | null>(null);

  useEffect(() => {
    fetch("/api/cto/config")
      .then((r) => r.json())
      .then((d) => setConfig({ ctoTreasuryWallet: d.ctoTreasuryWallet ?? null, ctoFeeLamports: d.ctoFeeLamports ?? null }))
      .catch(() => setConfig(null));
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold">Community Takeover (CTO)</h1>
      <p className="mt-4 text-white/80">
        Inactive or low-cap tokens can be claimed by a new team. Pay the CTO fee
        to the CTO treasury wallet; you receive metadata/update authority. Fee funds CEX
        listings, marketing, and liquidity bootstraps.
      </p>
      {config?.ctoTreasuryWallet && (
        <div className="mt-6 rounded-xl border border-shill-yellow/20 bg-shill-yellow/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">CTO fee wallet</p>
          <p className="mt-1 break-all font-mono text-sm text-white">{config.ctoTreasuryWallet}</p>
          {config.ctoFeeLamports != null && config.ctoFeeLamports > 0 && (
            <p className="mt-1 text-sm text-white/80">Fee: {(config.ctoFeeLamports / 1e9).toFixed(4)} SOL</p>
          )}
        </div>
      )}
      <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm text-white/60">
          CTO flow: 1) Check eligible tokens on the dashboard. 2) Pay the CTO fee (SOL) to the wallet above. 3) Submit your CTO
          transaction (e.g. fee to TreasuryVault) via Anchor. 4) Call POST
          /api/cto/submit with mint, new_authority, proposal_uri (optional), tx_signature (optional). 5) Admin will approve and confirm fee paid; we announce and support from treasury.
        </p>
      </div>
    </main>
  );
}

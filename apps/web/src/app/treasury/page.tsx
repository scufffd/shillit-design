"use client";

import { useEffect, useState } from "react";

export default function TreasuryPage() {
  const [stats, setStats] = useState<{
    balance_lamports?: number;
    treasury_pda?: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/treasury/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats({ message: "Failed to load" }));
  }, []);

  const balanceSol =
    stats?.balance_lamports != null
      ? (stats.balance_lamports / 1e9).toFixed(4)
      : "—";

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold">Treasury</h1>
      <p className="mt-4 text-white/80">
        Transparent vault. Fees from launches and CTO fund CEX listings,
        marketing, and bagworker rewards.
      </p>
      <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm text-white/60">Balance (SOL)</p>
        <p className="mt-1 text-2xl font-mono">{balanceSol}</p>
        {stats?.treasury_pda && (
          <p className="mt-2 break-all text-xs text-white/50">
            PDA: {stats.treasury_pda}
          </p>
        )}
        {stats?.message && (
          <p className="mt-2 text-sm text-white/50">{stats.message}</p>
        )}
      </div>
    </main>
  );
}

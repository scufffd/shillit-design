"use client";

import { useCallback, useEffect, useState } from "react";

type LeaderboardEntry = {
  wallet: string;
  display_name: string | null;
  avatar_url: string | null;
  rating_score: number;
  rating_automated: number;
  rating_community: number;
  rating_updated_at: string;
};

function shortWallet(w: string): string {
  if (w.length <= 12) return w;
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

export default function LeaderboardPage() {
  const [deployers, setDeployers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/deployer/leaderboard?limit=20");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load leaderboard");
      setDeployers(data.deployers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setDeployers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="font-display text-3xl font-bold text-white">Deployer leaderboard</h1>
      <p className="mt-2 text-white/70">
        Top deployers by score (paid profiles). Higher score = better fee terms and visibility.
      </p>
      {loading && (
        <p className="mt-8 text-center text-white/50">Loading…</p>
      )}
      {error && (
        <p className="mt-8 text-center text-red-400">{error}</p>
      )}
      {!loading && !error && deployers.length === 0 && (
        <p className="mt-8 text-center text-white/50">No deployers yet.</p>
      )}
      {!loading && !error && deployers.length > 0 && (
        <ul className="mt-8 space-y-2">
          {deployers.map((d, i) => (
            <li
              key={d.wallet}
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <span className="w-8 shrink-0 text-right font-mono text-sm text-white/50">
                #{i + 1}
              </span>
              {d.avatar_url ? (
                <img
                  src={d.avatar_url}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm text-white/70">
                  {d.display_name?.slice(0, 1) ?? "?"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">
                  {d.display_name?.trim() || shortWallet(d.wallet)}
                </p>
                <p className="truncate font-mono text-xs text-white/50">{shortWallet(d.wallet)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono font-semibold text-shill-yellow">{d.rating_score.toFixed(0)}</p>
                <p className="text-xs text-white/50">score</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

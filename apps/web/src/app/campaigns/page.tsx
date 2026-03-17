"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Campaign {
  id: string;
  token_mint: string;
  creator_wallet: string;
  title: string;
  description: string | null;
  reward_mint: string;
  reward_amount_raw: string;
  holder_requirement_raw: string | null;
  funded_lamports: number;
  starts_at: string;
  ends_at: string;
  status: string;
  created_at: string;
}

interface TokenInfo {
  name: string;
  symbol: string;
  imageUrl: string | null;
  priceUsd: number | null;
  marketCap: number | null;
  volumeH24: number | null;
  liquidityUsd: number | null;
  dexscreenerUrl: string;
}

function formatSol(lamports: number): string {
  return (lamports / 1e9).toFixed(2);
}

function timeLeft(endsAt: string): string {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const d = Math.max(0, Math.floor((end - now) / (24 * 60 * 60 * 1000)));
  const h = Math.max(0, Math.floor(((end - now) % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)));
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h left`;
}

function formatMarketCap(n: number | null | undefined): string {
  if (n == null || n < 0) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(0)}`;
}

function shortWallet(w: string): string {
  if (w.length <= 12) return w;
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

export default function CampaignsPage() {
  const { publicKey, connected, connect, disconnect, select, wallets } = useWallet();
  const connectedWallet = publicKey?.toBase58() ?? null;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [tokenInfoMap, setTokenInfoMap] = useState<Record<string, TokenInfo>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/campaigns?limit=50");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setCampaigns(data.campaigns ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (connectedWallet) {
      fetch(`/api/campaigns?creatorWallet=${encodeURIComponent(connectedWallet)}`)
        .then((r) => r.json())
        .then((d) => setMyCampaigns(d.campaigns ?? []))
        .catch(() => setMyCampaigns([]));
    } else {
      setMyCampaigns([]);
    }
  }, [connectedWallet]);

  const handleConnect = useCallback(async () => {
    if (!wallets.length) return;
    if (!publicKey && wallets.length) select(wallets[0].adapter.name);
    await connect();
  }, [wallets, connect, select, publicKey]);

  useEffect(() => {
    const mints = [...new Set(campaigns.map((c) => c.token_mint))];
    let cancelled = false;
    const map: Record<string, TokenInfo> = {};
    Promise.all(
      mints.slice(0, 30).map(async (mint) => {
        if (cancelled) return;
        try {
          const r = await fetch(`/api/token/${mint}/dex-info`);
          if (!r.ok || cancelled) return;
          const d = await r.json();
          if (!cancelled && d.name) {
            map[mint] = {
              name: d.name,
              symbol: d.symbol,
              imageUrl: d.imageUrl ?? null,
              priceUsd: d.priceUsd ?? null,
              marketCap: d.marketCap ?? null,
              volumeH24: d.volumeH24 ?? null,
              liquidityUsd: d.liquidityUsd ?? null,
              dexscreenerUrl: d.dexscreenerUrl ?? `https://dexscreener.com/solana/${mint}`,
            };
          }
        } catch {
          /* ignore */
        }
      })
    ).then(() => {
      if (!cancelled) setTokenInfoMap((prev) => ({ ...prev, ...map }));
    });
    return () => {
      cancelled = true;
    };
  }, [campaigns]);

  const q = search.trim().toLowerCase();
  const filtered =
    q.length === 0
      ? campaigns
      : campaigns.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.token_mint.toLowerCase().includes(q) ||
            (c.description ?? "").toLowerCase().includes(q) ||
            (tokenInfoMap[c.token_mint]?.name ?? "").toLowerCase().includes(q) ||
            (tokenInfoMap[c.token_mint]?.symbol ?? "").toLowerCase().includes(q)
        );

  return (
    <main className="min-h-screen pt-28 pb-16">
      <div className="mx-auto max-w-6xl px-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Campaigns</h1>
          <p className="mt-1 text-white/70">Browse active campaigns, or create and manage your own.</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/bagworker?view=create"
            className="rounded-full bg-shill-yellow px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-shill-dark hover:bg-shill-yellow/90"
          >
            Create campaign
          </Link>
          {connected ? (
            <div className="flex flex-wrap items-center gap-2 rounded-full border border-shill-yellow/40 bg-shill-yellow/10 px-4 py-2">
              <span className="text-sm font-medium text-shill-yellow">Managing as</span>
              <span className="text-sm text-white/90">{shortWallet(connectedWallet!)}</span>
              <button
                type="button"
                onClick={() => disconnect()}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 hover:bg-white/20"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              className="rounded-full border border-white/30 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Manage campaigns — connect wallet
            </button>
          )}
        </div>

        {connected && (
          <section id="your-campaigns" className="mt-8 rounded-2xl border border-shill-yellow/20 bg-shill-yellow/5 p-6">
            <h2 className="text-lg font-semibold text-white">Your campaigns</h2>
            <p className="mt-0.5 text-sm text-white/60">Campaigns you created. Use Manage to review submissions and pay shillers.</p>
            {myCampaigns.length === 0 ? (
              <p className="mt-4 text-sm text-white/50">You haven’t created any campaigns yet. Use <strong className="text-white/70">Create campaign</strong> above to get started.</p>
            ) : (
            <ul className="mt-4 space-y-3">
              {myCampaigns.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div>
                    <p className="font-medium text-white">{c.title}</p>
                    <p className="mt-0.5 text-sm text-white/60">
                      {c.reward_mint === "SOL" ? `${formatSol(c.funded_lamports)} SOL` : c.reward_amount_raw} · {timeLeft(c.ends_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        c.status === "active" ? "bg-emerald-500/20 text-emerald-400" : c.status === "ended" ? "bg-white/10 text-white/70" : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {c.status}
                    </span>
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/90 hover:bg-white/10"
                    >
                      View
                    </Link>
                    <Link
                      href={`/bagworker?id=${c.id}&manage=1`}
                      className="rounded-lg bg-shill-yellow px-3 py-1.5 text-sm font-semibold text-shill-dark hover:bg-shill-yellow/90"
                    >
                      Manage
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            )}
          </section>
        )}

        <h2 className="mt-10 text-xl font-semibold text-white">All active campaigns</h2>
        <div className="mt-4">
          <input
            type="search"
            placeholder="Search by campaign title, token name, symbol or CA…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xl rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-shill-yellow/50 focus:outline-none focus:ring-1 focus:ring-shill-yellow/30"
          />
        </div>

        {loading ? (
          <div className="mt-12 text-center text-white/60">Loading campaigns…</div>
        ) : filtered.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-white/70">
            {campaigns.length === 0
              ? "No active campaigns yet. Create one to get started."
              : "No campaigns match your search."}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => {
              const info = tokenInfoMap[c.token_mint];
              return (
                <Link
                  key={c.id}
                  href={`/campaigns/${c.id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-shill-yellow/30 hover:bg-white/10"
                >
                  <div className="flex items-start gap-4 p-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-2 ring-white/10">
                      {info?.imageUrl ? (
                        <img src={info.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-shill-yellow">
                          {(info?.symbol ?? c.token_mint.slice(0, 2)).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-white group-hover:text-shill-yellow">
                        {info?.name ?? "Unknown"} {info?.symbol && <span className="text-white/70">${info.symbol}</span>}
                      </h2>
                      <p className="mt-0.5 line-clamp-1 text-sm text-white/70">{c.title}</p>
                      {info?.marketCap != null && (
                        <p className="mt-1 text-xs text-white/50">MCap {formatMarketCap(info.marketCap)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-5 py-4">
                    <span className="rounded-full bg-shill-yellow/20 px-3 py-1 text-xs font-medium text-shill-yellow">
                      {c.reward_mint === "SOL" ? `${formatSol(c.funded_lamports)} SOL` : c.reward_amount_raw} {c.reward_mint}
                    </span>
                    <span className="text-xs text-white/50">{timeLeft(c.ends_at)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

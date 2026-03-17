"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface PublicTokenData {
  mint: string;
  activeCampaign?: {
    id: string;
    title: string;
    description: string | null;
    reward_mint: string;
    reward_amount_raw: string;
    holder_requirement_raw: string | null;
    funded_lamports: number;
    starts_at: string;
    ends_at: string;
    creator_wallet: string;
  } | null;
  rewardLoop: {
    enabled: boolean;
    interval_sec: number;
    distribution_split: {
      holdersPct?: number;
      creatorPct?: number;
      burnPct?: number;
      lpPct?: number;
    } | null;
    next_run_at: string | null;
  } | null;
  claimable: {
    partnerTradingFees: number;
    creatorTradingFees: number;
    partnerLpFees: number;
    creatorLpFees: number;
    poolAddress: string;
  } | null;
  jupiterSwapUrl: string;
  tokenPageUrl: string;
}

interface VampMetadata {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
}

function formatSol(lamports: number): string {
  return (lamports / 1e9).toFixed(4);
}

function shortMint(mint: string): string {
  if (mint.length <= 16) return mint;
  return `${mint.slice(0, 6)}…${mint.slice(-4)}`;
}

export default function PublicTokenPage() {
  const params = useParams();
  const mint = typeof params?.mint === "string" ? params.mint : "";
  const [publicData, setPublicData] = useState<PublicTokenData | null>(null);
  const [metadata, setMetadata] = useState<VampMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyDone, setCopyDone] = useState(false);

  useEffect(() => {
    if (!mint) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [pubRes, vampRes] = await Promise.all([
          fetch(`/api/token/${mint}/public`),
          fetch(`/api/launch/vamp?mint=${encodeURIComponent(mint)}`),
        ]);
        const pubJson = await pubRes.json().catch(() => ({}));
        const vampJson = await vampRes.json().catch(() => ({}));
        if (!cancelled) {
          if (pubRes.ok) setPublicData(pubJson);
          else setPublicData({ mint, rewardLoop: null, claimable: null, jupiterSwapUrl: `https://jup.ag/swap/SOL-${mint}`, tokenPageUrl: "" });
          if (vampRes.ok) setMetadata({ name: vampJson.name, symbol: vampJson.symbol, description: vampJson.description, imageUrl: vampJson.imageUrl });
          else setMetadata({ name: "Unknown", symbol: "—", description: "", imageUrl: undefined });
        }
      } catch {
        if (!cancelled) setPublicData({ mint, rewardLoop: null, claimable: null, jupiterSwapUrl: `https://jup.ag/swap/SOL-${mint}`, tokenPageUrl: "" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mint]);

  const copyMint = useCallback(() => {
    if (!mint) return;
    navigator.clipboard.writeText(mint);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }, [mint]);

  const split = publicData?.rewardLoop?.distribution_split;
  const holdersPct = split?.holdersPct ?? 0;
  const creatorPct = split?.creatorPct ?? 0;
  const burnPct = split?.burnPct ?? 0;
  const lpPct = split?.lpPct ?? 0;
  const dexscreenerUrl = `https://dexscreener.com/solana/${mint}`;
  const pumpUrl = `https://pump.fun/${mint}`;

  if (loading) {
    return (
      <main className="min-h-screen pt-28 pb-16">
        <div className="mx-auto max-w-3xl px-6 text-center text-white/70">Loading token…</div>
      </main>
    );
  }

  if (!mint) {
    return (
      <main className="min-h-screen pt-28 pb-16">
        <div className="mx-auto max-w-3xl px-6 text-center text-white/70">Invalid token.</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-28 pb-16">
      <div className="mx-auto max-w-3xl space-y-6 px-6">
        {/* Token header */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-3xl">
              {metadata?.imageUrl ? (
                <img src={metadata.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-shill-yellow">◆</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-white">{metadata?.name ?? "Unknown"}</h1>
              <p className="mt-0.5 font-mono text-shill-yellow">${metadata?.symbol ?? "—"}</p>
              <p className="mt-1 text-sm text-white/70">{metadata?.description || "—"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-white/60">{shortMint(mint)}</span>
                <button
                  type="button"
                  onClick={copyMint}
                  className="rounded bg-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/20"
                >
                  {copyDone ? "Copied" : "Copy CA"}
                </button>
                <a
                  href={publicData?.jupiterSwapUrl ?? `https://jup.ag/swap/SOL-${mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-shill-yellow px-3 py-1.5 text-xs font-bold text-shill-dark hover:bg-shill-yellow/90"
                >
                  Trade on Jupiter
                </a>
                <a href={dexscreenerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-white/60 underline hover:text-white/80">
                  Chart
                </a>
                <a href={pumpUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-white/60 underline hover:text-white/80">
                  pump.fun
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Fee distribution */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">Fee distribution</h2>
          <p className="mt-0.5 text-sm text-white/60">How creator trading fees are split each cycle.</p>
          <div className="mt-4 flex h-8 overflow-hidden rounded-lg bg-white/10">
            {holdersPct > 0 && (
              <div
                className="bg-shill-yellow/80 text-shill-dark flex items-center justify-center text-xs font-medium"
                style={{ width: `${holdersPct}%` }}
                title={`Holders ${holdersPct}%`}
              >
                {holdersPct >= 15 ? `${holdersPct}% HOLDERS` : ""}
              </div>
            )}
            {creatorPct > 0 && (
              <div
                className="bg-emerald-500/80 flex items-center justify-center text-xs font-medium text-white"
                style={{ width: `${creatorPct}%` }}
                title={`Creator ${creatorPct}%`}
              >
                {creatorPct >= 15 ? `${creatorPct}% CREATOR` : ""}
              </div>
            )}
            {burnPct > 0 && (
              <div
                className="bg-orange-500/80 flex items-center justify-center text-xs font-medium text-white"
                style={{ width: `${burnPct}%` }}
                title={`Burn ${burnPct}%`}
              >
                {burnPct >= 15 ? `${burnPct}% BURN` : ""}
              </div>
            )}
            {lpPct > 0 && (
              <div
                className="bg-violet-500/80 flex items-center justify-center text-xs font-medium text-white"
                style={{ width: `${lpPct}%` }}
                title={`LP ${lpPct}%`}
              >
                {lpPct >= 15 ? `${lpPct}% LP` : ""}
              </div>
            )}
            {holdersPct === 0 && creatorPct === 0 && burnPct === 0 && lpPct === 0 && (
              <div className="flex w-full items-center justify-center text-sm text-white/50">Not configured</div>
            )}
          </div>
          <p className="mt-2 text-xs text-white/50">Config is editable — the creator can update the fee split from the dashboard.</p>
        </section>

        {/* Reward status */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${publicData?.rewardLoop?.enabled ? "bg-emerald-500" : "bg-white/30"}`}
              title={publicData?.rewardLoop?.enabled ? "Active" : "Inactive"}
            />
            <span className="text-white">
              {publicData?.rewardLoop?.enabled
                ? `Reward loop active — every ${publicData.rewardLoop.interval_sec}s`
                : "Reward distribution is currently inactive"}
            </span>
          </div>
          {publicData?.rewardLoop?.next_run_at && (
            <p className="mt-1 text-sm text-white/60">Next run: {new Date(publicData.rewardLoop.next_run_at).toLocaleString()}</p>
          )}
        </section>

        {/* Buy / Sell & Chart */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">Trade & chart</h2>
          <p className="mt-0.5 text-sm text-white/60">Use your SOL wallet to buy or sell. View price and chart on DexScreener.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={publicData?.jupiterSwapUrl ?? `https://jup.ag/swap/SOL-${mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-shill-yellow px-6 py-3 font-bold text-shill-dark hover:bg-shill-yellow/90"
            >
              Buy / Sell on Jupiter
            </a>
            <a
              href={dexscreenerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 font-medium text-white hover:bg-white/10"
            >
              Price & chart (DexScreener)
            </a>
          </div>
        </section>

        {/* Active campaign (Shillz-style) */}
        {publicData?.activeCampaign && (
          <section className="rounded-2xl border border-shill-yellow/30 bg-shill-yellow/5 p-6">
            <h2 className="text-lg font-semibold text-white">Shill campaign</h2>
            <p className="mt-0.5 text-sm text-white/70">{publicData.activeCampaign.title}</p>
            {publicData.activeCampaign.description && (
              <p className="mt-1 text-sm text-white/60">{publicData.activeCampaign.description}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="rounded bg-white/10 px-3 py-1.5 text-sm font-medium text-white">
                Reward: {publicData.activeCampaign.reward_mint === "SOL"
                  ? `${Number(publicData.activeCampaign.reward_amount_raw).toFixed(2)} SOL`
                  : publicData.activeCampaign.reward_amount_raw}
              </span>
              <span className="text-sm text-white/60">
                Ends {new Date(publicData.activeCampaign.ends_at).toLocaleDateString()}
              </span>
            </div>
            <div className="mt-4">
              <a
                href={`/campaigns/${publicData.activeCampaign.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-shill-yellow px-5 py-2.5 font-bold text-shill-dark hover:bg-shill-yellow/90"
              >
                Submit your shill
              </a>
            </div>
          </section>
        )}

        {/* Claimable (informational) */}
        {publicData?.claimable && (publicData.claimable.partnerTradingFees > 0 || publicData.claimable.creatorTradingFees > 0) && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white">Claimable fees (pool)</h2>
            <p className="mt-1 text-sm text-white/60">Partner trading: {formatSol(publicData.claimable.partnerTradingFees)} SOL · Creator trading: {formatSol(publicData.claimable.creatorTradingFees)} SOL</p>
          </section>
        )}
      </div>
    </main>
  );
}

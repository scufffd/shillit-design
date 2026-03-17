"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

interface Submission {
  id: string;
  status: string;
  amount_awarded_lamports: number;
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

export default function CampaignDetailPage() {
  const params = useParams();
  const { publicKey } = useWallet();
  const connectedWallet = publicKey?.toBase58() ?? null;
  const id = typeof params?.id === "string" ? params.id : "";
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnFundsLoading, setReturnFundsLoading] = useState(false);
  const [returnFundsError, setReturnFundsError] = useState<string | null>(null);
  const [endCampaignLoading, setEndCampaignLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [campRes, subRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`),
        fetch(`/api/campaigns/${id}/submissions`),
      ]);
      const campData = await campRes.json().catch(() => ({}));
      const subData = await subRes.json().catch(() => ({}));
      if (campRes.ok && campData.id) {
        setCampaign(campData);
        const tokenRes = await fetch(`/api/token/${campData.token_mint}/dex-info`);
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          setTokenInfo(tokenData);
        } else {
          setTokenInfo(null);
        }
      } else {
        setCampaign(null);
      }
      if (subRes.ok) setSubmissions(subData.submissions ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReturnFunds = useCallback(async () => {
    if (!id || !connectedWallet || !campaign || campaign.status !== "ended") return;
    setReturnFundsLoading(true);
    setReturnFundsError(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/return-funds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorWallet: connectedWallet }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Return funds failed");
      await load();
    } catch (e) {
      setReturnFundsError(e instanceof Error ? e.message : "Return funds failed");
    } finally {
      setReturnFundsLoading(false);
    }
  }, [id, connectedWallet, campaign, load]);

  const handleEndCampaign = useCallback(async () => {
    if (!id || !connectedWallet || !campaign || campaign.status === "ended") return;
    setEndCampaignLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorWallet: connectedWallet }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "End campaign failed");
      await load();
    } finally {
      setEndCampaignLoading(false);
    }
  }, [id, connectedWallet, campaign, load]);

  if (loading) {
    return (
      <main className="min-h-screen pt-28 pb-16">
        <div className="mx-auto max-w-6xl px-6 text-center text-white/60">Loading campaign…</div>
      </main>
    );
  }

  if (!campaign) {
    return (
      <main className="min-h-screen pt-28 pb-16">
        <div className="mx-auto max-w-6xl px-6 text-center text-white/70">
          Campaign not found. <Link href="/campaigns" className="text-shill-yellow hover:underline">Back to campaigns</Link>
        </div>
      </main>
    );
  }

  const approved = submissions.filter((s) => s.status === "approved");
  const totalPaid = approved.reduce((a, s) => a + s.amount_awarded_lamports, 0);
  const reserved = totalPaid;
  const available = Math.max(0, campaign.funded_lamports - reserved);
  const reservedPct = campaign.funded_lamports > 0 ? Math.round((reserved / campaign.funded_lamports) * 100) : 0;
  const approvalRate = submissions.length > 0 ? Math.round((approved.length / submissions.length) * 100) : 0;
  const avgPayoutLamports = approved.length > 0 ? Math.floor(totalPaid / approved.length) : 0;

  return (
    <main className="min-h-screen pt-24 pb-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 lg:flex-row">
        {/* Left sidebar: back + token header + stat cards + instructions */}
        <div className="flex-1 space-y-6 lg:max-w-[420px]">
          <Link href="/campaigns" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-shill-yellow">
            ← Back to campaigns
          </Link>

          {/* Token header */}
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
              {tokenInfo?.imageUrl ? (
                <img src={tokenInfo.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-shill-yellow">
                  {(tokenInfo?.symbol ?? campaign.token_mint.slice(0, 2)).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-white">
                {tokenInfo?.name ?? "Unknown"} {tokenInfo?.symbol && <span className="text-white/70">${tokenInfo.symbol}</span>}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <a
                  href={tokenInfo?.dexscreenerUrl ?? `https://dexscreener.com/solana/${campaign.token_mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-shill-yellow hover:underline"
                >
                  Chart
                </a>
                <a
                  href={`https://jup.ag/swap/SOL-${campaign.token_mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-white/60 hover:underline"
                >
                  Trade
                </a>
              </div>
            </div>
            <Link
              href={`/bagworker?campaign=${campaign.id}`}
              className="shrink-0 rounded-full bg-shill-yellow px-5 py-2.5 text-sm font-bold text-shill-dark hover:bg-shill-yellow/90"
            >
              Start earning
            </Link>
          </div>

          {/* Stat cards (Shillz-style grid) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">Avg payout</p>
              <p className="mt-1 text-lg font-bold text-shill-yellow">
                {campaign.reward_mint === "SOL" ? `${formatSol(avgPayoutLamports)} SOL` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">Max payout</p>
              <p className="mt-1 text-lg font-bold text-white">
                {campaign.reward_mint === "SOL" ? `${formatSol(campaign.funded_lamports)} SOL` : campaign.reward_amount_raw}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">Holder req.</p>
              <p className="mt-1 text-lg font-bold text-white">{campaign.holder_requirement_raw ?? "None"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">Time left</p>
              <p className="mt-1 text-lg font-bold text-white">{timeLeft(campaign.ends_at)}</p>
            </div>
          </div>

          {/* Instructions & requirements */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/80">
              Instructions & requirements
            </h3>
            {campaign.description && (
              <p className="mt-3 text-sm text-white/80">{campaign.description}</p>
            )}
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-white/70">
              <li>Submit a link to your shill (tweet, post, video).</li>
              <li>Campaign creator will review and approve or reject.</li>
              <li>Approved submissions are paid from the reward pool.</li>
              {campaign.holder_requirement_raw && (
                <li>Holder requirement: {campaign.holder_requirement_raw}</li>
              )}
            </ul>
          </section>

          {/* Content guidelines */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">Content guidelines</h3>
            <p className="mt-2 text-sm text-white/70">High-quality shilling. Make the case for the token—why it’s interesting or undervalued. No fake engagement.</p>
          </section>
        </div>

        {/* Right sidebar: campaign title, reward pool, submit CTA */}
        <div className="w-full lg:max-w-[380px] lg:shrink-0">
          <div className="sticky top-28 space-y-6">
            <div className="rounded-2xl border border-shill-yellow/20 bg-shill-yellow/5 p-6">
              <h2 className="text-2xl font-bold text-white">{campaign.title}</h2>
              <p className="mt-2 text-sm text-white/70">{campaign.description ?? "Shill and earn."}</p>

              {campaign.holder_requirement_raw && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase text-white/50">Holder requirement</p>
                  <p className="mt-0.5 text-sm text-white">{campaign.holder_requirement_raw}</p>
                  <p className="mt-0.5 text-xs text-white/50">Must be held by participants in their wallet.</p>
                </div>
              )}

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-white/50">Created</p>
                  <p className="text-sm font-medium text-white">{new Date(campaign.starts_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50">Ends</p>
                  <p className="text-sm font-medium text-white">{new Date(campaign.ends_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50">Time left</p>
                  <p className="text-sm font-medium text-shill-yellow">{timeLeft(campaign.ends_at)}</p>
                </div>
              </div>

              {/* Reward pool */}
              <div className="mt-6">
                <p className="text-xs font-medium uppercase text-white/50">Reward pool</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {campaign.reward_mint === "SOL" ? `${formatSol(campaign.funded_lamports)} SOL` : `${campaign.reward_amount_raw} ${campaign.reward_mint}`}
                </p>
                {reserved > 0 && (
                  <p className="mt-1 text-sm text-shill-yellow">+ {campaign.reward_mint === "SOL" ? formatSol(reserved) : reserved} reserved</p>
                )}
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="bg-shill-yellow/80"
                    style={{ width: `${100 - reservedPct}%` }}
                    title="Available"
                  />
                  <div
                    className="bg-white/30"
                    style={{ width: `${reservedPct}%` }}
                    title="Reserved"
                  />
                </div>
                <div className="mt-1 flex justify-between text-xs text-white/50">
                  <span>Available</span>
                  <span>Reserved</span>
                </div>
              </div>

              {connectedWallet === campaign.creator_wallet ? (
                <div className="mt-6 space-y-3">
                  {campaign.status === "ended" && available > 0 && (
                    <>
                      <p className="text-center text-sm text-white/70">Campaign ended. Return remaining SOL to your wallet.</p>
                      {returnFundsError && <p className="text-center text-sm text-red-400">{returnFundsError}</p>}
                      <button
                        type="button"
                        onClick={handleReturnFunds}
                        disabled={returnFundsLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-shill-yellow py-3.5 text-base font-bold text-shill-dark hover:bg-shill-yellow/90 disabled:opacity-50"
                      >
                        {returnFundsLoading ? "Returning…" : `Return ${formatSol(available)} SOL to me`}
                      </button>
                    </>
                  )}
                  {campaign.status !== "ended" && (
                    <>
                      <Link
                        href={`/bagworker?id=${campaign.id}&manage=1`}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 py-3.5 text-base font-bold text-white hover:bg-emerald-600"
                      >
                        Manage campaign — review & pay
                      </Link>
                      <button
                        type="button"
                        onClick={handleEndCampaign}
                        disabled={endCampaignLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-transparent py-3 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-50"
                      >
                        {endCampaignLoading ? "Ending…" : "End campaign (then return remaining funds)"}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <Link
                  href={`/bagworker?campaign=${campaign.id}`}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-shill-yellow py-3.5 text-base font-bold text-shill-dark hover:bg-shill-yellow/90"
                >
                  Login to submit →
                </Link>
              )}
            </div>

            {/* Performance */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">Performance</h3>
              <div className="mt-4 flex gap-6">
                <div>
                  <p className="text-xs text-white/50">Approval rate</p>
                  <p className="text-xl font-bold text-shill-yellow">{approvalRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-white/50">Submissions</p>
                  <p className="text-xl font-bold text-white">{submissions.length}</p>
                </div>
              </div>
              {approved.length > 0 && (
                <p className="mt-3 text-xs text-white/50">Recent approvals: {approved.length} paid</p>
              )}
            </div>

            {tokenInfo?.marketCap != null && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/50">Token market cap</p>
                <p className="mt-1 font-semibold text-white">{formatMarketCap(tokenInfo.marketCap)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

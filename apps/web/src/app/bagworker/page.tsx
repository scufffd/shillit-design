"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

interface PlatformRequirements {
  min_account_age_days?: number;
  min_followers?: number;
  min_raw_views?: number;
  allowed_communities?: string[];
}

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
  escrow_public_key?: string | null;
  content_guidelines?: string | null;
  platform_requirements?: PlatformRequirements | null;
  content_requirements?: string | null;
  rate_per_1k_lamports?: number | null;
  max_payout_lamports?: number | null;
}

interface Submission {
  id: string;
  campaign_id: string;
  submitter_wallet: string;
  content_url: string;
  description: string | null;
  status: string;
  amount_awarded_lamports: number;
  payout_tx_sig: string | null;
  created_at: string;
  payout_views?: number | null;
}

function formatSol(lamports: number): string {
  return (lamports / 1e9).toFixed(4);
}

function shortWallet(w: string): string {
  if (w.length <= 12) return w;
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

function BagworkerContent() {
  const searchParams = useSearchParams();
  const { publicKey, connected, connect, disconnect, select, wallets } = useWallet();
  const connectedWallet = publicKey?.toBase58() ?? null;

  const campaignId = searchParams.get("campaign");
  const manageId = searchParams.get("id");
  const manage = searchParams.get("manage") === "1";
  const view = searchParams.get("view");
  const tokenMintParam = searchParams.get("tokenMint");
  const creatorParam = searchParams.get("creator");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listTokenMint, setListTokenMint] = useState(tokenMintParam ?? "");
  const [listCreator, setListCreator] = useState(creatorParam ?? "");

  // Create form state
  const [createTokenMint, setCreateTokenMint] = useState("");
  const [createCreator, setCreateCreator] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createReward, setCreateReward] = useState("");
  const [createStarts, setCreateStarts] = useState("");
  const [createEnds, setCreateEnds] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createContentGuidelines, setCreateContentGuidelines] = useState("");
  const [createContentRequirements, setCreateContentRequirements] = useState("");
  const [createPlatformMinAge, setCreatePlatformMinAge] = useState("");
  const [createPlatformMinFollowers, setCreatePlatformMinFollowers] = useState("");
  const [createPlatformMinViews, setCreatePlatformMinViews] = useState("");
  const [createPlatformCommunities, setCreatePlatformCommunities] = useState("");
  const [createRatePer1kSol, setCreateRatePer1kSol] = useState("");
  const [createMaxPayoutSol, setCreateMaxPayoutSol] = useState("");
  const [createGuidelinesOpen, setCreateGuidelinesOpen] = useState(false);
  const [createdCampaign, setCreatedCampaign] = useState<Campaign | null>(null);
  const [fundTxSig, setFundTxSig] = useState("");
  const [fundSubmitting, setFundSubmitting] = useState(false);
  const [escrowAddress, setEscrowAddress] = useState<string | null>(null); // from createdCampaign.escrow_public_key or fetched by id

  // Submit shill form
  const [submitWallet, setSubmitWallet] = useState("");
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitDesc, setSubmitDesc] = useState("");
  const [submitSubmitting, setSubmitSubmitting] = useState(false);

  // Review state (creator)
  const [reviewerWallet, setReviewerWallet] = useState("");
  const [reviewAmount, setReviewAmount] = useState("");
  const [reviewPayoutViews, setReviewPayoutViews] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [paySubmitting, setPaySubmitting] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    if (listTokenMint.trim()) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/campaigns?tokenMint=${encodeURIComponent(listTokenMint.trim())}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) setCampaigns(data.campaigns ?? []);
        else setError(data.error ?? "Failed to load campaigns");
      } finally {
        setLoading(false);
      }
    } else if (listCreator.trim()) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/campaigns?creatorWallet=${encodeURIComponent(listCreator.trim())}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) setCampaigns(data.campaigns ?? []);
        else setError(data.error ?? "Failed to load campaigns");
      } finally {
        setLoading(false);
      }
    } else {
      setCampaigns([]);
    }
  }, [listTokenMint, listCreator]);

  useEffect(() => {
    if (campaignId) {
      setLoading(true);
      setError(null);
      fetch(`/api/campaigns/${campaignId}`)
        .then((r) => r.json())
        .then((c) => {
          setCampaign(c.id ? c : null);
          if (c.error) setError(c.error);
        })
        .catch(() => setError("Failed to load campaign"))
        .finally(() => setLoading(false));
    } else {
      setCampaign(null);
    }
  }, [campaignId]);

  useEffect(() => {
    if (manageId) {
      setLoading(true);
      fetch(`/api/campaigns/${manageId}`)
        .then((r) => r.json())
        .then((c) => {
          setCampaign(c.id ? c : null);
        })
        .finally(() => setLoading(false));
    }
  }, [manageId]);

  useEffect(() => {
    if (!createdCampaign) {
      setEscrowAddress(null);
      return;
    }
    if (createdCampaign.escrow_public_key) {
      setEscrowAddress(createdCampaign.escrow_public_key);
      return;
    }
    fetch(`/api/campaigns/${createdCampaign.id}/escrow`)
      .then((r) => r.json())
      .then((d) => d.escrowAddress && setEscrowAddress(d.escrowAddress))
      .catch(() => {});
  }, [createdCampaign]);

  useEffect(() => {
    if ((manageId || campaignId) && campaign?.id) {
      fetch(`/api/campaigns/${campaign.id}/submissions`)
        .then((r) => r.json())
        .then((d) => setSubmissions(d.submissions ?? []))
        .catch(() => setSubmissions([]));
    } else {
      setSubmissions([]);
    }
  }, [manageId, campaignId, campaign?.id]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTokenMint.trim() || !createCreator.trim() || !createTitle.trim() || !createReward.trim() || !createStarts.trim() || !createEnds.trim()) {
      setError("Fill required fields");
      return;
    }
    setCreateSubmitting(true);
    setError(null);
    try {
      const platformReq =
        createPlatformMinAge.trim() || createPlatformMinFollowers.trim() || createPlatformMinViews.trim() || createPlatformCommunities.trim()
          ? {
              min_account_age_days: createPlatformMinAge.trim() ? parseInt(createPlatformMinAge, 10) : undefined,
              min_followers: createPlatformMinFollowers.trim() ? parseInt(createPlatformMinFollowers, 10) : undefined,
              min_raw_views: createPlatformMinViews.trim() ? parseInt(createPlatformMinViews, 10) : undefined,
              allowed_communities: createPlatformCommunities.trim() ? createPlatformCommunities.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
            }
          : undefined;
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenMint: createTokenMint.trim(),
          creatorWallet: createCreator.trim(),
          title: createTitle.trim(),
          description: createDesc.trim() || undefined,
          rewardMint: "SOL",
          rewardAmountRaw: createReward.trim(),
          startsAt: new Date(createStarts).toISOString(),
          endsAt: new Date(createEnds).toISOString(),
          contentGuidelines: createContentGuidelines.trim() || null,
          contentRequirements: createContentRequirements.trim() || null,
          platformRequirements: platformReq ?? null,
          ratePer1kLamports: createRatePer1kSol.trim() ? Math.round(parseFloat(createRatePer1kSol) * 1e9) : null,
          maxPayoutLamports: createMaxPayoutSol.trim() ? Math.round(parseFloat(createMaxPayoutSol) * 1e9) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.campaign) {
        setCreatedCampaign(data.campaign);
        setError(null);
      } else {
        setError(data.error ?? "Failed to create campaign");
      }
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleFundCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdCampaign || !fundTxSig.trim()) return;
    setFundSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${createdCampaign.id}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundingTxSignature: fundTxSig.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.campaign) {
        setCreatedCampaign(data.campaign);
        setFundTxSig("");
      } else {
        setError(data.error ?? "Funding verification failed");
      }
    } finally {
      setFundSubmitting(false);
    }
  };

  const handleSubmitShill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId || !submitWallet.trim() || !submitUrl.trim()) return;
    setSubmitSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitterWallet: submitWallet.trim(),
          contentUrl: submitUrl.trim(),
          description: submitDesc.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSubmitUrl("");
        setSubmitDesc("");
        setSubmissions((prev) => [data.submission, ...prev].filter(Boolean));
      } else {
        setError(data.error ?? "Failed to submit");
      }
    } finally {
      setSubmitSubmitting(false);
    }
  };

  const handleReview = async (subId: string, status: "approved" | "rejected") => {
    if (!campaign?.id || !effectiveReviewerWallet) return;
    const payoutViewsNum = reviewPayoutViews.trim() ? parseInt(reviewPayoutViews, 10) : undefined;
    const useFormula = status === "approved" && payoutViewsNum != null && !Number.isNaN(payoutViewsNum) && campaign.rate_per_1k_lamports != null && campaign.rate_per_1k_lamports > 0 && campaign.max_payout_lamports != null;
    const amount = status === "approved" && !useFormula ? Math.floor(Number(reviewAmount) * 1e9) : 0;
    if (status === "approved" && !useFormula && amount <= 0) {
      setError("Enter SOL amount when approving, or set campaign rate/max and enter Payout views");
      return;
    }
    setReviewSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/submissions/${subId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewerWallet: effectiveReviewerWallet,
          status,
          amountAwardedLamports: useFormula ? 0 : amount,
          payoutViews: useFormula ? payoutViewsNum : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSubmissions((prev) => prev.map((s) => (s.id === subId ? data.submission : s)));
      } else {
        setError(data.error ?? "Review failed");
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handlePay = async () => {
    if (!campaign?.id || !effectiveReviewerWallet) return;
    setPaySubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payerWallet: effectiveReviewerWallet }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const listRes = await fetch(`/api/campaigns/${campaign.id}/submissions`);
        const listData = await listRes.json().catch(() => ({}));
        setSubmissions(listData.submissions ?? []);
      } else {
        setError(data.error ?? "Pay failed");
      }
    } finally {
      setPaySubmitting(false);
    }
  };

  const handleProjectLogin = useCallback(async () => {
    if (!wallets.length) return;
    if (!publicKey && wallets.length) select(wallets[0].adapter.name);
    await connect();
  }, [wallets, connect, select, publicKey]);

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

  useEffect(() => {
    if (manageId && manage && campaign && connectedWallet && campaign.creator_wallet === connectedWallet) {
      setReviewerWallet(connectedWallet);
    }
  }, [manageId, manage, campaign?.id, campaign?.creator_wallet, connectedWallet]);

  const showSubmitForm = Boolean(campaignId && campaign);
  const showManage = Boolean(manageId && manage && campaign);
  const showCreate = view === "create";
  const showList = !showSubmitForm && !showManage && !showCreate;
  const isCreator = campaign && connectedWallet && campaign.creator_wallet === connectedWallet;
  const effectiveReviewerWallet = (showManage && isCreator ? connectedWallet : reviewerWallet.trim()) ?? "";

  return (
    <main className="mx-auto max-w-2xl px-6 pt-24 pb-16">
      <h1 className="text-3xl font-bold text-white">Shill campaigns</h1>
      <p className="mt-2 text-white/70">
        Create bounties for your token or submit shills (tweets, content) to earn rewards. Funds are locked in escrow until payouts or admin return.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {connected ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-shill-yellow/30 bg-shill-yellow/5 px-4 py-2">
            <span className="text-sm font-medium text-shill-yellow">Project login</span>
            <span className="text-sm text-white/80">{shortWallet(connectedWallet!)}</span>
            <button
              type="button"
              onClick={() => disconnect()}
              className="rounded bg-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/20"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleProjectLogin}
            className="rounded-xl border border-shill-yellow/50 bg-shill-yellow/10 px-4 py-2.5 text-sm font-semibold text-shill-yellow hover:bg-shill-yellow/20"
          >
            Project login — connect wallet to manage campaigns
          </button>
        )}
      </div>

      <nav className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/campaigns"
          className={`rounded-lg px-4 py-2 text-sm font-medium ${showList ? "bg-shill-yellow text-shill-dark" : "bg-white/10 text-white hover:bg-white/20"}`}
        >
          Browse campaigns
        </Link>
        <Link
          href="/bagworker?view=create"
          className={`rounded-lg px-4 py-2 text-sm font-medium ${showCreate ? "bg-shill-yellow text-shill-dark" : "bg-white/10 text-white hover:bg-white/20"}`}
        >
          Create campaign
        </Link>
      </nav>

      {connected && myCampaigns.length > 0 && (
        <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/70">Your campaigns</h2>
          <ul className="mt-3 space-y-2">
            {myCampaigns.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-white">{c.title}</span>
                <div className="flex gap-2">
                  <Link
                    href={`/campaigns/${c.id}`}
                    className="rounded border border-white/20 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
                  >
                    View
                  </Link>
                  <Link
                    href={`/bagworker?id=${c.id}&manage=1`}
                    className="rounded bg-shill-yellow/20 px-2 py-1 text-xs font-medium text-shill-yellow hover:bg-shill-yellow/30"
                  >
                    Manage
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* List campaigns */}
      {showList && (
        <section className="mt-8 space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Token mint (CA)"
              value={listTokenMint}
              onChange={(e) => setListTokenMint(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/40"
            />
            <span className="text-white/50">or</span>
            <input
              type="text"
              placeholder="Creator wallet"
              value={listCreator}
              onChange={(e) => setListCreator(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/40"
            />
            <button
              type="button"
              onClick={fetchCampaigns}
              disabled={loading}
              className="rounded-lg bg-shill-yellow px-4 py-2 font-bold text-shill-dark hover:bg-shill-yellow/90 disabled:opacity-50"
            >
              {loading ? "Loading…" : "Load campaigns"}
            </button>
          </div>
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-white">{c.title}</h3>
                    <p className="mt-0.5 text-sm text-white/60">
                      Reward: {c.reward_mint === "SOL" ? `${c.reward_amount_raw} SOL` : c.reward_amount_raw} · {c.status}
                    </p>
                    <p className="text-xs text-white/50">Ends {new Date(c.ends_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link
                      href={`/bagworker?campaign=${c.id}`}
                      className="rounded bg-shill-yellow px-3 py-1.5 text-sm font-bold text-shill-dark hover:bg-shill-yellow/90"
                    >
                      Submit shill
                    </Link>
                    <Link
                      href={`/bagworker?id=${c.id}&manage=1`}
                      className="rounded border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {!loading && campaigns.length === 0 && (listTokenMint || listCreator) && (
              <p className="text-sm text-white/50">No campaigns found. Try another token or creator.</p>
            )}
          </div>
        </section>
      )}

      {/* Create campaign */}
      {showCreate && (
        <section className="mt-8 space-y-6">
          {!createdCampaign ? (
            <form onSubmit={handleCreateCampaign} className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white">New campaign</h2>
              <input
                type="text"
                placeholder="Token mint (CA) *"
                value={createTokenMint}
                onChange={(e) => setCreateTokenMint(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/40"
              />
              <input
                type="text"
                placeholder="Your wallet (creator) *"
                value={createCreator}
                onChange={(e) => setCreateCreator(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/40"
              />
              <input
                type="text"
                placeholder="Campaign title *"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/40"
              />
              <textarea
                placeholder="Description (optional)"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/40"
              />
              <input
                type="text"
                placeholder="Reward amount (SOL) *"
                value={createReward}
                onChange={(e) => setCreateReward(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/40"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="datetime-local"
                  placeholder="Starts *"
                  value={createStarts}
                  onChange={(e) => setCreateStarts(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white"
                />
                <input
                  type="datetime-local"
                  placeholder="Ends *"
                  value={createEnds}
                  onChange={(e) => setCreateEnds(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white"
                />
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setCreateGuidelinesOpen((o) => !o)}
                  className="text-sm font-medium text-white/80 hover:text-white"
                >
                  {createGuidelinesOpen ? "▼" : "▶"} Content guidelines & payout formula (optional)
                </button>
                {createGuidelinesOpen && (
                  <div className="mt-3 space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
                    <label className="block">
                      <span className="text-xs text-white/50">What we're looking for / guidelines (markdown ok)</span>
                      <textarea
                        value={createContentGuidelines}
                        onChange={(e) => setCreateContentGuidelines(e.target.value)}
                        rows={4}
                        placeholder="High effort posts, authenticity, substance..."
                        className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-white/50">Content requirements (e.g. must use #TICKER, token CA, no AI slop)</span>
                      <input
                        type="text"
                        value={createContentRequirements}
                        onChange={(e) => setCreateContentRequirements(e.target.value)}
                        placeholder="must use #TICKER · token CA required · no ai slop"
                        className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs text-white/50">Min account age (days)</span>
                        <input type="number" min={0} value={createPlatformMinAge} onChange={(e) => setCreatePlatformMinAge(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white" />
                      </label>
                      <label className="block">
                        <span className="text-xs text-white/50">Min followers</span>
                        <input type="number" min={0} value={createPlatformMinFollowers} onChange={(e) => setCreatePlatformMinFollowers(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white" />
                      </label>
                      <label className="block">
                        <span className="text-xs text-white/50">Min raw views</span>
                        <input type="number" min={0} value={createPlatformMinViews} onChange={(e) => setCreatePlatformMinViews(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white" />
                      </label>
                      <label className="block col-span-2">
                        <span className="text-xs text-white/50">Allowed communities (comma-separated)</span>
                        <input type="text" value={createPlatformCommunities} onChange={(e) => setCreatePlatformCommunities(e.target.value)} placeholder="Y2K DOTCOM, ..." className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40" />
                      </label>
                    </div>
                    <p className="text-xs text-white/50">Payout formula: Payment = (payout views ÷ 1000) × rate per 1K, capped at max. Views* = engagement-adjusted.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs text-white/50">Rate per 1K views (SOL)</span>
                        <input type="text" value={createRatePer1kSol} onChange={(e) => setCreateRatePer1kSol(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.01" className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40" />
                      </label>
                      <label className="block">
                        <span className="text-xs text-white/50">Max payout per submission (SOL)</span>
                        <input type="text" value={createMaxPayoutSol} onChange={(e) => setCreateMaxPayoutSol(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="1" className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40" />
                      </label>
                    </div>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={createSubmitting}
                className="mt-4 w-full rounded-lg bg-shill-yellow py-2.5 font-bold text-shill-dark hover:bg-shill-yellow/90 disabled:opacity-50"
              >
                {createSubmitting ? "Creating…" : "Create campaign (draft)"}
              </button>
            </form>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white">Fund campaign</h2>
              <p className="mt-2 text-sm text-white/70">
                Send exactly <strong>{createdCampaign.reward_amount_raw} SOL</strong> to the escrow address below. Then paste the transaction signature.
              </p>
              {escrowAddress ? (
                <p className="mt-2 rounded bg-white/10 px-3 py-2 font-mono text-sm text-white break-all">
                  {escrowAddress}
                </p>
              ) : (
                <p className="mt-2 text-sm text-white/50">Loading escrow address…</p>
              )}
              <p className="mt-1 text-xs text-white/50">
                Campaign ID: {createdCampaign.id}. After funding, the campaign becomes active.
              </p>
              {createdCampaign.status === "active" ? (
                <p className="mt-4 text-emerald-400">Campaign is active. Share the link: /bagworker?campaign={createdCampaign.id}</p>
              ) : (
                <form onSubmit={handleFundCampaign} className="mt-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Funding transaction signature"
                    value={fundTxSig}
                    onChange={(e) => setFundTxSig(e.target.value)}
                    className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/40"
                  />
                  <button
                    type="submit"
                    disabled={fundSubmitting}
                    className="w-full rounded-lg bg-shill-yellow py-2.5 font-bold text-shill-dark hover:bg-shill-yellow/90 disabled:opacity-50"
                  >
                    {fundSubmitting ? "Verifying…" : "Confirm funding"}
                  </button>
                </form>
              )}
            </div>
          )}
        </section>
      )}

      {/* Submit shill (when ?campaign=id) */}
      {showSubmitForm && campaign && (
        <section className="mt-8 space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold text-white">{campaign.title}</h3>
            <p className="mt-1 text-sm text-white/70">
              Reward: {campaign.reward_mint === "SOL" ? `${campaign.reward_amount_raw} SOL` : campaign.reward_amount_raw} · Ends {new Date(campaign.ends_at).toLocaleDateString()}
            </p>
          </div>
          {(campaign.content_guidelines || campaign.content_requirements || campaign.platform_requirements) && (
            <div className="rounded-xl border border-shill-yellow/20 bg-white/5 p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white/80">Content guidelines</h4>
              {campaign.content_guidelines && (
                <div className="mt-2 text-sm text-white/80 whitespace-pre-wrap">{campaign.content_guidelines}</div>
              )}
              {campaign.platform_requirements && (campaign.platform_requirements.min_account_age_days != null || campaign.platform_requirements.min_followers != null || campaign.platform_requirements.min_raw_views != null || (campaign.platform_requirements.allowed_communities?.length ?? 0) > 0) && (
                <div className="mt-3 text-xs text-white/70">
                  <span className="font-medium">Platform: </span>
                  {campaign.platform_requirements.min_account_age_days != null && `${campaign.platform_requirements.min_account_age_days}+ days account age`}
                  {campaign.platform_requirements.min_followers != null && ` · ${campaign.platform_requirements.min_followers}+ followers`}
                  {campaign.platform_requirements.min_raw_views != null && ` · ${campaign.platform_requirements.min_raw_views}+ min raw views`}
                  {campaign.platform_requirements.allowed_communities?.length ? ` · Allowed: ${campaign.platform_requirements.allowed_communities.join(", ")}` : ""}
                </div>
              )}
              {campaign.content_requirements && (
                <p className="mt-2 text-xs text-white/60"><span className="font-medium">Requirements: </span>{campaign.content_requirements}</p>
              )}
            </div>
          )}
          <form onSubmit={handleSubmitShill} className="space-y-4 rounded-xl border border-shill-yellow/30 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white">Submit your shill</h2>
            <input
              type="text"
              placeholder="Your wallet address *"
              value={submitWallet}
              onChange={(e) => setSubmitWallet(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/40"
            />
            <input
              type="url"
              placeholder="Content URL (e.g. tweet link) *"
              value={submitUrl}
              onChange={(e) => setSubmitUrl(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/40"
            />
            <textarea
              placeholder="Short description (optional)"
              value={submitDesc}
              onChange={(e) => setSubmitDesc(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/40"
            />
            <button
              type="submit"
              disabled={submitSubmitting}
              className="w-full rounded-lg bg-shill-yellow py-2.5 font-bold text-shill-dark hover:bg-shill-yellow/90 disabled:opacity-50"
            >
              {submitSubmitting ? "Submitting…" : "Submit"}
            </button>
          </form>
        </section>
      )}

      {/* Manage campaign (creator: submissions, approve/reject, pay) */}
      {showManage && campaign && (
        <section className="mt-8 space-y-6">
          {isCreator ? (
            <div className="rounded-xl border border-shill-yellow/30 bg-shill-yellow/5 p-4">
              <h3 className="font-semibold text-white">You’re managing as creator</h3>
              <p className="mt-1 text-sm text-white/80">
                Connected wallet matches this campaign’s creator. You can review submissions and pay shillers below.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-shill-yellow/30 bg-shill-yellow/5 p-4">
              <h3 className="font-semibold text-white">Verify & pay as creator</h3>
              <p className="mt-1 text-sm text-white/80">
                Connect the wallet that created this campaign (use Project login above), or paste the creator wallet below. Only that wallet can approve/reject and trigger payouts.
              </p>
            </div>
          )}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold text-white">{campaign.title}</h3>
            <p className="mt-1 text-sm text-white/70">
              Funded: {formatSol(campaign.funded_lamports)} SOL · Status: {campaign.status}
            </p>
            <p className="text-xs text-white/50">Creator: {shortWallet(campaign.creator_wallet)}</p>
          </div>
          {(campaign.content_guidelines || campaign.content_requirements || campaign.platform_requirements) && (
            <div className="rounded-xl border border-shill-yellow/20 bg-white/5 p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white/80">Content guidelines</h4>
              {campaign.content_guidelines && <div className="mt-2 text-sm text-white/80 whitespace-pre-wrap">{campaign.content_guidelines}</div>}
              {campaign.platform_requirements && (campaign.platform_requirements.min_account_age_days != null || campaign.platform_requirements.min_followers != null || campaign.platform_requirements.min_raw_views != null || (campaign.platform_requirements.allowed_communities?.length ?? 0) > 0) && (
                <div className="mt-3 text-xs text-white/70">
                  Platform: {campaign.platform_requirements.min_account_age_days != null && `${campaign.platform_requirements.min_account_age_days}+ days`}
                  {campaign.platform_requirements.min_followers != null && ` · ${campaign.platform_requirements.min_followers}+ followers`}
                  {campaign.platform_requirements.min_raw_views != null && ` · ${campaign.platform_requirements.min_raw_views}+ min views`}
                  {campaign.platform_requirements.allowed_communities?.length ? ` · ${campaign.platform_requirements.allowed_communities.join(", ")}` : ""}
                </div>
              )}
              {campaign.content_requirements && <p className="mt-2 text-xs text-white/60">Requirements: {campaign.content_requirements}</p>}
            </div>
          )}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label className="block text-sm font-medium text-white">Creator wallet (required to review & pay)</label>
            {isCreator ? (
              <p className="mt-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-mono text-sm text-white/90">
                {shortWallet(campaign.creator_wallet)} (connected)
              </p>
            ) : (
              <>
                <p className="mt-0.5 text-xs text-white/50">Paste the wallet that created this campaign, or connect it via Project login above.</p>
                <input
                  type="text"
                  value={reviewerWallet}
                  onChange={(e) => setReviewerWallet(e.target.value)}
                  placeholder="e.g. 7xKX...abc1"
                  className="mt-2 w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/40"
                />
              </>
            )}
            {(campaign.rate_per_1k_lamports != null && campaign.rate_per_1k_lamports > 0 && campaign.max_payout_lamports != null) ? (
              <>
                <p className="mt-2 text-xs text-white/50">Payment = (payout views ÷ 1000) × rate, capped at max. Enter payout views* (engagement-adjusted).</p>
                <input
                  type="number"
                  min={0}
                  value={reviewPayoutViews}
                  onChange={(e) => setReviewPayoutViews(e.target.value)}
                  placeholder="Payout views (e.g. 5000)"
                  className="mt-2 w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/40"
                />
                {reviewPayoutViews.trim() && !Number.isNaN(parseInt(reviewPayoutViews, 10)) && (
                  <p className="mt-1 text-xs text-shill-green">
                    Computed: {formatSol(Math.min(campaign.max_payout_lamports, Math.floor((parseInt(reviewPayoutViews, 10) / 1000) * campaign.rate_per_1k_lamports!)))} SOL (max {formatSol(campaign.max_payout_lamports)} SOL)
                  </p>
                )}
              </>
            ) : (
              <input
                type="text"
                value={reviewAmount}
                onChange={(e) => setReviewAmount(e.target.value)}
                placeholder="SOL amount to award when approving"
                className="mt-2 w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/40"
              />
            )}
          </div>
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Submissions</h2>
              {submissions.some((s) => s.status === "approved" && !s.payout_tx_sig) && (
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={paySubmitting}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {paySubmitting ? "Paying…" : "Pay approved"}
                </button>
              )}
            </div>
            <ul className="mt-3 space-y-2">
              {submissions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="min-w-0">
                    <a href={s.content_url} target="_blank" rel="noopener noreferrer" className="text-sm text-shill-yellow underline truncate block">
                      {s.content_url}
                    </a>
                    <p className="text-xs text-white/50">{shortWallet(s.submitter_wallet)} · {s.status}</p>
                    {(s.amount_awarded_lamports > 0 || (s.payout_views != null && s.payout_views > 0)) && (
                      <p className="text-xs text-white/60">
                        Awarded: {formatSol(s.amount_awarded_lamports)} SOL
                        {s.payout_views != null && s.payout_views > 0 && ` (${s.payout_views.toLocaleString()} payout views)`}
                        {s.payout_tx_sig ? " ✓ Paid" : ""}
                      </p>
                    )}
                  </div>
                  {s.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleReview(s.id, "approved")}
                        disabled={reviewSubmitting}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReview(s.id, "rejected")}
                        disabled={reviewSubmitting}
                        className="rounded bg-red-600/80 px-2 py-1 text-xs text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {submissions.length === 0 && <p className="mt-2 text-sm text-white/50">No submissions yet.</p>}
          </div>
        </section>
      )}
    </main>
  );
}

export default function BagworkerPage() {
  return (
    <Suspense fallback={<main className="min-h-screen pt-24 flex items-center justify-center text-white/70">Loading…</main>}>
      <BagworkerContent />
    </Suspense>
  );
}

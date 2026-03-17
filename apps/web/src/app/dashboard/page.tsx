"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";

type TokenRow = { token_mint: string; search_query: string };

type Claimable = {
  partnerTradingClaimable?: number;
  creatorTradingClaimable?: number;
  creatorLpClaimable?: number;
};

type DistributionSplit = {
  holdersPct: number;
  creatorPct: number;
  buysPct: number;
  burnPct: number;
  lpPct: number;
  creatorWallet?: string | null;
  burnOnBuyback?: boolean;
};

type RewardLoop = {
  token_mint: string;
  interval_sec: number;
  distribution_split: DistributionSplit | null;
  enabled: boolean;
  next_run_at: string | null;
  updated_at: string;
};

type TokenDetail = {
  mint: string;
  creatorWallet: string | null;
  rewardLoop: RewardLoop | null;
  claimable: Claimable | null;
  isCreator: boolean;
};

const defaultSplit: DistributionSplit = {
  holdersPct: 50,
  creatorPct: 20,
  buysPct: 10,
  burnPct: 10,
  lpPct: 10,
  creatorWallet: null,
  burnOnBuyback: true,
};

function base64ToUint8Array(base64: string): Uint8Array {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function formatInterval(sec: number): string {
  if (sec >= 60) return `Every ${Math.round(sec / 60)}m`;
  return `Every ${sec}s`;
}

export default function DashboardPage() {
  const { connection } = useConnection();
  const { publicKey, connected, connect, disconnect, select, signTransaction, wallets } = useWallet();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [detail, setDetail] = useState<TokenDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [splitForm, setSplitForm] = useState<DistributionSplit>(defaultSplit);
  const [solBalance, setSolBalance] = useState<number | null>(null);

  const wallet = publicKey?.toBase58() ?? null;
  const filteredTokens = searchQuery.trim()
    ? tokens.filter(
        (t) =>
          t.token_mint.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.search_query && t.search_query.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : tokens;

  const loadTokens = useCallback(async () => {
    if (!wallet) {
      setTokens([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/tokens?wallet=${encodeURIComponent(wallet)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load tokens");
      }
      const data = await res.json();
      setTokens(data.tokens ?? []);
      if (selectedMint && !(data.tokens ?? []).some((t: TokenRow) => t.token_mint === selectedMint)) {
        setSelectedMint(null);
        setDetail(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tokens");
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }, [wallet, selectedMint]);

  const loadDetail = useCallback(async () => {
    if (!selectedMint || !wallet) {
      setDetail(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/dashboard/tokens/${encodeURIComponent(selectedMint)}?wallet=${encodeURIComponent(wallet)}`
      );
      if (!res.ok) {
        setDetail(null);
        return;
      }
      const data = await res.json();
      setDetail(data);
      if (data.rewardLoop?.distribution_split) {
        const s = data.rewardLoop.distribution_split;
        setSplitForm({
          holdersPct: s.holdersPct ?? defaultSplit.holdersPct,
          creatorPct: s.creatorPct ?? defaultSplit.creatorPct,
          buysPct: s.buysPct ?? defaultSplit.buysPct,
          burnPct: s.burnPct ?? defaultSplit.burnPct,
          lpPct: s.lpPct ?? defaultSplit.lpPct,
          creatorWallet: s.creatorWallet ?? null,
          burnOnBuyback: s.burnOnBuyback ?? true,
        });
      } else {
        setSplitForm({ ...defaultSplit, creatorWallet: wallet });
      }
    } catch {
      setDetail(null);
    }
  }, [selectedMint, wallet]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (publicKey && connected) {
      connection.getBalance(publicKey).then((v) => setSolBalance(v / 1e9)).catch(() => setSolBalance(null));
    } else {
      setSolBalance(null);
    }
  }, [publicKey, connected, connection, selectedMint, detail]);

  const handleConnect = useCallback(async () => {
    if (!wallets.length) {
      setError("No wallet detected. Install Phantom or Solflare.");
      return;
    }
    try {
      if (!publicKey && wallets.length) {
        select(wallets[0].adapter.name);
      }
      await connect();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect.");
    }
  }, [wallets, connect, select, publicKey]);

  const claimCreatorTrading = useCallback(async () => {
    if (!wallet || !selectedMint || !signTransaction) return;
    setBusy("claim");
    setError(null);
    try {
      const res = await fetch("/api/fees/claim-creator-trading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint: selectedMint, creatorWallet: wallet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim failed");
      const txBase64 = data.transaction;
      if (!txBase64) throw new Error("No transaction returned");
      const raw = base64ToUint8Array(txBase64);
      const tx = VersionedTransaction.deserialize(raw);
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      await connection.confirmTransaction(sig, "confirmed");
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setBusy(null);
    }
  }, [wallet, selectedMint, signTransaction, connection, loadDetail]);

  const rewardsStart = useCallback(async () => {
    if (!wallet || !selectedMint) return;
    setBusy("start");
    setError(null);
    try {
      const res = await fetch(`/api/rewards/${encodeURIComponent(selectedMint)}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, intervalSec: 300 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Start failed");
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Start failed");
    } finally {
      setBusy(null);
    }
  }, [wallet, selectedMint, loadDetail]);

  const rewardsStop = useCallback(async () => {
    if (!wallet || !selectedMint) return;
    setBusy("stop");
    setError(null);
    try {
      const res = await fetch(`/api/rewards/${encodeURIComponent(selectedMint)}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Stop failed");
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stop failed");
    } finally {
      setBusy(null);
    }
  }, [wallet, selectedMint, loadDetail]);

  const rewardsRunNow = useCallback(async () => {
    if (!wallet || !selectedMint) return;
    setBusy("run");
    setError(null);
    try {
      const res = await fetch(`/api/rewards/${encodeURIComponent(selectedMint)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Run failed");
      if (data.success === false && data.error) setError(data.error);
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(null);
    }
  }, [wallet, selectedMint, loadDetail]);

  const saveRewardSettings = useCallback(async () => {
    if (!wallet || !selectedMint) return;
    const sum = splitForm.holdersPct + splitForm.creatorPct + splitForm.buysPct + splitForm.burnPct + splitForm.lpPct;
    if (sum !== 100) {
      setError("Split must sum to 100%");
      return;
    }
    setBusy("settings");
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/tokens/${encodeURIComponent(selectedMint)}/reward-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, distributionSplit: splitForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setRewardModalOpen(false);
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }, [wallet, selectedMint, splitForm, loadDetail]);

  const devSell = useCallback(
    async (percent: number) => {
      if (!wallet || !selectedMint || !signTransaction) return;
      setBusy(`sell-${percent}`);
      setError(null);
      try {
        const res = await fetch(`/api/dashboard/tokens/${encodeURIComponent(selectedMint)}/sell`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet, percent, slippageBps: 1500 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Sell failed");
        const txBase64 = data.swapTransactionBase64;
        if (!txBase64) throw new Error("No transaction returned");
        const raw = base64ToUint8Array(txBase64);
        const tx = VersionedTransaction.deserialize(raw);
        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });
        await connection.confirmTransaction(sig, "confirmed");
        await loadDetail();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sell failed");
      } finally {
        setBusy(null);
      }
    },
    [wallet, selectedMint, signTransaction, connection, loadDetail]
  );

  const selectedToken = selectedMint ? tokens.find((t) => t.token_mint === selectedMint) : null;

  if (!connected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-16">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">Creator dashboard</h1>
        <p className="mt-2 text-center text-white/70">
          Connect your wallet to see tokens you&apos;ve launched and manage fees, rewards, and dev sell.
        </p>
        <button
          type="button"
          onClick={handleConnect}
          className="mt-8 rounded-xl bg-shill-yellow px-8 py-4 font-semibold uppercase tracking-wider text-shill-dark transition hover:bg-shill-yellow/90"
        >
          Connect wallet
        </button>
        {error && (
          <div className="mt-6 max-w-md rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}
      </main>
    );
  }

  return (
    <div className="flex min-h-screen pt-14">
      {/* Left sidebar - refi style */}
      <aside className="w-72 shrink-0 border-r border-white/5 bg-shill-darker/50">
        <div className="sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col p-4">
          <input
            type="text"
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-shill-green/40 focus:outline-none"
          />
          <h2 className="text-xs font-medium uppercase tracking-wider text-white/50">Tokens</h2>
          {loading ? (
            <p className="mt-3 text-sm text-white/50">Loading…</p>
          ) : filteredTokens.length === 0 ? (
            <p className="mt-3 text-sm text-white/50">
              {searchQuery.trim() ? "No matches." : "No tokens. Launch from the Launch page."}
            </p>
          ) : (
            <ul className="mt-3 flex-1 space-y-1 overflow-y-auto">
              {filteredTokens.map((t) => {
                const isSelected = selectedMint === t.token_mint;
                const loop = detail && selectedMint === t.token_mint ? detail.rewardLoop : null;
                const isMintOnly =
                  !t.search_query ||
                  t.search_query === t.token_mint ||
                  (t.search_query.length >= 32 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(t.search_query));
                const primary = isMintOnly
                  ? `${t.token_mint.slice(0, 6)}…${t.token_mint.slice(-4)}`
                  : t.search_query;
                const shortMint = `${t.token_mint.slice(0, 6)}…${t.token_mint.slice(-4)}`;
                return (
                  <li key={t.token_mint}>
                    <button
                      type="button"
                      onClick={() => setSelectedMint(t.token_mint)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                        isSelected ? "bg-shill-green/15 text-white" : "text-white/80 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          loop?.enabled ? "bg-shill-green" : "bg-white/30"
                        }`}
                        title={loop?.enabled ? "Rewards running" : "Stopped"}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {primary}
                        </p>
                        {!isMintOnly && (
                          <p className="truncate font-mono text-xs text-white/50">{shortMint}</p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <a
            href="/launch"
            className="mt-4 flex w-full items-center justify-center rounded-xl bg-shill-green py-3 font-semibold text-shill-dark transition hover:bg-shill-green/90"
          >
            Launch token
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-auto px-6 py-8">
        {/* Top bar: wallet + SOL */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="rounded-lg bg-white/5 px-3 py-1.5 font-mono text-sm text-white/80">
              {wallet?.slice(0, 4)}…{wallet?.slice(-4)}
            </span>
            {solBalance != null && (
              <span className="text-sm text-shill-green">{solBalance.toFixed(4)} SOL</span>
            )}
            <button
              type="button"
              onClick={() => disconnect()}
              className="text-sm text-white/50 underline hover:text-white/70"
            >
              Disconnect
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!selectedMint ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-white/60">Select a token from the sidebar to view details and manage rewards.</p>
          </div>
        ) : detail ? (
          <div className="space-y-6">
            {/* Token header */}
            <section className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-white">
                    {selectedToken?.search_query || selectedMint.slice(0, 12) + "…"}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-white/50">{selectedMint}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`https://jup.ag/swap/SOL-${selectedMint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
                  >
                    Jupiter
                  </a>
                  <button
                    type="button"
                    onClick={() => setRewardModalOpen(true)}
                    className="rounded-lg bg-shill-green/20 px-3 py-1.5 text-sm font-medium text-shill-green hover:bg-shill-green/30"
                  >
                    Edit rewards
                  </button>
                </div>
              </div>
            </section>

            {/* Reward cycle */}
            <section className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-xs font-medium uppercase tracking-wider text-white/50">Reward cycle</h3>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg bg-shill-darker/50 p-3">
                  <p className="text-xs text-white/50">Status</p>
                  <p className={detail.rewardLoop?.enabled ? "text-shill-green" : "text-white/60"}>
                    {detail.rewardLoop?.enabled ? "Running" : "Stopped"}
                  </p>
                </div>
                <div className="rounded-lg bg-shill-darker/50 p-3">
                  <p className="text-xs text-white/50">Interval</p>
                  <p className="text-white/80">
                    {detail.rewardLoop ? formatInterval(detail.rewardLoop.interval_sec) : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-shill-darker/50 p-3">
                  <p className="text-xs text-white/50">Dev wallet</p>
                  <p className="text-white/80">{solBalance != null ? `${solBalance.toFixed(4)} SOL` : "—"}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {detail.rewardLoop?.enabled ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={rewardsStop}
                    className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                  >
                    {busy === "stop" ? "Stopping…" : "Stop"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={rewardsStart}
                    className="rounded-lg bg-shill-green px-4 py-2 text-sm font-medium text-shill-dark hover:bg-shill-green/90 disabled:opacity-50"
                  >
                    {busy === "start" ? "Starting…" : "Start"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={rewardsRunNow}
                  className="rounded-lg border border-shill-green/50 px-4 py-2 text-sm text-shill-green hover:bg-shill-green/10 disabled:opacity-50"
                >
                  {busy === "run" ? "Running…" : "Run now"}
                </button>
              </div>
            </section>

            {/* Creator fees */}
            <section className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-xs font-medium uppercase tracking-wider text-white/50">Creator fees</h3>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                {detail.claimable ? (
                  <>
                    <span className="text-white/80">
                      Estimated claimable:{" "}
                      {(detail.claimable.creatorTradingClaimable ?? 0) + (detail.claimable.creatorLpClaimable ?? 0) > 0
                        ? `${((detail.claimable.creatorTradingClaimable ?? 0) + (detail.claimable.creatorLpClaimable ?? 0)).toFixed(4)} SOL`
                        : "0 SOL"}
                    </span>
                    {(detail.claimable.creatorTradingClaimable ?? 0) > 0 && (
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={claimCreatorTrading}
                        className="rounded-lg bg-shill-yellow px-4 py-2 text-sm font-semibold text-shill-dark hover:bg-shill-yellow/90 disabled:opacity-50"
                      >
                        {busy === "claim" ? "Claiming…" : "Claim now"}
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-white/50">Unable to load claimable (RPC). Claim may still work.</span>
                )}
              </div>
            </section>

            {/* Dev position + dev sell */}
            <section className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-xs font-medium uppercase tracking-wider text-white/50">Dev position</h3>
              <p className="mt-2 text-sm text-white/70">
                Sell a share of your token balance for SOL. You sign the transaction in your wallet.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={!!busy}
                    onClick={() => devSell(p)}
                    className="rounded-lg border border-shill-green/40 bg-shill-green/10 px-4 py-2 text-sm font-medium text-shill-green hover:bg-shill-green/20 disabled:opacity-50"
                  >
                    {busy === `sell-${p}` ? "…" : `Sell ${p}%`}
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
            Loading token details…
          </div>
        )}
      </main>

      {/* Reward settings modal */}
      {rewardModalOpen && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-shill-dark p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-white">Share earnings</h3>
            <p className="mt-1 text-sm text-white/60">% to creator, buys, burns, LP, and airdrops to holders. Sum must be 100.</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs text-white/50">% to creator</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={splitForm.creatorPct}
                  onChange={(e) => setSplitForm((s) => ({ ...s, creatorPct: Number(e.target.value) || 0 }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs text-white/50">% to buys</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={splitForm.buysPct}
                  onChange={(e) => setSplitForm((s) => ({ ...s, buysPct: Number(e.target.value) || 0 }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs text-white/50">% to burns</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={splitForm.burnPct}
                  onChange={(e) => setSplitForm((s) => ({ ...s, burnPct: Number(e.target.value) || 0 }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs text-white/50">% to LP</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={splitForm.lpPct}
                  onChange={(e) => setSplitForm((s) => ({ ...s, lpPct: Number(e.target.value) || 0 }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs text-white/50">% airdrops to holders</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={splitForm.holdersPct}
                  onChange={(e) => setSplitForm((s) => ({ ...s, holdersPct: Number(e.target.value) || 0 }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="text-xs text-white/50">Creator wallet (SOL recipient)</span>
              <input
                type="text"
                value={splitForm.creatorWallet ?? ""}
                onChange={(e) => setSplitForm((s) => ({ ...s, creatorWallet: e.target.value.trim() || null }))}
                placeholder={wallet ?? ""}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder-white/40"
              />
            </label>
            <label className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                checked={splitForm.burnOnBuyback ?? true}
                onChange={(e) => setSplitForm((s) => ({ ...s, burnOnBuyback: e.target.checked }))}
                className="rounded border-white/20"
              />
              <span className="text-sm text-white/80">Burn on buyback</span>
            </label>
            <p className="mt-2 text-xs text-white/50">
              Sum: {splitForm.holdersPct + splitForm.creatorPct + splitForm.buysPct + splitForm.burnPct + splitForm.lpPct}%
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={!!busy}
                onClick={saveRewardSettings}
                className="flex-1 rounded-xl bg-shill-green py-2.5 font-medium text-shill-dark hover:bg-shill-green/90 disabled:opacity-50"
              >
                {busy === "settings" ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setRewardModalOpen(false)}
                className="rounded-xl border border-white/20 px-4 py-2.5 font-medium hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

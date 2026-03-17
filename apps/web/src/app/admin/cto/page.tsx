"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";

type CtoClaim = {
  id: string;
  mint: string;
  new_authority: string;
  proposal_uri: string | null;
  tx_signature: string | null;
  claimed_at: string;
  status: string;
  fee_lamports: number | null;
  fee_tx_sig: string | null;
};

type CtoConfig = {
  ctoTreasuryWallet: string | null;
  ctoFeeLamports: number | null;
};

function short(str: string, len = 8): string {
  if (str.length <= len) return str;
  return `${str.slice(0, len)}…`;
}

export default function AdminCtoPage() {
  const { publicKey, connected, connect, disconnect, wallets, select } = useWallet();
  const [claims, setClaims] = useState<CtoClaim[]>([]);
  const [config, setConfig] = useState<CtoConfig | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feeForm, setFeeForm] = useState<{ id: string; fee_lamports: string; fee_tx_sig: string } | null>(null);

  const wallet = publicKey?.toBase58() ?? null;
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cto-config");
      if (res.ok) {
        const data = await res.json();
        setConfig({ ctoTreasuryWallet: data.ctoTreasuryWallet ?? null, ctoFeeLamports: data.ctoFeeLamports ?? null });
      }
    } catch {
      setConfig(null);
    }
  }, []);

  const loadClaims = useCallback(async () => {
    if (!wallet) {
      setClaims([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter
        ? `/api/admin/cto-claims?adminWallet=${encodeURIComponent(wallet)}&status=${encodeURIComponent(statusFilter)}`
        : `/api/admin/cto-claims?adminWallet=${encodeURIComponent(wallet)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.status === 403) {
        setIsAdmin(false);
        setClaims([]);
        setError("This wallet is not authorized for admin access.");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to load claims");
      setIsAdmin(true);
      setClaims(data.claims ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, [wallet, statusFilter]);

  useEffect(() => {
    if (!connected || !wallet) {
      setIsAdmin(null);
      setClaims([]);
      setError(null);
      return;
    }
    loadClaims();
  }, [connected, wallet]);

  useEffect(() => {
    if (isAdmin && wallet) loadClaims();
  }, [isAdmin, statusFilter, loadClaims, wallet]);

  useEffect(() => {
    if (isAdmin) loadConfig();
  }, [isAdmin, loadConfig]);

  const setApproved = useCallback(
    async (id: string) => {
      if (!wallet) return;
      setBusy(id);
      setError(null);
      try {
        const res = await fetch(`/api/admin/cto-claims/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminWallet: wallet, status: "approved" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Update failed");
        await loadClaims();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
      } finally {
        setBusy(null);
      }
    },
    [wallet, loadClaims]
  );

  const setFeePaid = useCallback(
    async (id: string, fee_lamports: number, fee_tx_sig: string) => {
      if (!wallet) return;
      setBusy(id);
      setError(null);
      try {
        const res = await fetch(`/api/admin/cto-claims/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adminWallet: wallet,
            status: "fee_paid",
            fee_lamports,
            fee_tx_sig: fee_tx_sig.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Update failed");
        setFeeForm(null);
        await loadClaims();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
      } finally {
        setBusy(null);
      }
    },
    [wallet, loadClaims]
  );

  const handleConnect = useCallback(async () => {
    if (!wallets.length) {
      setError("No wallet detected.");
      return;
    }
    try {
      select(wallets[0].adapter.name);
      await connect();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connect failed");
    }
  }, [wallets, select, connect]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <h1 className="font-display text-3xl font-bold text-white">CTO admin</h1>

      {!connected ? (
        <>
          <p className="mt-2 text-white/60">Connect your wallet to continue.</p>
          <div className="mt-8">
            <button
              type="button"
              onClick={handleConnect}
              className="rounded-xl bg-shill-yellow px-6 py-3 font-medium text-shill-dark hover:bg-shill-yellow/90"
            >
              Connect wallet
            </button>
          </div>
        </>
      ) : isAdmin === null && loading ? (
        <p className="mt-6 text-white/50">Verifying…</p>
      ) : isAdmin === false ? (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-red-300">This wallet is not authorized for admin access.</p>
          <p className="mt-2 text-sm text-white/70">Connect with an admin wallet (see SHILLIT_ADMIN_WALLETS in server config).</p>
          <button type="button" onClick={() => disconnect()} className="mt-4 text-sm text-white/80 underline hover:text-white">
            Disconnect
          </button>
        </div>
      ) : isAdmin === true ? (
        <>
          <p className="mt-2 text-white/70">Approve CTO claims and mark fee paid.</p>

          {config?.ctoTreasuryWallet && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">CTO fee wallet</p>
              <p className="mt-1 font-mono text-sm text-white break-all">{config.ctoTreasuryWallet}</p>
              {config.ctoFeeLamports != null && (
                <p className="mt-1 text-sm text-white/70">Fee: {(config.ctoFeeLamports / 1e9).toFixed(4)} SOL</p>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <span className="text-sm text-white/70">Connected: {short(wallet!, 12)}</span>
            <button
              type="button"
              onClick={() => disconnect()}
              className="text-sm text-white/50 underline hover:text-white/80"
            >
              Disconnect
            </button>
            <label className="flex items-center gap-2">
              <span className="text-sm text-white/50">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="fee_paid">Fee paid</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => loadClaims()}
              disabled={loading}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {error && (
            <p className="mt-4 text-red-400">{error}</p>
          )}

          {loading ? (
            <p className="mt-8 text-white/50">Loading claims…</p>
          ) : claims.length === 0 ? (
            <p className="mt-8 text-white/50">No claims found.</p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="p-3 font-medium text-white/80">Mint</th>
                    <th className="p-3 font-medium text-white/80">New authority</th>
                    <th className="p-3 font-medium text-white/80">Status</th>
                    <th className="p-3 font-medium text-white/80">Claimed</th>
                    <th className="p-3 font-medium text-white/80">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((c) => (
                    <tr key={c.id} className="border-b border-white/5">
                      <td className="p-3 font-mono text-white/90">{short(c.mint, 12)}</td>
                      <td className="p-3 font-mono text-white/90">{short(c.new_authority, 12)}</td>
                      <td className="p-3">
                        <span
                          className={
                            c.status === "fee_paid"
                              ? "text-shill-green"
                              : c.status === "approved"
                                ? "text-shill-yellow"
                                : "text-white/70"
                          }
                        >
                          {c.status}
                        </span>
                        {c.fee_lamports != null && (
                          <span className="ml-1 text-white/50">({(c.fee_lamports / 1e9).toFixed(4)} SOL)</span>
                        )}
                      </td>
                      <td className="p-3 text-white/60">{new Date(c.claimed_at).toLocaleString()}</td>
                      <td className="p-3">
                        {feeForm?.id === c.id ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="number"
                              placeholder="Fee lamports"
                              value={feeForm.fee_lamports}
                              onChange={(e) => setFeeForm((f) => (f ? { ...f, fee_lamports: e.target.value } : null))}
                              className="w-32 rounded border border-white/10 bg-white/5 px-2 py-1 text-white"
                            />
                            <input
                              type="text"
                              placeholder="Fee tx signature"
                              value={feeForm.fee_tx_sig}
                              onChange={(e) => setFeeForm((f) => (f ? { ...f, fee_tx_sig: e.target.value } : null))}
                              className="min-w-0 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-white"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={!!busy}
                                onClick={() => setFeePaid(c.id, parseInt(feeForm.fee_lamports, 10) || 0, feeForm.fee_tx_sig)}
                                className="rounded bg-shill-green px-2 py-1 text-sm text-shill-dark hover:bg-shill-green/90 disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setFeeForm(null)}
                                className="rounded border border-white/20 px-2 py-1 text-sm hover:bg-white/10"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            {c.status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  disabled={!!busy}
                                  onClick={() => setApproved(c.id)}
                                  className="rounded border border-shill-yellow/50 bg-shill-yellow/10 px-2 py-1 text-xs text-shill-yellow hover:bg-shill-yellow/20 disabled:opacity-50"
                                >
                                  {busy === c.id ? "…" : "Approve"}
                                </button>
                                <button
                                  type="button"
                                  disabled={!!busy}
                                  onClick={() => setFeeForm({ id: c.id, fee_lamports: "", fee_tx_sig: "" })}
                                  className="rounded border border-shill-green/50 bg-shill-green/10 px-2 py-1 text-xs text-shill-green hover:bg-shill-green/20 disabled:opacity-50"
                                >
                                  Mark fee paid
                                </button>
                              </>
                            )}
                            {c.status === "approved" && (
                              <button
                                type="button"
                                disabled={!!busy}
                                onClick={() => setFeeForm({ id: c.id, fee_lamports: "", fee_tx_sig: "" })}
                                className="rounded border border-shill-green/50 bg-shill-green/10 px-2 py-1 text-xs text-shill-green hover:bg-shill-green/20 disabled:opacity-50"
                              >
                                Mark fee paid
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </main>
  );
}

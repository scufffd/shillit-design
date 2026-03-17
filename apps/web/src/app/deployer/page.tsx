"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";

const DEFAULT_FEE_SOL = 0.1;
const LAMPORTS_PER_SOL = 1e9;

interface DeployerProfile {
  wallet: string;
  created_at: string;
  paid_at: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  rating_score: number;
  rating_updated_at: string;
}

interface CanDeploy {
  allowed: boolean;
  reason: string | null;
  deployCountToday: number;
  cap: number;
}

export default function DeployerPage() {
  const { connection } = useConnection();
  const { publicKey, connected, connect, disconnect, select, signTransaction, wallets } = useWallet();
  const [profile, setProfile] = useState<DeployerProfile | null>(null);
  const [canDeploy, setCanDeploy] = useState<CanDeploy | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [paymentSig, setPaymentSig] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const wallet = publicKey?.toBase58() ?? null;

  const fetchProfile = useCallback(async () => {
    if (!wallet) {
      setProfile(null);
      return;
    }
    try {
      const res = await fetch(`/api/deployer/profile?wallet=${encodeURIComponent(wallet)}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url ?? "");
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    }
  }, [wallet]);

  const fetchCanDeploy = useCallback(async () => {
    if (!wallet) {
      setCanDeploy(null);
      return;
    }
    try {
      const res = await fetch(`/api/deployer/can-deploy?wallet=${encodeURIComponent(wallet)}`);
      if (res.ok) {
        const data = await res.json();
        setCanDeploy(data);
      } else {
        setCanDeploy(null);
      }
    } catch {
      setCanDeploy(null);
    }
  }, [wallet]);

  useEffect(() => {
    fetchProfile();
    fetchCanDeploy();
  }, [fetchProfile, fetchCanDeploy]);

  const handleConnect = useCallback(async () => {
    if (!wallets.length) {
      setError("No wallet detected. Install Phantom or Solflare.");
      return;
    }
    try {
      select(wallets[0].adapter.name);
      await connect();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect wallet.");
    }
  }, [wallets, select, connect]);

  const handlePayAndCreate = useCallback(async () => {
    if (!wallet || !signTransaction) {
      setError("Connect your wallet first.");
      return;
    }
    const treasury = process.env.NEXT_PUBLIC_DEPLOYER_PROFILE_TREASURY_WALLET?.trim();
    if (!treasury) {
      setError("Profile fee is not configured. Contact the team.");
      return;
    }
    const feeSol = parseFloat(process.env.NEXT_PUBLIC_DEPLOYER_PROFILE_FEE_SOL ?? String(DEFAULT_FEE_SOL));
    const lamports = Math.floor(feeSol * LAMPORTS_PER_SOL);
    if (lamports <= 0) {
      setError("Invalid profile fee.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(wallet),
          toPubkey: new PublicKey(treasury),
          lamports,
        })
      );
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(wallet);
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction(sig, "confirmed");
      setPaymentSig(sig);
      const postRes = await fetch("/api/deployer/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          displayName: displayName.trim() || undefined,
          bio: bio.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
          paymentTxSignature: sig,
        }),
      });
      const postData = await postRes.json();
      if (!postRes.ok) {
        setError(postData.error ?? "Failed to create profile.");
        setLoading(false);
        return;
      }
      setSuccess("Profile created and activated.");
      setPaymentSig("");
      fetchProfile();
      fetchCanDeploy();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment or profile creation failed.");
    } finally {
      setLoading(false);
    }
  }, [wallet, connection, signTransaction, displayName, bio, avatarUrl, fetchProfile, fetchCanDeploy]);

  const handleCreateWithoutPayment = useCallback(async () => {
    if (!wallet) {
      setError("Connect your wallet first.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/deployer/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          displayName: displayName.trim() || undefined,
          bio: bio.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create profile.");
        setLoading(false);
        return;
      }
      setSuccess("Profile created.");
      fetchProfile();
      fetchCanDeploy();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }, [wallet, displayName, bio, avatarUrl, fetchProfile, fetchCanDeploy]);

  const handleUpdateProfile = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/deployer/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          displayName: displayName.trim() || undefined,
          bio: bio.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update profile.");
        setLoading(false);
        return;
      }
      setSuccess("Profile updated.");
      fetchProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }, [wallet, displayName, bio, avatarUrl, fetchProfile]);

  const feeSol = parseFloat(process.env.NEXT_PUBLIC_DEPLOYER_PROFILE_FEE_SOL ?? String(DEFAULT_FEE_SOL));
  const treasury = process.env.NEXT_PUBLIC_DEPLOYER_PROFILE_TREASURY_WALLET?.trim();
  const needsPayment = Boolean(treasury && feeSol > 0);

  return (
    <main className="mx-auto max-w-2xl px-6 pt-24 pb-16">
      <h1 className="font-display text-3xl font-bold tracking-tight text-white">
        Deployer profile
      </h1>
      <p className="mt-2 text-white/70">
        Create a profile to launch tokens. You get a limited number of deploys per day; your rating affects your share of creator fees.
      </p>

      {!connected && (
        <div className="mt-8">
          <button
            type="button"
            onClick={handleConnect}
            className="rounded-xl bg-shill-yellow px-6 py-3 font-bold text-shill-dark hover:bg-shill-yellow/90"
          >
            Connect wallet
          </button>
        </div>
      )}

      {connected && wallet && (
        <>
          {canDeploy && (
            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white/80">
                Deploys today: {canDeploy.deployCountToday} / {canDeploy.cap}
                {canDeploy.allowed ? " — You can launch." : ` — ${canDeploy.reason ?? ""}`}
              </p>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-6 rounded-xl border border-shill-green/30 bg-shill-green/10 p-4 text-sm text-shill-green">
              {success}
            </div>
          )}

          <section className="mt-8 space-y-4">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-white/50">Display name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your brand or handle"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-shill-yellow/50 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-white/50">Bio</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Your flavor / what you deploy"
                rows={3}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-shill-yellow/50 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-white/50">Avatar URL</span>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-shill-yellow/50 focus:outline-none"
              />
            </label>
          </section>

          {!profile && (
            <div className="mt-8">
              {needsPayment ? (
                <p className="text-sm text-white/70">
                  Pay {feeSol} SOL to create and activate your profile. You will sign a transfer to the platform treasury.
                </p>
              ) : (
                <p className="text-sm text-white/70">
                  No fee required. Create your profile below.
                </p>
              )}
              <button
                type="button"
                disabled={loading}
                onClick={needsPayment ? handlePayAndCreate : handleCreateWithoutPayment}
                className="mt-4 rounded-xl bg-shill-yellow px-6 py-3 font-bold text-shill-dark hover:bg-shill-yellow/90 disabled:opacity-50"
              >
                {loading ? "Creating…" : needsPayment ? `Pay ${feeSol} SOL & create profile` : "Create profile"}
              </button>
            </div>
          )}

          {profile && (
            <div className="mt-8">
              <p className="text-sm text-white/60">
                {profile.paid_at ? "Profile active." : "Profile not yet paid — pay the fee to activate and deploy."}
                {profile.rating_score != null && ` Rating: ${Math.round(profile.rating_score)}.`}
              </p>
              {profile.paid_at && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleUpdateProfile}
                  className="mt-4 rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-medium text-white hover:bg-white/10 disabled:opacity-50"
                >
                  {loading ? "Saving…" : "Update profile"}
                </button>
              )}
              {!profile.paid_at && needsPayment && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handlePayAndCreate}
                  className="mt-4 rounded-xl bg-shill-yellow px-6 py-3 font-bold text-shill-dark hover:bg-shill-yellow/90 disabled:opacity-50"
                >
                  {loading ? "Paying…" : `Pay ${feeSol} SOL to activate`}
                </button>
              )}
            </div>
          )}

          <p className="mt-10 text-sm text-white/50">
            <a href="/launch" className="underline hover:text-white/70">
              Back to launch
            </a>
          </p>
        </>
      )}
    </main>
  );
}

"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { useCallback, useRef, useState } from "react";
import {
  buildCreatePoolTx,
  buildCreatePoolWithFirstBuyTx,
} from "@/lib/meteora-dbc";

export default function LaunchPage() {
  const { connection } = useConnection();
  const { publicKey, connected, connect, disconnect, select, signTransaction, wallets } = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [ownershipAmount, setOwnershipAmount] = useState("");
  const [distributionSplit, setDistributionSplit] = useState({
    holdersPct: 50,
    creatorPct: 20,
    buysPct: 10,
    burnPct: 10,
    lpPct: 10,
    creatorWallet: null as string | null,
    burnOnBuyback: true,
  });
  const [createCampaign, setCreateCampaign] = useState(true);
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignRewardSol, setCampaignRewardSol] = useState("0.1");
  const [campaignDays, setCampaignDays] = useState(30);
  const [socialOpen, setSocialOpen] = useState(false);
  const [vampOpen, setVampOpen] = useState(false);
  const [vampMint, setVampMint] = useState("");
  const [vampLoading, setVampLoading] = useState(false);
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMint, setSuccessMint] = useState<string | null>(null);

  const ownershipPresets = [
    { pct: "1%", sol: 0.01 },
    { pct: "10%", sol: 0.1 },
    { pct: "30%", sol: 0.3 },
    { pct: "50%", sol: 0.5 },
    { pct: "80%", sol: 0.8 },
  ];

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  }, []);

  const onVampLoad = useCallback(async () => {
    const mint = vampMint.trim();
    if (!mint) {
      setError("Enter a token contract address (mint) to vamp.");
      return;
    }
    setVampLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/launch/vamp?mint=${encodeURIComponent(mint)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load token metadata.");
        return;
      }
      if (data.name) setName(data.name);
      if (data.symbol) setTicker(data.symbol);
      if (data.description) setDescription(data.description || "");
      // Image still needs to be uploaded; optionally show vamp image as preview if we had a file
    } catch {
      setError("Failed to load token.");
    } finally {
      setVampLoading(false);
    }
  }, [vampMint]);

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

  const handleLaunch = useCallback(async () => {
    if (!publicKey || !connected) {
      setError("Connect your wallet first.");
      return;
    }
    if (!imageFile || !name.trim() || !ticker.trim()) {
      setError("Upload an image and enter name and ticker.");
      return;
    }

    setLaunching(true);
    setError(null);
    setSuccessMint(null);

    const canDeployRes = await fetch(`/api/deployer/can-deploy?wallet=${encodeURIComponent(publicKey.toBase58())}`);
    const canDeploy = await canDeployRes.json().catch(() => ({ allowed: false }));
    if (!canDeploy.allowed) {
      setError(canDeploy.reason ?? "You cannot deploy right now. Create a deployer profile at /deployer.");
      setLaunching(false);
      return;
    }

    const poolConfigKey = process.env.NEXT_PUBLIC_POOL_CONFIG_KEY;
    if (!poolConfigKey?.trim()) {
      setError("NEXT_PUBLIC_POOL_CONFIG_KEY is not set. Add your Meteora DBC config key to .env.");
      setLaunching(false);
      return;
    }

    try {
      const mintKeypair = Keypair.generate();
      const mint = mintKeypair.publicKey.toBase58();

      const formData = new FormData();
      formData.set("file", imageFile);
      formData.set("name", name.trim());
      formData.set("symbol", ticker.trim().slice(0, 10));
      formData.set("description", description.trim());
      formData.set("wallet", publicKey.toBase58());
      formData.set("mint", mint);
      formData.set("website", website.trim());

      const metaRes = await fetch("/api/launch/metadata-uri", {
        method: "POST",
        body: formData,
      });
      const metaData = await metaRes.json();
      if (!metaRes.ok) {
        const msg = metaData.error || "Image check failed.";
        const code = metaData.code as string | undefined;
        if (metaRes.status === 403 && (code === "NO_PROFILE" || code === "PROFILE_UNPAID" || code === "DEPLOY_CAP")) {
          setError(`${msg} Go to Deployer profile to create one or try again tomorrow.`);
        } else {
          setError(msg);
        }
        setLaunching(false);
        return;
      }
      const { uri, hash } = metaData;
      const config = new PublicKey(poolConfigKey);
      const createPoolParam = {
        baseMint: mintKeypair.publicKey,
        config,
        name: name.trim(),
        symbol: ticker.trim().slice(0, 10),
        uri,
        payer: publicKey,
        poolCreator: publicKey,
      };

      const ownershipSol = ownershipAmount ? parseFloat(ownershipAmount) : 0;
      let tx;
      if (ownershipSol > 0) {
        tx = await buildCreatePoolWithFirstBuyTx(connection, {
          createPoolParam,
          firstBuyParam: {
            buyer: publicKey,
            buyAmountSol: ownershipSol,
            minimumAmountOut: new BN(1),
          },
        });
      } else {
        tx = await buildCreatePoolTx(connection, createPoolParam);
      }

      // Use a fresh blockhash so the tx doesn't expire before send (e.g. after user signs)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      tx.partialSign(mintKeypair);
      let signed = tx;
      if (signTransaction) {
        try {
          signed = await signTransaction(tx);
        } catch (e: unknown) {
          const msg = e && typeof e === "object" && "name" in e && (e as { name: string }).name === "WalletNotSelectedError"
            ? "Please connect your wallet again and try launching."
            : (e instanceof Error ? e.message : "Wallet rejected or failed.");
          setError(msg);
          setLaunching(false);
          return;
        }
      }
      const raw = signed.serialize();
      const sig = await connection.sendRawTransaction(raw, {
        skipPreflight: false,
        maxRetries: 3,
      });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });

      const creatorWallet = publicKey.toBase58();

      await fetch("/api/image/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hash,
          mint,
          creator_wallet: creatorWallet,
          name: name.trim() || undefined,
          symbol: ticker.trim() || undefined,
        }),
      });

      const splitToSave = {
        ...distributionSplit,
        creatorWallet: distributionSplit.creatorWallet || creatorWallet,
      };
      const sum =
        splitToSave.holdersPct +
        splitToSave.creatorPct +
        splitToSave.buysPct +
        splitToSave.burnPct +
        splitToSave.lpPct;
      if (sum === 100) {
        await fetch(`/api/dashboard/tokens/${encodeURIComponent(mint)}/reward-settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: creatorWallet, distributionSplit: splitToSave }),
        });
      }

      if (createCampaign) {
        const title = campaignTitle.trim() || `Shill ${ticker.trim() || "token"}`;
        const rewardLamports = Math.max(0, Math.round((parseFloat(campaignRewardSol) || 0) * 1e9));
        const now = new Date();
        const endsAt = new Date(now.getTime() + (campaignDays || 30) * 24 * 60 * 60 * 1000);
        await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tokenMint: mint,
            creatorWallet,
            title,
            description: description.trim() || null,
            rewardMint: "SOL",
            rewardAmountRaw: String(rewardLamports),
            startsAt: now.toISOString(),
            endsAt: endsAt.toISOString(),
          }),
        });
      }

      setSuccessMint(mint);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Launch failed.";
      if (msg.includes("Pool config not found for virtual pool")) {
        setError(
          "Pool config not found. Your POOL_CONFIG_KEY must exist on the same network as your RPC (e.g. devnet). " +
            "Create the config on devnet: set RPC_URL to a devnet URL in .env at repo root, then run: node scripts/create-dbc-config.mjs. " +
            "See config/README.md."
        );
      } else {
        setError(msg);
      }
    } finally {
      setLaunching(false);
    }
  }, [
    publicKey,
    connected,
    connection,
    imageFile,
    name,
    ticker,
    description,
    ownershipAmount,
    signTransaction,
    distributionSplit,
    createCampaign,
    campaignTitle,
    campaignRewardSol,
    campaignDays,
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 pt-24 pb-16">
      <h1 className="font-display text-3xl font-bold tracking-tight text-white">
        Create new token
      </h1>
      <p className="mt-2 text-white/70">
        Configure your token details and dev wallet, then launch on Meteora DBC.
      </p>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
          {(error?.includes("profile") || error?.includes("deploy") || error?.includes("limit")) && (
            <p className="mt-2">
              <a href="/deployer" className="font-medium underline hover:no-underline">
                Create or manage deployer profile
              </a>
            </p>
          )}
        </div>
      )}
      {successMint && (
        <div className="mt-6 rounded-xl border border-shill-green/30 bg-shill-green/10 p-4 text-sm text-shill-green">
          Token launched on Meteora DBC. Mint:{" "}
          <a
            href={`https://jup.ag/swap/SOL-${successMint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {successMint.slice(0, 8)}…
          </a>{" "}
          (trade on Jupiter).{" "}
          <a href={`/t/${successMint}`} className="font-medium underline hover:no-underline">
            View token page
          </a>
          {" · "}
          <a href="/dashboard" className="font-medium underline hover:no-underline">
            Dashboard
          </a>{" "}
          to manage rewards and dev sell.
          {createCampaign && (
            <>
              {" "}
              Your bagwork campaign was created as a draft.{" "}
              <a href="/campaigns" className="font-medium underline hover:no-underline">
                Fund it in Bagworkers
              </a>{" "}
              to go live.
            </>
          )}
        </div>
      )}

      {/* VAMP EXISTING TOKEN */}
      <section className="mt-10">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={vampOpen}
            onChange={(e) => setVampOpen(e.target.checked)}
            className="rounded border-white/20"
          />
          <span className="text-sm font-medium text-white/80">Vamp an existing token</span>
        </label>
        <p className="mt-1 text-xs text-white/50">
          Paste a token mint (CA) to clone its name, symbol and description, then customise.
        </p>
        {vampOpen && (
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Contract address (mint)"
              value={vampMint}
              onChange={(e) => setVampMint(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder-white/40 focus:border-shill-green/50 focus:outline-none"
            />
            <button
              type="button"
              disabled={vampLoading}
              onClick={onVampLoad}
              className="rounded-xl border border-shill-green/40 bg-shill-green/10 px-4 py-3 text-sm font-medium text-shill-green hover:bg-shill-green/20 disabled:opacity-50"
            >
              {vampLoading ? "Loading…" : "Load token"}
            </button>
          </div>
        )}
      </section>

      {/* PROJECT INFO */}
      <section className="mt-10">
        <p className="text-xs font-medium uppercase tracking-wider text-white/50">
          Token details
        </p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:gap-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-40 w-40 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-white/5 transition hover:border-shill-green/40"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="h-full w-full rounded-lg object-cover" />
            ) : (
              <>
                <svg className="h-10 w-10 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="mt-2 text-xs font-medium uppercase tracking-wider text-white/50">
                  Upload image
                </span>
              </>
            )}
          </button>
          <div className="min-w-0 flex-1 space-y-4">
            <input
              type="text"
              placeholder="Symbol *"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.slice(0, 10))}
              maxLength={10}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-shill-green/50 focus:outline-none focus:ring-1 focus:ring-shill-green/30"
            />
            <input
              type="text"
              placeholder="Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-shill-green/50 focus:outline-none focus:ring-1 focus:ring-shill-green/30"
            />
            <textarea
              placeholder="Description *"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-shill-green/50 focus:outline-none focus:ring-1 focus:ring-shill-green/30"
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setSocialOpen(!socialOpen)}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/80 transition hover:bg-white/10"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-white/50">
              Social links (optional)
            </span>
            <svg
              className={`h-5 w-5 text-white/50 transition ${socialOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {socialOpen && (
            <div className="mt-2 space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <label className="block">
                <span className="text-xs text-white/50">Twitter / X (optional)</span>
                <input
                  type="url"
                  placeholder="https://x.com/..."
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40"
                />
              </label>
              <label className="block">
                <span className="text-xs text-white/50">Telegram (optional)</span>
                <input
                  type="url"
                  placeholder="https://t.me/..."
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40"
                />
              </label>
              <label className="block">
                <span className="text-xs text-white/50">Website (optional)</span>
                <input
                  type="url"
                  placeholder="https://..."
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40"
                />
              </label>
              <label className="block">
                <span className="text-xs text-white/50">Referral code (optional)</span>
                <input
                  type="text"
                  placeholder="Rewards the referrer who brought you here"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40"
                />
              </label>
            </div>
          )}
        </div>
      </section>

      {/* SHARE EARNINGS — distribution split (used when you enable rewards in dashboard) */}
      <section className="mt-10">
        <p className="text-xs font-medium uppercase tracking-wider text-white/50">
          Share earnings
        </p>
        <p className="mt-1 text-sm text-white/60">
          How to split trading-fee rewards: creator, buybacks, burns, LP, airdrops to holders. Must sum to 100%. You can change this later in Dashboard.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs text-white/50">% to creator</span>
            <input
              type="number"
              min={0}
              max={100}
              value={distributionSplit.creatorPct}
              onChange={(e) =>
                setDistributionSplit((s) => ({ ...s, creatorPct: Number(e.target.value) || 0 }))
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">% to buys</span>
            <input
              type="number"
              min={0}
              max={100}
              value={distributionSplit.buysPct}
              onChange={(e) =>
                setDistributionSplit((s) => ({ ...s, buysPct: Number(e.target.value) || 0 }))
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">% to burns</span>
            <input
              type="number"
              min={0}
              max={100}
              value={distributionSplit.burnPct}
              onChange={(e) =>
                setDistributionSplit((s) => ({ ...s, burnPct: Number(e.target.value) || 0 }))
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">% to LP</span>
            <input
              type="number"
              min={0}
              max={100}
              value={distributionSplit.lpPct}
              onChange={(e) =>
                setDistributionSplit((s) => ({ ...s, lpPct: Number(e.target.value) || 0 }))
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">% airdrops to holders</span>
            <input
              type="number"
              min={0}
              max={100}
              value={distributionSplit.holdersPct}
              onChange={(e) =>
                setDistributionSplit((s) => ({ ...s, holdersPct: Number(e.target.value) || 0 }))
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-white/50">
          Sum:{" "}
          {distributionSplit.holdersPct +
            distributionSplit.creatorPct +
            distributionSplit.buysPct +
            distributionSplit.burnPct +
            distributionSplit.lpPct}
          %
        </p>
        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={distributionSplit.burnOnBuyback ?? true}
            onChange={(e) =>
              setDistributionSplit((s) => ({ ...s, burnOnBuyback: e.target.checked }))
            }
            className="rounded border-white/20"
          />
          <span className="text-sm text-white/80">Burn on buyback</span>
        </label>
      </section>

      {/* CREATE BAGWORK CAMPAIGN — auto-create draft campaign for this token */}
      <section className="mt-10">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={createCampaign}
            onChange={(e) => setCreateCampaign(e.target.checked)}
            className="rounded border-white/20"
          />
          <span className="text-sm font-medium text-white/80">Create bagwork campaign for this token</span>
        </label>
        <p className="mt-1 text-xs text-white/50">
          A draft campaign will be created so you can fund it and reward bagworkers who shill your token.
        </p>
        {createCampaign && (
          <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <label className="block">
              <span className="text-xs text-white/50">Campaign title</span>
              <input
                type="text"
                placeholder={`Shill ${ticker || "token"}`}
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-white/50">Reward pool (SOL)</span>
                <input
                  type="text"
                  placeholder="0.1"
                  value={campaignRewardSol}
                  onChange={(e) => setCampaignRewardSol(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40"
                />
              </label>
              <label className="block">
                <span className="text-xs text-white/50">Duration (days)</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={campaignDays}
                  onChange={(e) => setCampaignDays(Math.max(1, Math.min(365, Number(e.target.value) || 30)))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                />
              </label>
            </div>
          </div>
        )}
      </section>

      {/* ADMIN — placeholder for fee config later */}
      <section className="mt-10">
        <p className="text-xs font-medium uppercase tracking-wider text-white/50">
          Admin
        </p>
        <p className="mt-2 text-sm text-white/60">
          You are the creator. Fees are set by the DBC config key (partner + creator %).
        </p>
      </section>

      {/* DEV BUY */}
      <section className="mt-10">
        <p className="text-xs font-medium uppercase tracking-wider text-white/50">
          Dev buy (SOL) — optional
        </p>
        <p className="mt-2 text-sm text-white/60">
          You can also buy or sell later from the token detail view on the Dashboard.
        </p>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-shill-green/20 text-shill-green">◎</span>
          <input
            type="text"
            placeholder="0.00"
            value={ownershipAmount}
            onChange={(e) => setOwnershipAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-white placeholder-white/40 focus:outline-none"
          />
          <span className="text-sm text-white/50">SOL</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ownershipPresets.map(({ pct, sol }) => (
            <button
              key={pct}
              type="button"
              onClick={() => setOwnershipAmount(String(sol))}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:border-shill-green/40 hover:bg-shill-green/10 hover:text-shill-green"
            >
              <span className="font-medium">{pct}</span>
              <span className="ml-1.5 text-white/60">{sol} SOL</span>
            </button>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="mt-12">
        {!connected ? (
          <button
            type="button"
            onClick={handleConnect}
            className="w-full rounded-xl bg-shill-yellow py-4 font-semibold uppercase tracking-wider text-shill-dark transition hover:bg-shill-yellow/90 focus:outline-none focus:ring-2 focus:ring-shill-yellow/50 focus:ring-offset-2 focus:ring-offset-shill-dark"
          >
            Connect wallet to launch
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLaunch}
            disabled={launching}
            className="w-full rounded-xl bg-shill-yellow py-4 font-semibold uppercase tracking-wider text-shill-dark transition hover:bg-shill-yellow/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-shill-yellow/50 focus:ring-offset-2 focus:ring-offset-shill-dark"
          >
            {launching ? "Launching…" : "Launch token"}
          </button>
        )}
        {connected && (
          <p className="mt-3 text-center text-sm text-white/50">
            {publicKey?.toBase58().slice(0, 4)}…{publicKey?.toBase58().slice(-4)}{" "}
            <button type="button" onClick={() => disconnect()} className="text-white/70 underline hover:text-white">
              Disconnect
            </button>
          </p>
        )}
      </div>
    </main>
  );
}

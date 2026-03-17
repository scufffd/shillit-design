/**
 * POST /api/image/register
 * Body: JSON { hash: string, mint: string, creator_wallet?: string, name?: string, symbol?: string }
 * After a token is minted, register the image hash in used_images,
 * add the token to tracked_tokens (with optional name/symbol for dashboard display), and optionally set creator.
 */

import { getDb } from "@/lib/db";
import { loadLaunchpadKeypair } from "@/lib/launchpad-keypair";
import { ensureDistributorMintInitialized } from "@/lib/fee-distributor/distributor-onchain";
import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";

function getConnection(): Connection {
  const rpc = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
  if (!rpc) throw new Error("RPC_URL or NEXT_PUBLIC_RPC_URL required");
  return new Connection(rpc, "confirmed");
}

export async function POST(req: NextRequest) {
  let body: { hash: string; mint: string; creator_wallet?: string; name?: string; symbol?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { hash, mint, creator_wallet, name, symbol } = body;
  if (!hash || !mint || typeof hash !== "string" || typeof mint !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid hash or mint" },
      { status: 400 }
    );
  }

  const displayLabel =
    [symbol, name].filter((s) => s != null && typeof s === "string" && s.trim()).join(" ").trim() || mint;

  try {
    const db = getDb();
    const { error } = await db.insertUsedImage({ hash_sha256: hash, mint });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Image already registered" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    await db.upsertTrackedToken({ token_mint: mint, search_query: displayLabel });
    if (creator_wallet && typeof creator_wallet === "string" && creator_wallet.trim()) {
      const cw = creator_wallet.trim();
      const profile = await db.getDeployerProfile(cw);
      const ratingAtLaunch = profile != null ? Math.round(profile.rating_score) : null;
      await db.upsertTokenCreator({ token_mint: mint, creator_wallet: cw, deployer_rating_at_launch: ratingAtLaunch });

      // Ensure rewards cron will pick this token up (split can be set immediately after launch via reward-settings).
      await db.upsertRewardLoop({
        token_mint: mint,
        enabled: true,
        next_run_at: new Date().toISOString(),
      });
    }

    let distributor: { attempted: boolean; initialized?: boolean; alreadyInitialized?: boolean; txSig?: string; error?: string } = {
      attempted: false,
    };
    const autoInit =
      process.env.AUTO_INIT_DISTRIBUTOR_ON_REGISTER === "1" || process.env.AUTO_INIT_DISTRIBUTOR_ON_REGISTER === "true";
    if (autoInit && process.env.DISTRIBUTOR_PROGRAM_ID) {
      distributor.attempted = true;
      try {
        const connection = getConnection();
        const keypair = loadLaunchpadKeypair();
        const res = await ensureDistributorMintInitialized({ connection, authorityKeypair: keypair, mint });
        distributor.initialized = res.success;
        distributor.alreadyInitialized = res.alreadyInitialized;
        distributor.txSig = res.initTxSig;
        distributor.error = res.error;
      } catch (e) {
        distributor.initialized = false;
        distributor.error = e instanceof Error ? e.message : "init_mint failed";
      }
    }

    return NextResponse.json({ ok: true, hash, mint, tracked: true, distributor });
  } catch (dbError) {
    // DB unavailable (e.g. better-sqlite3 wrong Node version) – token was still launched
    console.warn("[image/register] DB unavailable:", dbError);
    return NextResponse.json({ ok: true, hash, mint, tracked: false });
  }
}

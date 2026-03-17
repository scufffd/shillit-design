/**
 * POST /api/rewards/[mint]/run
 * Run one rewards cycle for this token. Either:
 * - Body: { wallet: string } and wallet must be the token creator, or
 * - Header: Authorization: Bearer REWARDS_CRON_TOKEN
 * Uses stored distribution_split from reward_loops if present.
 */

import { getDb } from "@/lib/db";
import { runCycle } from "@/lib/rewards-runner";
import { NextRequest, NextResponse } from "next/server";

const defaultSplit = {
  holdersPct: 50,
  creatorPct: 25,
  buysPct: 0,
  burnPct: 25,
  lpPct: 0,
  creatorWallet: null as string | null,
  burnOnBuyback: true,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });
  const cronToken = process.env.REWARDS_CRON_TOKEN?.trim();
  const auth = req.headers.get("authorization");
  const isCron = Boolean(cronToken && auth === `Bearer ${cronToken}`);
  let body: { wallet?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const wallet = body.wallet?.trim();
  if (!isCron && !wallet) {
    return NextResponse.json({ error: "wallet required (or cron token)" }, { status: 400 });
  }
  try {
    if (!isCron) {
      const db = getDb();
      const creator = await db.getCreatorByToken(mint);
      if (creator !== wallet) {
        return NextResponse.json({ error: "Only the token creator can run rewards" }, { status: 403 });
      }
    }
    const db = getDb();
    const loop = await db.getRewardLoop(mint);
    const creatorWithRating = await db.getTokenCreatorWithRating(mint);
    const distributionSplit = loop?.distribution_split
      ? {
          holdersPct: loop.distribution_split.holdersPct ?? defaultSplit.holdersPct,
          creatorPct: loop.distribution_split.creatorPct ?? defaultSplit.creatorPct,
          buysPct: loop.distribution_split.buysPct ?? defaultSplit.buysPct,
          burnPct: loop.distribution_split.burnPct ?? defaultSplit.burnPct,
          lpPct: loop.distribution_split.lpPct ?? defaultSplit.lpPct,
          creatorWallet: loop.distribution_split.creatorWallet ?? creatorWithRating?.creator_wallet ?? null,
          burnOnBuyback: loop.distribution_split.burnOnBuyback ?? defaultSplit.burnOnBuyback,
        }
      : {
          ...defaultSplit,
          creatorWallet: creatorWithRating?.creator_wallet ?? defaultSplit.creatorWallet,
        };
    const result = await runCycle({
      mint,
      distributionSplit,
      deployerRatingAtLaunch: creatorWithRating?.deployer_rating_at_launch ?? null,
      minHolderBalance: BigInt(1),
      excludeWallet: null,
    });
    if (result.success && loop?.enabled && loop.interval_sec) {
      const nextRunAt = new Date(Date.now() + loop.interval_sec * 1000).toISOString();
      await db.upsertRewardLoop({ token_mint: mint, next_run_at: nextRunAt });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[rewards/[mint]/run]", e);
    const msg = e instanceof Error ? e.message : "";
    const isConfigError =
      /keypair file not found|LAUNCHPAD_PRIVATE_KEY|DBC_PAYER_KEYPAIR_PATH required/i.test(msg);
    const safeMessage = isConfigError
      ? "Server configuration error. Contact the operator."
      : "Run failed";
    return NextResponse.json(
      { success: false, mint, error: safeMessage },
      { status: 500 }
    );
  }
}

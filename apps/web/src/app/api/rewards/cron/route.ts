/**
 * POST /api/rewards/cron
 * Header: Authorization: Bearer REWARDS_CRON_TOKEN
 * Runs all enabled reward loops that are due (next_run_at <= now).
 * Call from a cron job every 1–5 minutes.
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

export async function POST(req: NextRequest) {
  const token = process.env.REWARDS_CRON_TOKEN?.trim();
  if (token) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${token}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const now = new Date();
  try {
    const db = getDb();
    const loops = await db.getEnabledRewardLoops();
    const results: { mint: string; success: boolean; error?: string }[] = [];
    for (const loop of loops) {
      const due = !loop.next_run_at || new Date(loop.next_run_at) <= now;
      if (!due) continue;
      const distributionSplit = loop.distribution_split
        ? {
            holdersPct: loop.distribution_split.holdersPct ?? defaultSplit.holdersPct,
            creatorPct: loop.distribution_split.creatorPct ?? defaultSplit.creatorPct,
            buysPct: loop.distribution_split.buysPct ?? defaultSplit.buysPct,
            burnPct: loop.distribution_split.burnPct ?? defaultSplit.burnPct,
            lpPct: loop.distribution_split.lpPct ?? defaultSplit.lpPct,
            creatorWallet: loop.distribution_split.creatorWallet ?? null,
            burnOnBuyback: loop.distribution_split.burnOnBuyback ?? defaultSplit.burnOnBuyback,
          }
        : defaultSplit;
      try {
        await runCycle({
          mint: loop.token_mint,
          distributionSplit,
          minHolderBalance: BigInt(1),
          excludeWallet: null,
        });
        const nextRunAt = new Date(now.getTime() + loop.interval_sec * 1000).toISOString();
        await db.upsertRewardLoop({ token_mint: loop.token_mint, next_run_at: nextRunAt });
        results.push({ mint: loop.token_mint, success: true });
      } catch (e) {
        results.push({
          mint: loop.token_mint,
          success: false,
          error: e instanceof Error ? e.message : "Run failed",
        });
      }
    }
    return NextResponse.json({ ran: results.length, results });
  } catch (e) {
    console.error("[rewards/cron]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cron failed" },
      { status: 500 }
    );
  }
}

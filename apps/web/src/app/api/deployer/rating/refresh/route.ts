/**
 * POST /api/deployer/rating/refresh?wallet=...
 * Refresh automated score (DexScreener) for one deployer, or all if no wallet.
 * Call from cron or manually. If wallet provided, only that deployer is updated.
 */

import { getDb } from "@/lib/db";
import { updateDeployerRatingAutomated } from "@/lib/deployer-rating-service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim();
  try {
    const db = getDb();
    const wallets: string[] = [];
    if (wallet) {
      wallets.push(wallet);
    } else {
      const tokens = await db.getTrackedTokens();
      const seen = new Set<string>();
      for (const t of tokens) {
        const c = await db.getCreatorByToken(t.token_mint);
        if (c && !seen.has(c)) {
          seen.add(c);
          wallets.push(c);
        }
      }
    }
    const results: { wallet: string; automated: number; score: number }[] = [];
    for (const w of wallets) {
      try {
        const r = await updateDeployerRatingAutomated(w);
        results.push({ wallet: w, automated: r.automated, score: r.score });
      } catch (e) {
        console.error("[deployer/rating/refresh]", w, e);
      }
    }
    return NextResponse.json({ ok: true, updated: results.length, results });
  } catch (e) {
    console.error("[deployer/rating/refresh]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

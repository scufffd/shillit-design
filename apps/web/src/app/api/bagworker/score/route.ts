/**
 * GET /api/bagworker/score?wallet=...&token_mint=...&period_key=...
 * Returns engagement and share % (SQLite or Supabase).
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  const tokenMint = req.nextUrl.searchParams.get("token_mint");
  const periodKey = req.nextUrl.searchParams.get("period_key");

  if (!wallet || !tokenMint) {
    return NextResponse.json(
      { error: "wallet and token_mint required" },
      { status: 400 }
    );
  }

  const db = getDb();

  let periodId: string | null = null;
  if (periodKey) {
    const period = await db.getPeriodByKey(periodKey);
    periodId = period?.id ?? null;
  } else {
    const latest = await db.getLatestPeriod();
    periodId = latest?.id ?? null;
  }

  if (!periodId) {
    return NextResponse.json(
      { engagement: null, share_pct: 0, period_key: periodKey ?? null, message: "No period data yet" },
      { status: 200 }
    );
  }

  const row = await db.getEngagement(periodId, wallet, tokenMint);

  if (!row) {
    return NextResponse.json(
      { engagement: null, share_pct: 0, period_id: periodId },
      { status: 200 }
    );
  }

  return NextResponse.json({
    engagement: {
      impressions: Number(row.impressions),
      likes: row.likes,
      retweets: row.retweets,
      replies: row.replies,
    },
    raw_score: 0,
    share_pct: Number(row.share_pct),
    share_bps: Math.round(Number(row.share_pct) * 10000),
    period_id: periodId,
  });
}

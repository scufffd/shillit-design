/**
 * POST /api/rewards/[mint]/start
 * Body: { wallet: string, intervalSec?: number }
 * Starts the rewards loop for this token. Only the token creator can start.
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const MIN_INTERVAL_SEC = 10;
const DEFAULT_INTERVAL_SEC = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });
  let body: { wallet?: string; intervalSec?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const wallet = body.wallet?.trim();
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });
  const intervalSec = Math.max(MIN_INTERVAL_SEC, Number(body.intervalSec) || DEFAULT_INTERVAL_SEC);
  try {
    const db = getDb();
    const creator = await db.getCreatorByToken(mint);
    if (creator !== wallet) {
      return NextResponse.json({ error: "Only the token creator can start rewards" }, { status: 403 });
    }
    const now = new Date();
    const nextRunAt = new Date(now.getTime() + intervalSec * 1000).toISOString();
    await db.upsertRewardLoop({
      token_mint: mint,
      interval_sec: intervalSec,
      enabled: true,
      next_run_at: nextRunAt,
    });
    const loop = await db.getRewardLoop(mint);
    return NextResponse.json({ ok: true, rewardLoop: loop });
  } catch (e) {
    console.error("[rewards/[mint]/start]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to start" },
      { status: 500 }
    );
  }
}

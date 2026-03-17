/**
 * POST /api/rewards/[mint]/stop
 * Body: { wallet: string }
 * Stops the rewards loop. Only the token creator can stop.
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });
  let body: { wallet?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const wallet = body.wallet?.trim();
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });
  try {
    const db = getDb();
    const creator = await db.getCreatorByToken(mint);
    if (creator !== wallet) {
      return NextResponse.json({ error: "Only the token creator can stop rewards" }, { status: 403 });
    }
    await db.upsertRewardLoop({ token_mint: mint, enabled: false });
    const loop = await db.getRewardLoop(mint);
    return NextResponse.json({ ok: true, rewardLoop: loop });
  } catch (e) {
    console.error("[rewards/[mint]/stop]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to stop" },
      { status: 500 }
    );
  }
}

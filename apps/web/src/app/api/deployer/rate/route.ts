/**
 * POST /api/deployer/rate
 * Body: { raterWallet, deployerWallet, score } (score 0-100)
 * Submit or update a community rating for a deployer. Recomputes deployer's blended score.
 */

import { getDb } from "@/lib/db";
import { recomputeDeployerRatingFromCommunity } from "@/lib/deployer-rating-service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: { raterWallet?: string; deployerWallet?: string; score?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raterWallet = body.raterWallet?.trim();
  const deployerWallet = body.deployerWallet?.trim();
  const score = typeof body.score === "number" ? Math.min(100, Math.max(0, Math.round(body.score))) : undefined;
  if (!raterWallet || !deployerWallet) {
    return NextResponse.json({ error: "Missing raterWallet or deployerWallet" }, { status: 400 });
  }
  if (score === undefined) {
    return NextResponse.json({ error: "Missing score (0-100)" }, { status: 400 });
  }
  if (raterWallet === deployerWallet) {
    return NextResponse.json({ error: "Cannot rate yourself" }, { status: 400 });
  }
  try {
    const db = getDb();
    const { error } = await db.upsertDeployerRating({ rater_wallet: raterWallet, deployer_wallet: deployerWallet, score });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { community, score: newScore } = await recomputeDeployerRatingFromCommunity(deployerWallet);
    return NextResponse.json({ ok: true, community, score: newScore });
  } catch (e) {
    console.error("[deployer/rate]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

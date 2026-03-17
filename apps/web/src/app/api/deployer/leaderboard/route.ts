/**
 * GET /api/deployer/leaderboard?limit=20
 * Returns top deployers by rating_score (paid profiles only). Public.
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10) || 20)) : 20;
  try {
    const db = getDb();
    const deployers = await db.getTopDeployers(limit);
    return NextResponse.json({
      deployers: deployers.map((p) => ({
        wallet: p.wallet,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        rating_score: p.rating_score,
        rating_automated: p.rating_automated,
        rating_community: p.rating_community,
        rating_updated_at: p.rating_updated_at,
      })),
    });
  } catch (e) {
    console.error("[deployer/leaderboard GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

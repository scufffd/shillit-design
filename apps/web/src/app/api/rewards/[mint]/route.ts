/**
 * GET /api/rewards/[mint]
 * Returns reward loop status for the token (for dashboard).
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });
  try {
    const db = getDb();
    const loop = await db.getRewardLoop(mint);
    return NextResponse.json({ mint, rewardLoop: loop });
  } catch (e) {
    console.error("[rewards/[mint]]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

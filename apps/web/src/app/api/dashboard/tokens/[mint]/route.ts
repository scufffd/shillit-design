/**
 * GET /api/dashboard/tokens/[mint]?wallet=...
 * Token detail for dashboard: claimable fees, reward loop config.
 * Optional wallet: for position (SOL + token balance) and auth (must be creator).
 */

import { getClaimableFees } from "@/lib/fee-collection-service";
import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim() ?? null;
  if (!mint) {
    return NextResponse.json({ error: "Missing mint" }, { status: 400 });
  }
  try {
    const db = getDb();
    const creator = await db.getCreatorByToken(mint);
    const rewardLoop = await db.getRewardLoop(mint);
    let claimable: Awaited<ReturnType<typeof getClaimableFees>> = null;
    try {
      claimable = await getClaimableFees(mint);
    } catch {
      /* ignore */
    }
    const res: {
      mint: string;
      creatorWallet: string | null;
      rewardLoop: typeof rewardLoop;
      claimable: typeof claimable;
      isCreator: boolean;
    } = {
      mint,
      creatorWallet: creator,
      rewardLoop,
      claimable,
      isCreator: wallet !== null && creator === wallet,
    };
    return NextResponse.json(res);
  } catch (e) {
    console.error("[dashboard/tokens/[mint]]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to get token" },
      { status: 500 }
    );
  }
}

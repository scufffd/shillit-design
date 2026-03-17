/**
 * GET /api/token/[mint]/public
 * Public token info for the /t/[mint] page: metadata, reward loop (split + status), Jupiter link.
 * No auth; no creator wallet or private data.
 */

import { getClaimableFees } from "@/lib/fee-collection-service";
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
    const rewardLoop = await db.getRewardLoop(mint);
    let claimable: Awaited<ReturnType<typeof getClaimableFees>> = null;
    try {
      claimable = await getClaimableFees(mint);
    } catch {
      /* ignore */
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const campaigns = await db.getCampaignsByToken(mint);
    const activeCampaign = campaigns.find((c) => c.status === "active");
    return NextResponse.json({
      mint,
      activeCampaign: activeCampaign
        ? {
            id: activeCampaign.id,
            title: activeCampaign.title,
            description: activeCampaign.description,
            reward_mint: activeCampaign.reward_mint,
            reward_amount_raw: activeCampaign.reward_amount_raw,
            holder_requirement_raw: activeCampaign.holder_requirement_raw,
            funded_lamports: activeCampaign.funded_lamports,
            starts_at: activeCampaign.starts_at,
            ends_at: activeCampaign.ends_at,
            creator_wallet: activeCampaign.creator_wallet,
          }
        : null,
      rewardLoop: rewardLoop
        ? {
            enabled: rewardLoop.enabled,
            interval_sec: rewardLoop.interval_sec,
            distribution_split: rewardLoop.distribution_split,
            next_run_at: rewardLoop.next_run_at,
          }
        : null,
      claimable: claimable
        ? {
            partnerTradingFees: claimable.partnerTradingFees,
            creatorTradingFees: claimable.creatorTradingFees,
            partnerLpFees: claimable.partnerLpFees,
            creatorLpFees: claimable.creatorLpFees,
            poolAddress: claimable.poolAddress,
          }
        : null,
      jupiterSwapUrl: `https://jup.ag/swap/SOL-${mint}`,
      tokenPageUrl: `${appUrl.replace(/\/$/, "")}/t/${mint}`,
    });
  } catch (e) {
    console.error("[token/[mint]/public]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

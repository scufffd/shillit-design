import { getDb } from "@/lib/db";
import {
  claimPartnerTradingFees,
  claimPartnerLpFees,
  getClaimableFees,
} from "@/lib/fee-collection-service";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/fees/claim-partner-all
 * Claims partner trading (and LP if migrated) for every tracked token.
 * Optional body: { dryRun: true } to only list what would be claimed.
 */
export async function POST(req: NextRequest) {
  let body: { dryRun?: boolean } = {};
  try {
    if (req.headers.get("content-type")?.includes("application/json")) body = await req.json();
  } catch {
    // ignore
  }
  try {
    const db = getDb();
    const tokens = await db.getTrackedTokens();
    const results: { tokenMint: string; poolAddress?: string; claimed?: object; error?: string }[] = [];
    for (const { token_mint } of tokens) {
      const fees = await getClaimableFees(token_mint);
      if (!fees) {
        results.push({ tokenMint: token_mint, error: "Pool not found" });
        continue;
      }
      if (body.dryRun) {
        results.push({
          tokenMint: token_mint,
          poolAddress: fees.poolAddress,
          claimed: {
            partnerTrading: fees.partnerTradingFees,
            partnerLp: fees.partnerLpFees,
            poolMigrated: fees.poolMigrated,
          },
        });
        continue;
      }
      const claimed: { trading?: { amount: number; sig: string }; lp?: { amount: number; sig: string } } = {};
      if (fees.partnerTradingFees > 0) {
        const r = await claimPartnerTradingFees(fees.poolAddress);
        if (r.success && r.claimedAmount != null && r.signature) claimed.trading = { amount: r.claimedAmount, sig: r.signature };
      }
      if (fees.poolMigrated && fees.partnerLpFees > 0) {
        const r = await claimPartnerLpFees(fees.poolAddress);
        if (r.success && r.claimedAmount != null && r.signature) claimed.lp = { amount: r.claimedAmount, sig: r.signature };
      }
      results.push({ tokenMint: token_mint, poolAddress: fees.poolAddress, claimed: Object.keys(claimed).length ? claimed : undefined });
    }
    return NextResponse.json({ success: true, results });
  } catch (e) {
    console.error("[fees/claim-partner-all]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Claim all failed" },
      { status: 500 }
    );
  }
}

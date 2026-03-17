import {
  claimPartnerTradingFees,
  claimPartnerLpFees,
} from "@/lib/fee-collection-service";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/fees/claim-partner
 * Body: { poolAddress?: string, mint?: string, feeType: 'trading' | 'lp' | 'both' }
 * Server signs with LAUNCHPAD_PRIVATE_KEY and sends.
 */
export async function POST(req: NextRequest) {
  let body: { poolAddress?: string; mint?: string; feeType: "trading" | "lp" | "both" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const poolOrMint = body.poolAddress ?? body.mint;
  const feeType = body.feeType ?? "both";
  if (!poolOrMint) {
    return NextResponse.json({ error: "poolAddress or mint required" }, { status: 400 });
  }
  try {
    const results: { trading?: { claimedAmount: number; signature: string }; lp?: { claimedAmount: number; signature: string } } = {};
    if (feeType === "trading" || feeType === "both") {
      const r = await claimPartnerTradingFees(poolOrMint);
      if (r.success && r.claimedAmount != null && r.signature) results.trading = { claimedAmount: r.claimedAmount, signature: r.signature };
      else if (!r.success && r.error && feeType === "trading") return NextResponse.json({ error: r.error }, { status: 400 });
    }
    if (feeType === "lp" || feeType === "both") {
      const r = await claimPartnerLpFees(poolOrMint);
      if (r.success && r.claimedAmount != null && r.signature) results.lp = { claimedAmount: r.claimedAmount, signature: r.signature };
      else if (!r.success && r.error && feeType === "lp") return NextResponse.json({ error: r.error }, { status: 400 });
    }
    if (Object.keys(results).length === 0 && feeType !== "both")
      return NextResponse.json({ error: "Nothing to claim for this fee type" }, { status: 400 });
    return NextResponse.json({ success: true, ...results });
  } catch (e) {
    console.error("[fees/claim-partner]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Claim failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rewards/status
 * Optional query: mint=... to get claimable fees for that token.
 * Returns claimable fees when mint is provided; otherwise a simple ok.
 */

import { getClaimableFees } from "@/lib/fee-collection-service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get("mint")?.trim();
  if (mint) {
    try {
      const fees = await getClaimableFees(mint);
      if (!fees) return NextResponse.json({ mint, error: "Pool not found" }, { status: 404 });
      return NextResponse.json({ mint, claimable: fees });
    } catch (e) {
      console.error("[rewards/status]", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed" },
        { status: 500 }
      );
    }
  }
  return NextResponse.json({ ok: true, service: "rewards" });
}

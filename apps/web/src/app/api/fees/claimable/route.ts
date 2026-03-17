import { getClaimableFees } from "@/lib/fee-collection-service";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/fees/claimable?pool=... or ?mint=...
 */
export async function GET(req: NextRequest) {
  const pool = req.nextUrl.searchParams.get("pool");
  const mint = req.nextUrl.searchParams.get("mint");
  const poolOrMint = pool ?? mint;
  if (!poolOrMint) {
    return NextResponse.json({ error: "Missing query: pool or mint" }, { status: 400 });
  }
  try {
    const fees = await getClaimableFees(poolOrMint);
    if (!fees) return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    return NextResponse.json(fees);
  } catch (e) {
    console.error("[fees/claimable]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to get claimable fees" },
      { status: 500 }
    );
  }
}

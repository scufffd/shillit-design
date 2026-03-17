import { createCreatorTradingFeeClaimTransaction } from "@/lib/fee-collection-service";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/fees/claim-creator-trading
 * Body: { poolAddress?: string, mint?: string, creatorWallet: string }
 * Returns unsigned tx (base64) for frontend to sign.
 */
export async function POST(req: NextRequest) {
  let body: { poolAddress?: string; mint?: string; creatorWallet: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const poolOrMint = body.poolAddress ?? body.mint;
  if (!poolOrMint || !body.creatorWallet) {
    return NextResponse.json({ error: "poolAddress or mint and creatorWallet required" }, { status: 400 });
  }
  try {
    const result = await createCreatorTradingFeeClaimTransaction(poolOrMint, body.creatorWallet);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ transaction: result.transaction, claimableAmount: result.claimableAmount });
  } catch (e) {
    console.error("[fees/claim-creator-trading]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create claim transaction" },
      { status: 500 }
    );
  }
}

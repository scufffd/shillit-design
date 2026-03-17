/**
 * GET /api/bagworker/claimable?wallet=...
 * Returns list of claimable amounts per token/period (SQLite or Supabase).
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet required" }, { status: 400 });
  }

  const db = getDb();
  const engagements = await db.getEngagementsByWallet(wallet);
  const claims = await db.getClaimsByWallet(wallet);

  const claimedByKey = new Map<string, number>();
  for (const c of claims) {
    const key = `${c.period_id}:${c.token_mint}`;
    claimedByKey.set(key, (claimedByKey.get(key) ?? 0) + Number(c.amount_lamports));
  }

  const items = engagements.map((e) => ({
    token_mint: e.token_mint,
    period_id: e.period_id,
    share_pct: e.share_pct,
    claimable_lamports: null as number | null,
  }));

  return NextResponse.json({
    wallet,
    items,
    message:
      "claimable_lamports requires fee pool per period from on-chain or ledger; currently only share_pct is stored.",
  });
}

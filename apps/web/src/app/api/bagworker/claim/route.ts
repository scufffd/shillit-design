/**
 * POST /api/bagworker/claim
 * Body: { wallet, token_mint, period_id, amount_lamports?, tx_signature? }
 * Records a claim (SQLite or Supabase).
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: { wallet: string; token_mint: string; period_id: string; amount_lamports?: number; tx_signature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { wallet, token_mint, period_id, amount_lamports, tx_signature } = body;
  if (!wallet || !token_mint || !period_id) {
    return NextResponse.json(
      { error: "wallet, token_mint, period_id required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const engagement = await db.getEngagement(period_id, wallet, token_mint);

  if (!engagement || Number(engagement.share_pct) <= 0) {
    return NextResponse.json(
      { error: "No share for this wallet/token/period" },
      { status: 403 }
    );
  }

  const { error } = await db.insertClaim({
    wallet,
    token_mint,
    period_id,
    amount_lamports: amount_lamports ?? 0,
    share_pct: engagement.share_pct,
    tx_signature: tx_signature ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Claim recorded. Payout can be processed by treasury job or on-chain claim.",
  });
}

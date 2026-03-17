/**
 * POST /api/cto/submit
 * Body: JSON { mint, new_authority, proposal_uri?, tx_signature? }
 * Validates that the mint is in the inactive_tokens list (eligible for CTO), then records the CTO (SQLite or Supabase).
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: {
    mint: string;
    new_authority: string;
    proposal_uri?: string;
    tx_signature?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { mint, new_authority, proposal_uri, tx_signature } = body;
  if (!mint || !new_authority) {
    return NextResponse.json(
      { error: "Missing mint or new_authority" },
      { status: 400 }
    );
  }

  const db = getDb();
  const eligible = await db.getByMint(mint);

  if (!eligible || !eligible.cto_eligible) {
    return NextResponse.json(
      { error: "Token not eligible for CTO (inactive/low-cap list)" },
      { status: 400 }
    );
  }

  const { error } = await db.insertCtoClaim({
    mint,
    new_authority,
    proposal_uri: proposal_uri || null,
    tx_signature: tx_signature || null,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    mint,
    new_authority,
    message: "CTO recorded. Announcement and marketing support from treasury.",
  });
}

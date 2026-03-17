/**
 * GET /api/dashboard/tokens?wallet=...
 * Returns tokens created by the given wallet (creator). Requires wallet query.
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim();
  if (!wallet) {
    return NextResponse.json({ error: "Missing query: wallet" }, { status: 400 });
  }
  try {
    const db = getDb();
    const tokens = await db.getTokensByCreator(wallet);
    return NextResponse.json({ tokens });
  } catch (e) {
    console.error("[dashboard/tokens]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list tokens" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bagworker/detected-tweets?token_mint=...
 * Returns detected tweets for a token (from local SQLite).
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const tokenMint = req.nextUrl.searchParams.get("token_mint");
  if (!tokenMint) {
    return NextResponse.json({ error: "token_mint required" }, { status: 400 });
  }

  const db = getDb();
  const tweets = await db.getDetectedTweetsByToken(tokenMint);

  return NextResponse.json({ token_mint: tokenMint, count: tweets.length, tweets });
}

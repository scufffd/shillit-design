/**
 * POST /api/bagworker/tweets
 * Body: { wallet, token_mint, tweet_id, tweet_url? }
 * Requires wallet to have a verified X link. Submits a tweet (SQLite or Supabase).
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: { wallet: string; token_mint: string; tweet_id: string; tweet_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { wallet, token_mint, tweet_id, tweet_url } = body;
  if (!wallet || !token_mint || !tweet_id) {
    return NextResponse.json(
      { error: "wallet, token_mint, and tweet_id required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const profile = await db.getProfileByWallet(wallet);

  if (!profile) {
    return NextResponse.json(
      { error: "Link your X account first (Sign in with X)" },
      { status: 403 }
    );
  }

  const tweetIdClean = tweet_id.replace(/\D/g, "") || tweet_id;
  const { error } = await db.upsertTweet({
    wallet,
    token_mint,
    tweet_id: tweetIdClean,
    tweet_url: tweet_url ?? `https://x.com/i/status/${tweetIdClean}`,
    status: "pending",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Tweet submitted. We'll verify authorship and count engagement for rewards.",
  });
}

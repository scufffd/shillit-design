/**
 * POST /api/bagworker/scan
 * Runs X recent search for all tracked tokens and upserts results into detected_tweets (SQLite).
 * Requires X_BEARER_TOKEN. Returns count of tokens scanned and tweets found.
 */

import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const bearerToken = process.env.X_BEARER_TOKEN;

async function searchTweetsRecent(
  query: string,
  maxResults = 100
): Promise<{
  tweets: { id: string; author_id?: string }[];
  users: { id: string; username: string }[];
  meta?: { result_count: number };
  error?: string;
}> {
  if (!bearerToken) return { tweets: [], users: [], error: "No bearer token" };
  // Search without quotes so we match any tweet containing the token (e.g. in URLs or truncated)
  const searchQuery = query.length > 128 ? query.slice(0, 128) : query; // API query length limit
  const params = new URLSearchParams({
    query: searchQuery,
    max_results: String(Math.min(maxResults, 100)),
    "tweet.fields": "created_at,public_metrics",
    "user.fields": "username",
    expansions: "author_id",
  });
  const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  const body = (await res.json()) as {
    data?: { id: string; author_id?: string }[];
    includes?: { users?: { id: string; username: string }[] };
    meta?: { result_count: number };
    error?: string;
    title?: string;
    detail?: string;
  };
  if (!res.ok) {
    const err = body.detail ?? body.title ?? JSON.stringify(body);
    console.error("Twitter search failed", res.status, err);
    return { tweets: [], users: [], error: String(err) };
  }
  return {
    tweets: body.data ?? [],
    users: body.includes?.users ?? [],
    meta: body.meta,
  };
}

export async function POST(_req: NextRequest) {
  if (!bearerToken) {
    return NextResponse.json(
      { error: "X_BEARER_TOKEN not set. Add an app-only Bearer token in X developer portal for search." },
      { status: 501 }
    );
  }

  const db = getDb();
  const tracked = await db.getTrackedTokens();
  if (!tracked.length) {
    return NextResponse.json({ ok: true, tokensScanned: 0, tweetsFound: 0, detected: [] });
  }

  let tweetsFound = 0;
  const detected: { token_mint: string; tweet_id: string; author_username: string }[] = [];
  const debug: { token_mint: string; search_query: string; result_count?: number; error?: string }[] = [];

  for (const { token_mint, search_query } of tracked) {
    const result = await searchTweetsRecent(search_query);
    debug.push({
      token_mint,
      search_query: search_query.slice(0, 60) + (search_query.length > 60 ? "…" : ""),
      result_count: result.meta?.result_count,
      error: result.error,
    });
    const { tweets, users } = result;
    const userById = new Map(users.map((u) => [u.id, u]));

    for (const t of tweets) {
      const authorId = t.author_id;
      const author = authorId ? userById.get(authorId) : null;
      const author_username = author?.username ?? "unknown";

      await db.upsertDetectedTweet({
        tweet_id: t.id,
        token_mint,
        author_x_user_id: authorId ?? "",
        author_username,
        tweet_created_at: null,
      });
      tweetsFound++;
      detected.push({ token_mint, tweet_id: t.id, author_username });
    }
  }

  return NextResponse.json({
    ok: true,
    tokensScanned: tracked.length,
    tweetsFound,
    detected,
    debug,
    note: "Recent search only returns tweets from the last 7 days. If you see result_count 0, try a shorter search term (e.g. token symbol or first 10–20 chars of the mint).",
  });
}

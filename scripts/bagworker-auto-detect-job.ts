/**
 * Bagworker auto-detect job (run as cron, e.g. every 1–6 hours).
 *
 * 1. For each token in tracked_tokens, call Twitter API v2 recent search with search_query (CA or short link).
 * 2. Upsert results into detected_tweets (tweet_id, token_mint, author_x_user_id, author_username).
 * 3. For each detected_tweet, fetch current metrics (public with Bearer; impressions with author's token if linked).
 * 4. Update last_impressions, last_likes, last_retweets, last_replies, last_metrics_at for delta scoring.
 *
 * Requires: X_BEARER_TOKEN (app-only), NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional: bagworker_profiles with x_access_token_encrypted for impression fetch per author.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const bearerToken = process.env.X_BEARER_TOKEN;

interface TweetSearchResult {
  id: string;
  author_id?: string;
  created_at?: string;
  public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number };
}

interface UserInclude {
  id: string;
  username: string;
}

async function searchTweetsRecent(query: string, maxResults = 100): Promise<{ tweets: TweetSearchResult[]; users: UserInclude[] }> {
  if (!bearerToken) return { tweets: [], users: [] };
  const params = new URLSearchParams({
    query: `"${query}"`,
    max_results: String(Math.min(maxResults, 100)),
    "tweet.fields": "created_at,public_metrics",
    "user.fields": "username",
    expansions: "author_id",
  });
  const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Twitter search failed", res.status, err);
    return { tweets: [], users: [] };
  }
  const data = (await res.json()) as {
    data?: TweetSearchResult[];
    includes?: { users?: UserInclude[] };
  };
  const tweets = data.data ?? [];
  const users = data.includes?.users ?? [];
  return { tweets, users };
}

async function fetchPublicMetrics(tweetId: string): Promise<{ likes: number; retweets: number; replies: number }> {
  if (!bearerToken) return { likes: 0, retweets: 0, replies: 0 };
  const res = await fetch(
    `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`,
    { headers: { Authorization: `Bearer ${bearerToken}` } }
  );
  if (!res.ok) return { likes: 0, retweets: 0, replies: 0 };
  const json = (await res.json()) as { data?: { public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number } } };
  const p = json.data?.public_metrics ?? {};
  return {
    likes: p.like_count ?? 0,
    retweets: p.retweet_count ?? 0,
    replies: p.reply_count ?? 0,
  };
}

async function fetchWithImpressions(tweetId: string, accessToken: string): Promise<{ impressions: number; likes: number; retweets: number; replies: number }> {
  const res = await fetch(
    `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics,non_public_metrics`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return { impressions: 0, likes: 0, retweets: 0, replies: 0 };
  const json = (await res.json()) as {
    data?: {
      public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number };
      non_public_metrics?: { impression_count?: number };
    };
  };
  const pub = json.data?.public_metrics ?? {};
  const non = json.data?.non_public_metrics ?? {};
  return {
    impressions: non.impression_count ?? 0,
    likes: pub.like_count ?? 0,
    retweets: pub.retweet_count ?? 0,
    replies: pub.reply_count ?? 0,
  };
}

export async function runAutoDetectJob() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: tracked } = await supabase.from("tracked_tokens").select("token_mint, search_query");
  if (!tracked?.length) {
    console.log("No tracked_tokens; add rows to enable auto-detect.");
    return;
  }

  const { data: profiles } = await supabase
    .from("bagworker_profiles")
    .select("x_user_id, x_access_token_encrypted");
  const tokenByXUserId = new Map(
    (profiles ?? []).map((p) => [p.x_user_id, p.x_access_token_encrypted as string])
  );

  for (const { token_mint, search_query } of tracked) {
    const { tweets, users } = await searchTweetsRecent(search_query);
    const userById = new Map(users.map((u) => [u.id, u]));

    for (const t of tweets) {
      const authorId = t.author_id;
      const author = authorId ? userById.get(authorId) : null;
      const author_username = author?.username ?? "unknown";

      await supabase.from("detected_tweets").upsert(
        {
          tweet_id: t.id,
          token_mint,
          author_x_user_id: authorId ?? "",
          author_username,
          tweet_created_at: t.created_at ?? null,
        },
        { onConflict: "tweet_id,token_mint", ignoreDuplicates: false }
      );
    }
  }

  // Only discover new tweets. last_* is updated by the engagement job at period close (for delta).
  console.log("Auto-detect: discovered tweets for", tracked.length, "tokens.");
}

if (require.main === module) {
  runAutoDetectJob().then(() => console.log("Done"), console.error);
}

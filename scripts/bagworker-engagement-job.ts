/**
 * Bagworker engagement job (run at period end, e.g. daily or weekly).
 *
 * Combines:
 * 1. MANUAL: Approved tweets from bagworker_tweets → fetch metrics (user token for impressions) → aggregate by wallet/token (cumulative for period).
 * 2. AUTO: detected_tweets → fetch current metrics → delta = current - last_* → update last_* = current → aggregate delta by (author → wallet if linked). Only linked authors get share from auto.
 * 3. Merge scores per (wallet, token_mint), compute share_pct = raw_score / total per token, upsert bagworker_engagement.
 *
 * Prereqs: Supabase, X_BEARER_TOKEN (public metrics), bagworker_profiles with tokens for impressions (manual + auto when author linked).
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const bearerToken = process.env.X_BEARER_TOKEN;

async function fetchTweetMetricsUser(
  tweetId: string,
  accessToken: string
): Promise<{ impressions: number; likes: number; retweets: number; replies: number }> {
  const res = await fetch(
    `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics,non_public_metrics`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return { impressions: 0, likes: 0, retweets: 0, replies: 0 };
  const data = (await res.json()) as {
    data?: {
      public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number };
      non_public_metrics?: { impression_count?: number };
    };
  };
  const pub = data.data?.public_metrics ?? {};
  const nonPub = data.data?.non_public_metrics ?? {};
  return {
    impressions: nonPub.impression_count ?? 0,
    likes: pub.like_count ?? 0,
    retweets: pub.retweet_count ?? 0,
    replies: pub.reply_count ?? 0,
  };
}

async function fetchTweetMetricsPublic(tweetId: string): Promise<{ likes: number; retweets: number; replies: number }> {
  if (!bearerToken) return { likes: 0, retweets: 0, replies: 0 };
  const res = await fetch(
    `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`,
    { headers: { Authorization: `Bearer ${bearerToken}` } }
  );
  if (!res.ok) return { likes: 0, retweets: 0, replies: 0 };
  const data = (await res.json()) as {
    data?: { public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number } };
  };
  const p = data.data?.public_metrics ?? {};
  return {
    likes: p.like_count ?? 0,
    retweets: p.retweet_count ?? 0,
    replies: p.reply_count ?? 0,
  };
}

async function fetchTweetMetricsFull(tweetId: string, accessToken: string): Promise<{ impressions: number; likes: number; retweets: number; replies: number }> {
  const res = await fetch(
    `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics,non_public_metrics`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return { impressions: 0, likes: 0, retweets: 0, replies: 0 };
  const data = (await res.json()) as {
    data?: {
      public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number };
      non_public_metrics?: { impression_count?: number };
    };
  };
  const pub = data.data?.public_metrics ?? {};
  const non = data.data?.non_public_metrics ?? {};
  return {
    impressions: non.impression_count ?? 0,
    likes: pub.like_count ?? 0,
    retweets: pub.retweet_count ?? 0,
    replies: pub.reply_count ?? 0,
  };
}

function computeRawScore(metrics: {
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
}): number {
  const w = {
    impressions: Number(process.env.BAGWORKER_W_IMPRESSIONS) || 1,
    likes: Number(process.env.BAGWORKER_W_LIKES) || 2,
    retweets: Number(process.env.BAGWORKER_W_RETWEETS) || 3,
    replies: Number(process.env.BAGWORKER_W_REPLIES) || 2,
  };
  return (
    w.impressions * metrics.impressions +
    w.likes * metrics.likes +
    w.retweets * metrics.retweets +
    w.replies * metrics.replies
  );
}

export async function runEngagementJob(periodKey: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date().toISOString();

  const { data: period } = await supabase
    .from("bagworker_periods")
    .select("id")
    .eq("period_key", periodKey)
    .single();

  if (!period) throw new Error(`Period ${periodKey} not found`);

  const { data: profiles } = await supabase
    .from("bagworker_profiles")
    .select("wallet, x_user_id, x_access_token_encrypted");
  const tokenByWallet = new Map((profiles ?? []).map((p) => [p.wallet, p.x_access_token_encrypted as string]));
  const walletByXUserId = new Map((profiles ?? []).map((p) => [p.x_user_id, p.wallet]));

  const aggregated = new Map<string, { impressions: number; likes: number; retweets: number; replies: number; raw_score: number }>();

  // --- MANUAL: approved tweets, cumulative metrics ---
  const { data: manualTweets } = await supabase
    .from("bagworker_tweets")
    .select("wallet, token_mint, tweet_id")
    .eq("status", "approved");

  for (const t of manualTweets ?? []) {
    const accessToken = tokenByWallet.get(t.wallet);
    if (!accessToken) continue;
    const metrics = await fetchTweetMetricsUser(t.tweet_id, accessToken);
    const key = `${t.wallet}:${t.token_mint}`;
    const cur = aggregated.get(key) ?? { impressions: 0, likes: 0, retweets: 0, replies: 0, raw_score: 0 };
    cur.impressions += metrics.impressions;
    cur.likes += metrics.likes;
    cur.retweets += metrics.retweets;
    cur.replies += metrics.replies;
    aggregated.set(key, cur);
  }

  // --- AUTO: detected_tweets, delta metrics; only linked authors get share ---
  const { data: detectedRows } = await supabase
    .from("detected_tweets")
    .select("id, tweet_id, token_mint, author_x_user_id, last_impressions, last_likes, last_retweets, last_replies");
  const tokenByXUserId = new Map((profiles ?? []).map((p) => [p.x_user_id, p.x_access_token_encrypted as string]));

  for (const row of detectedRows ?? []) {
    const accessToken = tokenByXUserId.get(row.author_x_user_id);
    let current = { impressions: 0, likes: 0, retweets: 0, replies: 0 };
    if (accessToken) {
      current = await fetchTweetMetricsFull(row.tweet_id, accessToken);
    } else {
      const p = await fetchTweetMetricsPublic(row.tweet_id);
      current = { ...p, impressions: 0 };
    }

    const delta = {
      impressions: Math.max(0, current.impressions - Number(row.last_impressions ?? 0)),
      likes: Math.max(0, current.likes - Number(row.last_likes ?? 0)),
      retweets: Math.max(0, current.retweets - Number(row.last_retweets ?? 0)),
      replies: Math.max(0, current.replies - Number(row.last_replies ?? 0)),
    };

    await supabase
      .from("detected_tweets")
      .update({
        last_impressions: current.impressions,
        last_likes: current.likes,
        last_retweets: current.retweets,
        last_replies: current.replies,
        last_metrics_at: now,
      })
      .eq("id", row.id);

    const wallet = walletByXUserId.get(row.author_x_user_id);
    if (!wallet) continue;

    const key = `${wallet}:${row.token_mint}`;
    const cur = aggregated.get(key) ?? { impressions: 0, likes: 0, retweets: 0, replies: 0, raw_score: 0 };
    cur.impressions += delta.impressions;
    cur.likes += delta.likes;
    cur.retweets += delta.retweets;
    cur.replies += delta.replies;
    aggregated.set(key, cur);
  }

  for (const [key, m] of aggregated) {
    m.raw_score = computeRawScore({
      impressions: m.impressions,
      likes: m.likes,
      retweets: m.retweets,
      replies: m.replies,
    });
  }

  const byToken = new Map<string, { wallet: string; raw_score: number; impressions: number; likes: number; retweets: number; replies: number }[]>();
  for (const [key, m] of aggregated) {
    const [wallet, token_mint] = key.split(":");
    if (!byToken.has(token_mint)) byToken.set(token_mint, []);
    byToken.get(token_mint)!.push({
      wallet,
      raw_score: m.raw_score,
      impressions: m.impressions,
      likes: m.likes,
      retweets: m.retweets,
      replies: m.replies,
    });
  }

  for (const [token_mint, rows] of byToken) {
    const total = rows.reduce((s, r) => s + r.raw_score, 0);
    for (const r of rows) {
      const share_pct = total > 0 ? r.raw_score / total : 0;
      await supabase.from("bagworker_engagement").upsert(
        {
          period_id: period.id,
          wallet: r.wallet,
          token_mint,
          impressions: r.impressions,
          likes: r.likes,
          retweets: r.retweets,
          replies: r.replies,
          raw_score: r.raw_score,
          share_pct,
          updated_at: now,
        },
        { onConflict: "period_id,wallet,token_mint" }
      );
    }
  }
}

if (require.main === module) {
  const periodKey = process.argv[2] || "2026-W11";
  runEngagementJob(periodKey).then(() => console.log("Done"), console.error);
}

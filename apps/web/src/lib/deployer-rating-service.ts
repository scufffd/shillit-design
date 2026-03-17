/**
 * Deployer rating: automated (DexScreener volume/liquidity) + community.
 * Blended score = 0.7 * automated + 0.3 * community (community default 50 if no votes).
 */

import { getDb } from "./db";

const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex/tokens";

/** 0–100 from 24h volume USD (log scale). ~$1k=>20, ~$10k=>40, ~$100k=>60, ~$1M=>80, ~$10M=>100 */
function scoreFromVolumeUsd(volumeUsd: number): number {
  if (volumeUsd <= 0) return 0;
  const log = Math.log10(volumeUsd + 1);
  const minLog = 3; // ~1k
  const maxLog = 7; // ~10M
  const t = (log - minLog) / (maxLog - minLog);
  return Math.min(100, Math.max(0, Math.round(t * 100)));
}

/** 0–100 from liquidity USD. ~$10k=>30, ~$50k=>50, ~$200k=>70, ~$1M=>90 */
function scoreFromLiquidityUsd(liquidityUsd: number): number {
  if (liquidityUsd <= 0) return 0;
  const log = Math.log10(liquidityUsd + 1);
  const minLog = 4; // ~10k
  const maxLog = 6; // ~1M
  const t = (log - minLog) / (maxLog - minLog);
  return Math.min(100, Math.max(0, Math.round(t * 100)));
}

export interface DexScreenerPair {
  volume?: { h24?: number };
  liquidity?: { usd?: number };
}

export async function fetchTokenStatsFromDexScreener(mint: string): Promise<{ volumeH24: number; liquidityUsd: number }> {
  const res = await fetch(`${DEXSCREENER_BASE}/${mint}`, { next: { revalidate: 60 } });
  if (!res.ok) return { volumeH24: 0, liquidityUsd: 0 };
  const data = (await res.json()) as { pairs?: DexScreenerPair[] };
  const pairs = data.pairs ?? [];
  let totalVol = 0;
  let totalLiq = 0;
  for (const p of pairs) {
    totalVol += p.volume?.h24 ?? 0;
    totalLiq += p.liquidity?.usd ?? 0;
  }
  // Use best pair if multiple (e.g. highest liquidity)
  const best = pairs.length
    ? pairs.reduce((a, b) => ((a.liquidity?.usd ?? 0) > (b.liquidity?.usd ?? 0) ? a : b))
    : null;
  const volumeH24 = best ? (best.volume?.h24 ?? 0) : totalVol;
  const liquidityUsd = best ? (best.liquidity?.usd ?? 0) : totalLiq;
  return { volumeH24, liquidityUsd };
}

/** Compute 0–100 automated score for one deployer from their tokens' DexScreener data. */
export async function computeAutomatedScoreForDeployer(creatorWallet: string): Promise<number> {
  const db = getDb();
  const tokens = await db.getTokensByCreator(creatorWallet);
  if (tokens.length === 0) return 50;
  const scores: number[] = [];
  for (const { token_mint } of tokens) {
    try {
      const { volumeH24, liquidityUsd } = await fetchTokenStatsFromDexScreener(token_mint);
      const volScore = scoreFromVolumeUsd(volumeH24);
      const liqScore = scoreFromLiquidityUsd(liquidityUsd);
      const combined = Math.round(0.6 * volScore + 0.4 * liqScore);
      scores.push(combined);
    } catch {
      scores.push(50);
    }
  }
  if (scores.length === 0) return 50;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.min(100, Math.max(0, Math.round(avg)));
}

/** Aggregate community ratings (average) for a deployer. Default 50 if no ratings. */
export function aggregateCommunityScore(ratings: { score: number }[]): number {
  if (ratings.length === 0) return 50;
  const sum = ratings.reduce((a, r) => a + r.score, 0);
  return Math.min(100, Math.max(0, Math.round(sum / ratings.length)));
}

const AUTOMATED_WEIGHT = 0.7;
const COMMUNITY_WEIGHT = 0.3;

/** Blend automated and community into final 0–100 score. */
export function blendScore(automated: number, community: number): number {
  return Math.min(100, Math.max(0, Math.round(AUTOMATED_WEIGHT * automated + COMMUNITY_WEIGHT * community)));
}

/** Update deployer_profiles.rating_automated and recompute rating_score from community. */
export async function updateDeployerRatingAutomated(creatorWallet: string): Promise<{ automated: number; score: number }> {
  const db = getDb();
  const automated = await computeAutomatedScoreForDeployer(creatorWallet);
  const profile = await db.getDeployerProfile(creatorWallet);
  const community = profile?.rating_community ?? 50;
  const score = blendScore(automated, community);
  await db.upsertDeployerProfile({
    wallet: creatorWallet,
    rating_automated: automated,
    rating_score: score,
    rating_updated_at: new Date().toISOString(),
  });
  return { automated, score };
}

/** Recompute community average from deployer_ratings and blend; update profile. */
export async function recomputeDeployerRatingFromCommunity(creatorWallet: string): Promise<{ community: number; score: number }> {
  const db = getDb();
  const ratings = await db.getRatingsForDeployer(creatorWallet);
  const community = aggregateCommunityScore(ratings);
  const profile = await db.getDeployerProfile(creatorWallet);
  const automated = profile?.rating_automated ?? 50;
  const score = blendScore(automated, community);
  await db.upsertDeployerProfile({
    wallet: creatorWallet,
    rating_community: community,
    rating_score: score,
    rating_updated_at: new Date().toISOString(),
  });
  return { community, score };
}

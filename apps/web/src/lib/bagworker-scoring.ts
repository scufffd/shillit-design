/**
 * Bagworker reward weighting: raw_score from engagement, then share = raw_score / total_score.
 * Weights are configurable via env (BAGWORKER_W_*).
 */

export const DEFAULT_WEIGHTS = {
  impressions: 1,
  likes: 2,
  retweets: 3,
  replies: 2,
} as const;

function getWeights() {
  return {
    impressions: Number(process.env.BAGWORKER_W_IMPRESSIONS) || DEFAULT_WEIGHTS.impressions,
    likes: Number(process.env.BAGWORKER_W_LIKES) || DEFAULT_WEIGHTS.likes,
    retweets: Number(process.env.BAGWORKER_W_RETWEETS) || DEFAULT_WEIGHTS.retweets,
    replies: Number(process.env.BAGWORKER_W_REPLIES) || DEFAULT_WEIGHTS.replies,
  };
}

export interface EngagementMetrics {
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
}

/**
 * Compute raw score for one bagworker from their aggregated metrics.
 */
export function computeRawScore(metrics: EngagementMetrics): number {
  const w = getWeights();
  return (
    w.impressions * metrics.impressions +
    w.likes * metrics.likes +
    w.retweets * metrics.retweets +
    w.replies * metrics.replies
  );
}

/**
 * Given an array of raw scores (one per bagworker for the same token/period),
 * return each bagworker's share (0..1). Sum of shares = 1 (or 0 if total is 0).
 */
export function computeShares(rawScores: number[]): number[] {
  const total = rawScores.reduce((a, b) => a + b, 0);
  if (total <= 0) return rawScores.map(() => 0);
  return rawScores.map((s) => s / total);
}

/**
 * Compute share in basis points (0..10000) for display.
 */
export function shareToBps(share: number): number {
  return Math.round(share * 10000);
}

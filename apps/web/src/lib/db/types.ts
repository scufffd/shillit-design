/**
 * Shared DB interface so we can switch between SQLite (dev) and Supabase (live).
 */

export interface DbUsedImages {
  insertUsedImage(params: { hash_sha256: string; mint: string }): Promise<{ error?: { code: string; message: string } }>;
  getUsedImageByHash(hash: string): Promise<{ id: string } | null>;
}

export interface DbTrackedTokens {
  upsertTrackedToken(params: { token_mint: string; search_query: string }): Promise<{ error?: { message: string } }>;
  getTrackedTokens(): Promise<{ token_mint: string; search_query: string }[]>;
}

export interface DistributionSplitDb {
  holdersPct: number;
  creatorPct: number;
  buysPct: number;
  burnPct: number;
  lpPct: number;
  creatorWallet?: string | null;
  burnOnBuyback?: boolean;
}

export interface DbTokenCreators {
  upsertTokenCreator(params: {
    token_mint: string;
    creator_wallet: string;
    deployer_rating_at_launch?: number | null;
  }): Promise<{ error?: { message: string } }>;
  getTokensByCreator(creator_wallet: string): Promise<{ token_mint: string; search_query: string }[]>;
  getCreatorByToken(token_mint: string): Promise<string | null>;
  /** Snapshot rating is set at token creation; used for fee tier so later rating changes don't affect this token. */
  getTokenCreatorWithRating(token_mint: string): Promise<{ creator_wallet: string; deployer_rating_at_launch: number | null } | null>;
}

export interface DbRewardLoops {
  getRewardLoop(token_mint: string): Promise<{
    token_mint: string;
    interval_sec: number;
    distribution_split: DistributionSplitDb | null;
    enabled: boolean;
    next_run_at: string | null;
    updated_at: string;
  } | null>;
  upsertRewardLoop(params: {
    token_mint: string;
    interval_sec?: number;
    distribution_split?: DistributionSplitDb | null;
    enabled?: boolean;
    next_run_at?: string | null;
  }): Promise<{ error?: { message: string } }>;
  getEnabledRewardLoops(): Promise<{
    token_mint: string;
    interval_sec: number;
    distribution_split: DistributionSplitDb | null;
    next_run_at: string | null;
  }[]>;
}

export interface DbBagworkerOauthState {
  upsertOauthState(params: { state: string; wallet: string; code_verifier: string }): Promise<void>;
  getOauthState(state: string): Promise<{ wallet: string; code_verifier: string } | null>;
  deleteOauthState(state: string): Promise<void>;
}

export interface DbBagworkerProfiles {
  upsertProfile(params: {
    wallet: string;
    x_user_id: string;
    x_username: string;
    x_access_token_encrypted?: string | null;
    x_refresh_token_encrypted?: string | null;
    x_token_expires_at?: string | null;
  }): Promise<void>;
  getProfileByWallet(wallet: string): Promise<{ wallet: string; x_user_id: string; x_access_token_encrypted?: string } | null>;
  getAllProfiles(): Promise<{ wallet: string; x_user_id: string; x_access_token_encrypted?: string }[]>;
}

export interface DbBagworkerTweets {
  upsertTweet(params: { wallet: string; token_mint: string; tweet_id: string; tweet_url?: string; status?: string }): Promise<{ error?: { message: string } }>;
  getApprovedTweets(): Promise<{ wallet: string; token_mint: string; tweet_id: string }[]>;
}

export interface DbBagworkerPeriods {
  getPeriodByKey(period_key: string): Promise<{ id: string } | null>;
  getLatestPeriod(): Promise<{ id: string; period_key: string } | null>;
}

export interface DbBagworkerEngagement {
  upsertEngagement(params: {
    period_id: string;
    wallet: string;
    token_mint: string;
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
    raw_score: number;
    share_pct: number;
  }): Promise<void>;
  getEngagement(period_id: string, wallet: string, token_mint: string): Promise<{ share_pct: number; impressions: number; likes: number; retweets: number; replies: number } | null>;
  getEngagementsByWallet(wallet: string): Promise<{ period_id: string; token_mint: string; share_pct: number }[]>;
}

export interface DbBagworkerClaims {
  insertClaim(params: { wallet: string; token_mint: string; period_id: string; amount_lamports: number; share_pct: number; tx_signature?: string | null }): Promise<{ error?: { message: string } }>;
  getClaimsByWallet(wallet: string): Promise<{ period_id: string; token_mint: string; amount_lamports: number }[]>;
}

export interface DbDetectedTweets {
  upsertDetectedTweet(params: { tweet_id: string; token_mint: string; author_x_user_id: string; author_username: string; tweet_created_at?: string | null }): Promise<void>;
  getAllDetectedTweets(): Promise<{ id: string; tweet_id: string; token_mint: string; author_x_user_id: string; author_username: string; last_impressions: number; last_likes: number; last_retweets: number; last_replies: number }[]>;
  getDetectedTweetsByToken(token_mint: string): Promise<{ id: string; tweet_id: string; author_username: string; last_likes: number; last_retweets: number; last_replies: number; first_seen_at: string }[]>;
  updateDetectedTweetMetrics(id: string, params: { last_impressions: number; last_likes: number; last_retweets: number; last_replies: number; last_metrics_at: string }): Promise<void>;
}

export interface DbInactiveTokens {
  getByMint(mint: string): Promise<{ mint: string; cto_eligible: boolean } | null>;
}

export type CtoClaimStatus = "pending" | "approved" | "fee_paid";

export interface CtoClaimRow {
  id: string;
  mint: string;
  new_authority: string;
  proposal_uri: string | null;
  tx_signature: string | null;
  claimed_at: string;
  status: CtoClaimStatus;
  fee_lamports: number | null;
  fee_tx_sig: string | null;
}

export interface DbCtoClaims {
  insertCtoClaim(params: { mint: string; new_authority: string; proposal_uri?: string | null; tx_signature?: string | null }): Promise<{ error?: { message: string } }>;
  getCtoClaims(status?: CtoClaimStatus): Promise<CtoClaimRow[]>;
  updateCtoClaimStatus(id: string, params: { status?: CtoClaimStatus; fee_lamports?: number | null; fee_tx_sig?: string | null }): Promise<{ error?: { message: string } }>;
}

export interface DeployerProfileRow {
  wallet: string;
  created_at: string;
  paid_at: string | null;
  profile_fee_lamports: number;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  rating_score: number;
  rating_automated: number;
  rating_community: number;
  rating_updated_at: string;
}

export interface DbDeployerProfiles {
  getDeployerProfile(wallet: string): Promise<DeployerProfileRow | null>;
  getTopDeployers(limit: number): Promise<DeployerProfileRow[]>;
  upsertDeployerProfile(params: {
    wallet: string;
    paid_at?: string | null;
    profile_fee_lamports?: number;
    display_name?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
    rating_score?: number;
    rating_automated?: number;
    rating_community?: number;
    rating_updated_at?: string;
  }): Promise<{ error?: { message: string } }>;
  getDeployCountForWalletToday(wallet: string): Promise<number>;
}

export interface DeployerRatingRow {
  rater_wallet: string;
  deployer_wallet: string;
  score: number;
  created_at: string;
}

export interface DbDeployerRatings {
  upsertDeployerRating(params: { rater_wallet: string; deployer_wallet: string; score: number }): Promise<{ error?: { message: string } }>;
  getRatingsForDeployer(deployer_wallet: string): Promise<DeployerRatingRow[]>;
}

/** Platform requirements for bagwork (account age, followers, views, allowed communities). */
export interface CampaignPlatformRequirements {
  min_account_age_days?: number;
  min_followers?: number;
  min_raw_views?: number;
  allowed_communities?: string[];
}

export interface CampaignRow {
  id: string;
  token_mint: string;
  creator_wallet: string;
  title: string;
  description: string | null;
  reward_mint: string;
  reward_amount_raw: string;
  holder_requirement_raw: string | null;
  holder_requirement_mint: string | null;
  tracking_window_days: number;
  starts_at: string;
  ends_at: string;
  status: "draft" | "active" | "ended";
  funded_lamports: number;
  funding_tx_sig: string | null;
  escrow_public_key: string | null;
  created_at: string;
  updated_at: string;
  content_guidelines: string | null;
  platform_requirements: CampaignPlatformRequirements | null;
  content_requirements: string | null;
  rate_per_1k_lamports: number | null;
  max_payout_lamports: number | null;
}

export interface CampaignSubmissionRow {
  id: string;
  campaign_id: string;
  submitter_wallet: string;
  content_url: string;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  amount_awarded_lamports: number;
  payout_tx_sig: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  /** Payout views (views*): adjusted for engagement/quality, used in Payment = (payout_views/1000)*rate, capped at max. */
  payout_views: number | null;
}

export interface DbCampaigns {
  createCampaign(params: {
    token_mint: string;
    creator_wallet: string;
    title: string;
    description?: string | null;
    reward_mint: string;
    reward_amount_raw: string;
    holder_requirement_raw?: string | null;
    holder_requirement_mint?: string | null;
    tracking_window_days: number;
    starts_at: string;
    ends_at: string;
    escrow_public_key: string;
    content_guidelines?: string | null;
    platform_requirements?: CampaignPlatformRequirements | null;
    content_requirements?: string | null;
    rate_per_1k_lamports?: number | null;
    max_payout_lamports?: number | null;
  }): Promise<{ id: string } | { error: { message: string } }>;
  updateCampaignGuidelines(id: string, params: { content_guidelines?: string | null; platform_requirements?: CampaignPlatformRequirements | null; content_requirements?: string | null; rate_per_1k_lamports?: number | null; max_payout_lamports?: number | null }): Promise<{ error?: { message: string } }>;
  getCampaign(id: string): Promise<CampaignRow | null>;
  getCampaignsByToken(token_mint: string): Promise<CampaignRow[]>;
  getCampaignsByCreator(creator_wallet: string): Promise<CampaignRow[]>;
  getActiveCampaigns(limit?: number): Promise<CampaignRow[]>;
  updateCampaignFunding(id: string, funded_lamports: number, funding_tx_sig: string): Promise<{ error?: { message: string } }>;
  updateCampaignStatus(id: string, status: "draft" | "active" | "ended"): Promise<{ error?: { message: string } }>;
}

export interface DbCampaignEscrowKeys {
  setCampaignEscrowSecret(campaign_id: string, secret_key_base64: string): Promise<{ error?: { message: string } }>;
  getCampaignEscrowSecret(campaign_id: string): Promise<string | null>;
}

export interface DbCampaignSubmissions {
  createSubmission(params: { campaign_id: string; submitter_wallet: string; content_url: string; description?: string | null }): Promise<{ id: string } | { error: { message: string } }>;
  getSubmission(id: string): Promise<CampaignSubmissionRow | null>;
  getSubmissionsByCampaign(campaign_id: string): Promise<CampaignSubmissionRow[]>;
  updateSubmissionStatus(id: string, status: "pending" | "approved" | "rejected", amount_awarded_lamports: number, reviewed_by: string, payout_views?: number | null): Promise<{ error?: { message: string } }>;
  setSubmissionPayout(id: string, payout_tx_sig: string): Promise<{ error?: { message: string } }>;
  getApprovedUnpaidSubmissions(campaign_id: string): Promise<CampaignSubmissionRow[]>;
}

export interface Db extends DbUsedImages, DbTrackedTokens, DbTokenCreators, DbRewardLoops, DbDeployerProfiles, DbDeployerRatings, DbCampaigns, DbCampaignSubmissions, DbCampaignEscrowKeys, DbBagworkerOauthState, DbBagworkerProfiles, DbBagworkerTweets, DbBagworkerPeriods, DbBagworkerEngagement, DbBagworkerClaims, DbDetectedTweets, DbInactiveTokens, DbCtoClaims {}

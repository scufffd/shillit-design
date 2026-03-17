/**
 * Supabase implementation of Db. Use when NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set (live).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Db, DistributionSplitDb, DeployerProfileRow, CampaignRow, CampaignSubmissionRow, CampaignPlatformRequirements, CtoClaimRow, CtoClaimStatus } from "./types";

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export function createSupabaseDb(): Db {
  return {
    async insertUsedImage({ hash_sha256, mint }) {
      const { error } = await getClient().from("used_images").insert({ hash_sha256, mint, registered_at: new Date().toISOString() });
      if (error) return { error: { code: error.code ?? "500", message: error.message } };
      return {};
    },
    async getUsedImageByHash(hash) {
      const { data } = await getClient().from("used_images").select("id").eq("hash_sha256", hash).maybeSingle();
      return data ? { id: data.id } : null;
    },

    async upsertTrackedToken({ token_mint, search_query }) {
      const { error } = await getClient().from("tracked_tokens").upsert({ token_mint, search_query }, { onConflict: "token_mint" });
      return error ? { error: { message: error.message } } : {};
    },
    async getTrackedTokens() {
      const { data } = await getClient().from("tracked_tokens").select("token_mint, search_query");
      return (data ?? []) as { token_mint: string; search_query: string }[];
    },

    async upsertTokenCreator({ token_mint, creator_wallet, deployer_rating_at_launch }) {
      const payload: Record<string, unknown> = { token_mint, creator_wallet };
      if (deployer_rating_at_launch !== undefined) payload.deployer_rating_at_launch = deployer_rating_at_launch;
      const { error } = await getClient().from("token_creators").upsert(payload, { onConflict: "token_mint" });
      return error ? { error: { message: error.message } } : {};
    },
    async getTokenCreatorWithRating(token_mint: string) {
      const { data } = await getClient()
        .from("token_creators")
        .select("creator_wallet, deployer_rating_at_launch")
        .eq("token_mint", token_mint)
        .maybeSingle();
      if (!data) return null;
      return {
        creator_wallet: data.creator_wallet,
        deployer_rating_at_launch: data.deployer_rating_at_launch != null ? Number(data.deployer_rating_at_launch) : null,
      };
    },
    async getTokensByCreator(creator_wallet: string) {
      const { data: creatorTokens } = await getClient().from("token_creators").select("token_mint").eq("creator_wallet", creator_wallet);
      const mints = (creatorTokens ?? []).map((r: { token_mint: string }) => r.token_mint);
      if (mints.length === 0) return [];
      const { data: tokens } = await getClient().from("tracked_tokens").select("token_mint, search_query").in("token_mint", mints);
      return (tokens ?? []) as { token_mint: string; search_query: string }[];
    },
    async getCreatorByToken(token_mint: string) {
      const { data } = await getClient().from("token_creators").select("creator_wallet").eq("token_mint", token_mint).maybeSingle();
      return data?.creator_wallet ?? null;
    },

    async getDeployerProfile(wallet: string) {
      const { data } = await getClient()
        .from("deployer_profiles")
        .select("wallet, created_at, paid_at, profile_fee_lamports, display_name, bio, avatar_url, rating_score, rating_automated, rating_community, rating_updated_at")
        .eq("wallet", wallet)
        .maybeSingle();
      if (!data) return null;
      return {
        wallet: data.wallet,
        created_at: data.created_at,
        paid_at: data.paid_at ?? null,
        profile_fee_lamports: data.profile_fee_lamports ?? 0,
        display_name: data.display_name ?? null,
        bio: data.bio ?? null,
        avatar_url: data.avatar_url ?? null,
        rating_score: Number(data.rating_score ?? 50),
        rating_automated: Number(data.rating_automated ?? 50),
        rating_community: Number(data.rating_community ?? 50),
        rating_updated_at: data.rating_updated_at,
      } as DeployerProfileRow;
    },
    async upsertDeployerProfile(params: {
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
    }) {
      const now = new Date().toISOString();
      const { data: existing } = await getClient().from("deployer_profiles").select("wallet").eq("wallet", params.wallet).maybeSingle();
      const payload: Record<string, unknown> = { wallet: params.wallet };
      if (params.paid_at !== undefined) payload.paid_at = params.paid_at;
      if (params.profile_fee_lamports !== undefined) payload.profile_fee_lamports = params.profile_fee_lamports;
      if (params.display_name !== undefined) payload.display_name = params.display_name;
      if (params.bio !== undefined) payload.bio = params.bio;
      if (params.avatar_url !== undefined) payload.avatar_url = params.avatar_url;
      if (params.rating_score !== undefined) payload.rating_score = params.rating_score;
      if (params.rating_automated !== undefined) payload.rating_automated = params.rating_automated;
      if (params.rating_community !== undefined) payload.rating_community = params.rating_community;
      if (params.rating_updated_at !== undefined) payload.rating_updated_at = params.rating_updated_at;
      if (!existing) {
        payload.created_at = now;
        payload.paid_at = params.paid_at ?? null;
        payload.profile_fee_lamports = params.profile_fee_lamports ?? 0;
        payload.display_name = params.display_name ?? null;
        payload.bio = params.bio ?? null;
        payload.avatar_url = params.avatar_url ?? null;
        payload.rating_score = params.rating_score ?? 50;
        payload.rating_automated = params.rating_automated ?? 50;
        payload.rating_community = params.rating_community ?? 50;
        payload.rating_updated_at = params.rating_updated_at ?? now;
      }
      const { error } = await getClient().from("deployer_profiles").upsert(payload, { onConflict: "wallet" });
      return error ? { error: { message: error.message } } : {};
    },
    async getDeployCountForWalletToday(wallet: string) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
      const startStr = startOfDay.toISOString();
      const endStr = endOfDay.toISOString();
      const { count, error } = await getClient()
        .from("token_creators")
        .select("token_mint", { count: "exact", head: true })
        .eq("creator_wallet", wallet)
        .gte("created_at", startStr)
        .lt("created_at", endStr);
      if (error) return 0;
      return count ?? 0;
    },
    async getTopDeployers(limit: number) {
      const n = Math.max(1, Math.min(100, limit));
      const { data } = await getClient()
        .from("deployer_profiles")
        .select("wallet, created_at, paid_at, profile_fee_lamports, display_name, bio, avatar_url, rating_score, rating_automated, rating_community, rating_updated_at")
        .not("paid_at", "is", null)
        .order("rating_score", { ascending: false })
        .order("rating_updated_at", { ascending: false })
        .limit(n);
      return (data ?? []) as DeployerProfileRow[];
    },

    async upsertDeployerRating(params: { rater_wallet: string; deployer_wallet: string; score: number }) {
      const score = Math.min(100, Math.max(0, params.score));
      const { error } = await getClient()
        .from("deployer_ratings")
        .upsert(
          { rater_wallet: params.rater_wallet, deployer_wallet: params.deployer_wallet, score },
          { onConflict: "rater_wallet,deployer_wallet" }
        );
      return error ? { error: { message: error.message } } : {};
    },
    async getRatingsForDeployer(deployer_wallet: string) {
      const { data } = await getClient()
        .from("deployer_ratings")
        .select("rater_wallet, deployer_wallet, score, created_at")
        .eq("deployer_wallet", deployer_wallet);
      return (data ?? []) as { rater_wallet: string; deployer_wallet: string; score: number; created_at: string }[];
    },

    async createCampaign(params: {
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
    }) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const { error } = await getClient()
        .from("campaigns")
        .insert({
          id,
          token_mint: params.token_mint,
          creator_wallet: params.creator_wallet,
          title: params.title,
          description: params.description ?? null,
          reward_mint: params.reward_mint,
          reward_amount_raw: params.reward_amount_raw,
          holder_requirement_raw: params.holder_requirement_raw ?? null,
          holder_requirement_mint: params.holder_requirement_mint ?? null,
          tracking_window_days: params.tracking_window_days ?? 7,
          starts_at: params.starts_at,
          ends_at: params.ends_at,
          status: "draft",
          escrow_public_key: params.escrow_public_key,
          updated_at: now,
          content_guidelines: params.content_guidelines ?? null,
          platform_requirements: params.platform_requirements != null ? JSON.stringify(params.platform_requirements) : null,
          content_requirements: params.content_requirements ?? null,
          rate_per_1k_lamports: params.rate_per_1k_lamports ?? null,
          max_payout_lamports: params.max_payout_lamports ?? null,
        });
      if (error) return { error: { message: error.message } };
      return { id };
    },
    async updateCampaignGuidelines(
      id: string,
      params: {
        content_guidelines?: string | null;
        platform_requirements?: CampaignPlatformRequirements | null;
        content_requirements?: string | null;
        rate_per_1k_lamports?: number | null;
        max_payout_lamports?: number | null;
      }
    ) {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (params.content_guidelines !== undefined) payload.content_guidelines = params.content_guidelines;
      if (params.platform_requirements !== undefined) payload.platform_requirements = params.platform_requirements != null ? JSON.stringify(params.platform_requirements) : null;
      if (params.content_requirements !== undefined) payload.content_requirements = params.content_requirements;
      if (params.rate_per_1k_lamports !== undefined) payload.rate_per_1k_lamports = params.rate_per_1k_lamports;
      if (params.max_payout_lamports !== undefined) payload.max_payout_lamports = params.max_payout_lamports;
      const { error } = await getClient().from("campaigns").update(payload).eq("id", id);
      return error ? { error: { message: error.message } } : {};
    },
    async getCampaign(id: string) {
      const { data } = await getClient().from("campaigns").select("*").eq("id", id).maybeSingle();
      if (!data) return null;
      const row = data as CampaignRow & { platform_requirements?: string | null };
      const platform_requirements =
        row.platform_requirements != null && typeof row.platform_requirements === "string"
          ? (JSON.parse(row.platform_requirements) as CampaignPlatformRequirements)
          : null;
      return { ...row, platform_requirements } as CampaignRow;
    },
    async getCampaignsByToken(token_mint: string) {
      const { data } = await getClient().from("campaigns").select("*").eq("token_mint", token_mint).order("created_at", { ascending: false });
      return (data ?? []).map((r: CampaignRow & { platform_requirements?: string | null }) => ({
        ...r,
        platform_requirements: r.platform_requirements != null && typeof r.platform_requirements === "string" ? (JSON.parse(r.platform_requirements) as CampaignPlatformRequirements) : null,
      })) as CampaignRow[];
    },
    async getCampaignsByCreator(creator_wallet: string) {
      const { data } = await getClient().from("campaigns").select("*").eq("creator_wallet", creator_wallet).order("created_at", { ascending: false });
      return (data ?? []).map((r: CampaignRow & { platform_requirements?: string | null }) => ({
        ...r,
        platform_requirements: r.platform_requirements != null && typeof r.platform_requirements === "string" ? (JSON.parse(r.platform_requirements) as CampaignPlatformRequirements) : null,
      })) as CampaignRow[];
    },
    async getActiveCampaigns(limit = 50) {
      const now = new Date().toISOString();
      const { data } = await getClient()
        .from("campaigns")
        .select("*")
        .eq("status", "active")
        .lte("starts_at", now)
        .gte("ends_at", now)
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []).map((r: CampaignRow & { platform_requirements?: string | null }) => ({
        ...r,
        platform_requirements: r.platform_requirements != null && typeof r.platform_requirements === "string" ? (JSON.parse(r.platform_requirements) as CampaignPlatformRequirements) : null,
      })) as CampaignRow[];
    },
    async updateCampaignFunding(id: string, funded_lamports: number, funding_tx_sig: string) {
      const now = new Date().toISOString();
      const { error } = await getClient()
        .from("campaigns")
        .update({ funded_lamports, funding_tx_sig, status: "active", updated_at: now })
        .eq("id", id);
      return error ? { error: { message: error.message } } : {};
    },
    async updateCampaignStatus(id: string, status: "draft" | "active" | "ended") {
      const now = new Date().toISOString();
      const { error } = await getClient().from("campaigns").update({ status, updated_at: now }).eq("id", id);
      return error ? { error: { message: error.message } } : {};
    },

    async setCampaignEscrowSecret(campaign_id: string, secret_key_base64: string) {
      const now = new Date().toISOString();
      const { error } = await getClient()
        .from("campaign_escrow_keys")
        .upsert({ campaign_id, secret_key_base64, created_at: now }, { onConflict: "campaign_id" });
      return error ? { error: { message: error.message } } : {};
    },
    async getCampaignEscrowSecret(campaign_id: string) {
      const { data } = await getClient()
        .from("campaign_escrow_keys")
        .select("secret_key_base64")
        .eq("campaign_id", campaign_id)
        .maybeSingle();
      return data?.secret_key_base64 ?? null;
    },

    async createSubmission(params: { campaign_id: string; submitter_wallet: string; content_url: string; description?: string | null }) {
      const id = crypto.randomUUID();
      const { error } = await getClient().from("campaign_submissions").insert({
        id,
        campaign_id: params.campaign_id,
        submitter_wallet: params.submitter_wallet,
        content_url: params.content_url,
        description: params.description ?? null,
      });
      if (error) return { error: { message: error.message } };
      return { id };
    },
    async getSubmission(id: string) {
      const { data } = await getClient().from("campaign_submissions").select("*").eq("id", id).maybeSingle();
      return (data as CampaignSubmissionRow | null) ?? null;
    },
    async getSubmissionsByCampaign(campaign_id: string) {
      const { data } = await getClient().from("campaign_submissions").select("*").eq("campaign_id", campaign_id).order("created_at", { ascending: false });
      return (data ?? []) as CampaignSubmissionRow[];
    },
    async updateSubmissionStatus(
      id: string,
      status: "pending" | "approved" | "rejected",
      amount_awarded_lamports: number,
      reviewed_by: string,
      payout_views?: number | null
    ) {
      const now = new Date().toISOString();
      const payload: Record<string, unknown> = { status, amount_awarded_lamports, reviewed_at: now, reviewed_by };
      if (payout_views !== undefined) payload.payout_views = payout_views;
      const { error } = await getClient().from("campaign_submissions").update(payload).eq("id", id);
      return error ? { error: { message: error.message } } : {};
    },
    async setSubmissionPayout(id: string, payout_tx_sig: string) {
      const { error } = await getClient().from("campaign_submissions").update({ payout_tx_sig }).eq("id", id);
      return error ? { error: { message: error.message } } : {};
    },
    async getApprovedUnpaidSubmissions(campaign_id: string) {
      const { data } = await getClient()
        .from("campaign_submissions")
        .select("*")
        .eq("campaign_id", campaign_id)
        .eq("status", "approved");
      const rows = (data ?? []) as CampaignSubmissionRow[];
      return rows.filter((r) => r.payout_tx_sig == null || r.payout_tx_sig === "");
    },

    async getRewardLoop(token_mint: string) {
      const { data } = await getClient()
        .from("reward_loops")
        .select("token_mint, interval_sec, distribution_split, enabled, next_run_at, updated_at")
        .eq("token_mint", token_mint)
        .maybeSingle();
      if (!data) return null;
      let distribution_split: DistributionSplitDb | null = null;
      if (data.distribution_split != null && typeof data.distribution_split === "string") {
        try {
          distribution_split = JSON.parse(data.distribution_split) as DistributionSplitDb;
        } catch {
          /* ignore */
        }
      }
      return {
        token_mint: data.token_mint,
        interval_sec: data.interval_sec ?? 300,
        distribution_split,
        enabled: Boolean(data.enabled),
        next_run_at: data.next_run_at ?? null,
        updated_at: data.updated_at,
      };
    },
    async upsertRewardLoop(params: {
      token_mint: string;
      interval_sec?: number;
      distribution_split?: DistributionSplitDb | null;
      enabled?: boolean;
      next_run_at?: string | null;
    }) {
      const now = new Date().toISOString();
      const { data: existing } = await getClient().from("reward_loops").select("token_mint").eq("token_mint", params.token_mint).maybeSingle();
      const payload: Record<string, unknown> = {
        token_mint: params.token_mint,
        updated_at: now,
      };
      if (params.interval_sec !== undefined) payload.interval_sec = params.interval_sec;
      if (params.distribution_split !== undefined) payload.distribution_split = params.distribution_split == null ? null : JSON.stringify(params.distribution_split);
      if (params.enabled !== undefined) payload.enabled = params.enabled ? 1 : 0;
      if (params.next_run_at !== undefined) payload.next_run_at = params.next_run_at;
      if (!existing) {
        payload.interval_sec = params.interval_sec ?? 300;
        payload.distribution_split = params.distribution_split == null ? null : JSON.stringify(params.distribution_split);
        payload.enabled = (params.enabled ?? false) ? 1 : 0;
        payload.next_run_at = params.next_run_at ?? null;
      }
      const { error } = await getClient().from("reward_loops").upsert(payload, { onConflict: "token_mint" });
      return error ? { error: { message: error.message } } : {};
    },
    async getEnabledRewardLoops() {
      const { data } = await getClient().from("reward_loops").select("token_mint, interval_sec, distribution_split, next_run_at").eq("enabled", 1);
      return (data ?? []).map((r: { token_mint: string; interval_sec: number; distribution_split: string | null; next_run_at: string | null }) => ({
        token_mint: r.token_mint,
        interval_sec: r.interval_sec ?? 300,
        distribution_split: r.distribution_split ? (JSON.parse(r.distribution_split) as DistributionSplitDb) : null,
        next_run_at: r.next_run_at,
      }));
    },

    async upsertOauthState({ state, wallet, code_verifier }) {
      await getClient().from("bagworker_oauth_state").upsert({ state, wallet, code_verifier, created_at: new Date().toISOString() }, { onConflict: "state" });
    },
    async getOauthState(state) {
      const { data } = await getClient().from("bagworker_oauth_state").select("wallet, code_verifier").eq("state", state).single();
      return data ? { wallet: data.wallet, code_verifier: data.code_verifier } : null;
    },
    async deleteOauthState(state) {
      await getClient().from("bagworker_oauth_state").delete().eq("state", state);
    },

    async upsertProfile(params) {
      await getClient()
        .from("bagworker_profiles")
        .upsert(
          {
            wallet: params.wallet,
            x_user_id: params.x_user_id,
            x_username: params.x_username,
            x_access_token_encrypted: params.x_access_token_encrypted ?? null,
            x_refresh_token_encrypted: params.x_refresh_token_encrypted ?? null,
            x_token_expires_at: params.x_token_expires_at ?? null,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "wallet" }
        );
    },
    async getProfileByWallet(wallet) {
      const { data } = await getClient().from("bagworker_profiles").select("wallet, x_user_id, x_access_token_encrypted").eq("wallet", wallet).single();
      return data ? { wallet: data.wallet, x_user_id: data.x_user_id, x_access_token_encrypted: data.x_access_token_encrypted } : null;
    },
    async getAllProfiles() {
      const { data } = await getClient().from("bagworker_profiles").select("wallet, x_user_id, x_access_token_encrypted");
      return (data ?? []) as { wallet: string; x_user_id: string; x_access_token_encrypted?: string }[];
    },

    async upsertTweet({ wallet, token_mint, tweet_id, tweet_url, status = "pending" }) {
      const { error } = await getClient()
        .from("bagworker_tweets")
        .upsert({ wallet, token_mint, tweet_id, tweet_url: tweet_url ?? null, status }, { onConflict: "wallet,token_mint,tweet_id" });
      return error ? { error: { message: error.message } } : {};
    },
    async getApprovedTweets() {
      const { data } = await getClient().from("bagworker_tweets").select("wallet, token_mint, tweet_id").eq("status", "approved");
      return (data ?? []) as { wallet: string; token_mint: string; tweet_id: string }[];
    },

    async getPeriodByKey(period_key) {
      const { data } = await getClient().from("bagworker_periods").select("id").eq("period_key", period_key).single();
      return data ? { id: data.id } : null;
    },
    async getLatestPeriod() {
      const { data } = await getClient().from("bagworker_periods").select("id, period_key").order("ended_at", { ascending: false }).limit(1).single();
      return data ? { id: data.id, period_key: data.period_key } : null;
    },

    async upsertEngagement(params) {
      await getClient()
        .from("bagworker_engagement")
        .upsert(
          {
            period_id: params.period_id,
            wallet: params.wallet,
            token_mint: params.token_mint,
            impressions: params.impressions,
            likes: params.likes,
            retweets: params.retweets,
            replies: params.replies,
            raw_score: params.raw_score,
            share_pct: params.share_pct,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "period_id,wallet,token_mint" }
        );
    },
    async getEngagement(period_id, wallet, token_mint) {
      const { data } = await getClient()
        .from("bagworker_engagement")
        .select("share_pct, impressions, likes, retweets, replies")
        .eq("period_id", period_id)
        .eq("wallet", wallet)
        .eq("token_mint", token_mint)
        .single();
      return data ? { share_pct: data.share_pct, impressions: data.impressions, likes: data.likes, retweets: data.retweets, replies: data.replies } : null;
    },
    async getEngagementsByWallet(wallet) {
      const { data } = await getClient().from("bagworker_engagement").select("period_id, token_mint, share_pct").eq("wallet", wallet).gt("share_pct", 0);
      return (data ?? []) as { period_id: string; token_mint: string; share_pct: number }[];
    },

    async insertClaim(params) {
      const { error } = await getClient().from("bagworker_claims").insert({
        wallet: params.wallet,
        token_mint: params.token_mint,
        period_id: params.period_id,
        amount_lamports: params.amount_lamports,
        share_pct: params.share_pct,
        tx_signature: params.tx_signature ?? null,
      });
      return error ? { error: { message: error.message } } : {};
    },
    async getClaimsByWallet(wallet) {
      const { data } = await getClient().from("bagworker_claims").select("period_id, token_mint, amount_lamports").eq("wallet", wallet);
      return (data ?? []) as { period_id: string; token_mint: string; amount_lamports: number }[];
    },

    async upsertDetectedTweet(params) {
      await getClient()
        .from("detected_tweets")
        .upsert(
          {
            tweet_id: params.tweet_id,
            token_mint: params.token_mint,
            author_x_user_id: params.author_x_user_id,
            author_username: params.author_username,
            tweet_created_at: params.tweet_created_at ?? null,
          },
          { onConflict: "tweet_id,token_mint" }
        );
    },
    async getAllDetectedTweets() {
      const { data } = await getClient()
        .from("detected_tweets")
        .select("id, tweet_id, token_mint, author_x_user_id, author_username, last_impressions, last_likes, last_retweets, last_replies");
      return (data ?? []) as { id: string; tweet_id: string; token_mint: string; author_x_user_id: string; author_username: string; last_impressions: number; last_likes: number; last_retweets: number; last_replies: number }[];
    },
    async getDetectedTweetsByToken(token_mint) {
      const { data } = await getClient()
        .from("detected_tweets")
        .select("id, tweet_id, author_username, last_likes, last_retweets, last_replies, first_seen_at")
        .eq("token_mint", token_mint)
        .order("first_seen_at", { ascending: false });
      return (data ?? []) as { id: string; tweet_id: string; author_username: string; last_likes: number; last_retweets: number; last_replies: number; first_seen_at: string }[];
    },
    async updateDetectedTweetMetrics(id, params) {
      await getClient()
        .from("detected_tweets")
        .update({
          last_impressions: params.last_impressions,
          last_likes: params.last_likes,
          last_retweets: params.last_retweets,
          last_replies: params.last_replies,
          last_metrics_at: params.last_metrics_at,
        })
        .eq("id", id);
    },

    async getByMint(mint) {
      const { data } = await getClient().from("inactive_tokens").select("mint, cto_eligible").eq("mint", mint).eq("cto_eligible", true).maybeSingle();
      return data ? { mint: data.mint, cto_eligible: data.cto_eligible } : null;
    },

    async insertCtoClaim(params) {
      const { error } = await getClient().from("cto_claims").insert({
        mint: params.mint,
        new_authority: params.new_authority,
        proposal_uri: params.proposal_uri ?? null,
        tx_signature: params.tx_signature ?? null,
        status: "pending",
      });
      return error ? { error: { message: error.message } } : {};
    },
    async getCtoClaims(status?: CtoClaimStatus) {
      let q = getClient().from("cto_claims").select("id, mint, new_authority, proposal_uri, tx_signature, claimed_at, status, fee_lamports, fee_tx_sig").order("claimed_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data } = await q;
      return (data ?? []).map((r) => ({
        ...r,
        status: (r.status ?? "pending") as CtoClaimStatus,
        fee_lamports: r.fee_lamports ?? null,
        fee_tx_sig: r.fee_tx_sig ?? null,
      })) as CtoClaimRow[];
    },
    async updateCtoClaimStatus(id: string, params: { status?: CtoClaimStatus; fee_lamports?: number | null; fee_tx_sig?: string | null }) {
      const payload: Record<string, unknown> = {};
      if (params.status !== undefined) payload.status = params.status;
      if (params.fee_lamports !== undefined) payload.fee_lamports = params.fee_lamports;
      if (params.fee_tx_sig !== undefined) payload.fee_tx_sig = params.fee_tx_sig;
      if (Object.keys(payload).length === 0) return {};
      const { error } = await getClient().from("cto_claims").update(payload).eq("id", id);
      return error ? { error: { message: error.message } } : {};
    },
  };
}

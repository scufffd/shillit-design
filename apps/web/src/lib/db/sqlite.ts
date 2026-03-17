/**
 * SQLite implementation of Db. Use when NEXT_PUBLIC_SUPABASE_URL is not set.
 * DB file: DATABASE_PATH or ./.data/shillit.db
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { Db } from "./types";

const dbPath = process.env.DATABASE_PATH || join(process.cwd(), ".data", "shillit.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS used_images (id TEXT PRIMARY KEY, hash_sha256 TEXT NOT NULL UNIQUE, mint TEXT NOT NULL, registered_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_used_images_hash ON used_images (hash_sha256);
CREATE INDEX IF NOT EXISTS idx_used_images_mint ON used_images (mint);
CREATE TABLE IF NOT EXISTS tracked_tokens (id TEXT PRIMARY KEY, token_mint TEXT NOT NULL UNIQUE, search_query TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS token_creators (token_mint TEXT PRIMARY KEY, creator_wallet TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_token_creators_creator ON token_creators (creator_wallet);
CREATE INDEX IF NOT EXISTS idx_token_creators_creator_created ON token_creators (creator_wallet, created_at);
CREATE TABLE IF NOT EXISTS deployer_profiles (wallet TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')), paid_at TEXT, profile_fee_lamports INTEGER NOT NULL DEFAULT 0, display_name TEXT, bio TEXT, avatar_url TEXT, rating_score REAL NOT NULL DEFAULT 50, rating_automated REAL NOT NULL DEFAULT 50, rating_community REAL NOT NULL DEFAULT 50, rating_updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS deployer_ratings (id TEXT PRIMARY KEY, rater_wallet TEXT NOT NULL, deployer_wallet TEXT NOT NULL, score INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(rater_wallet, deployer_wallet));
CREATE INDEX IF NOT EXISTS idx_deployer_ratings_deployer ON deployer_ratings (deployer_wallet);
CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, token_mint TEXT NOT NULL, creator_wallet TEXT NOT NULL, title TEXT NOT NULL, description TEXT, reward_mint TEXT NOT NULL, reward_amount_raw TEXT NOT NULL, holder_requirement_raw TEXT, holder_requirement_mint TEXT, tracking_window_days INTEGER NOT NULL DEFAULT 7, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', funded_lamports INTEGER NOT NULL DEFAULT 0, funding_tx_sig TEXT, escrow_public_key TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS campaign_escrow_keys (campaign_id TEXT PRIMARY KEY, secret_key_base64 TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (campaign_id) REFERENCES campaigns(id));
CREATE INDEX IF NOT EXISTS idx_campaigns_token ON campaigns (token_mint);
CREATE INDEX IF NOT EXISTS idx_campaigns_creator ON campaigns (creator_wallet);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status);
CREATE TABLE IF NOT EXISTS campaign_submissions (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, submitter_wallet TEXT NOT NULL, content_url TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'pending', amount_awarded_lamports INTEGER NOT NULL DEFAULT 0, payout_tx_sig TEXT, reviewed_at TEXT, reviewed_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (campaign_id) REFERENCES campaigns(id));
CREATE INDEX IF NOT EXISTS idx_campaign_submissions_campaign ON campaign_submissions (campaign_id);
CREATE TABLE IF NOT EXISTS reward_loops (token_mint TEXT PRIMARY KEY, interval_sec INTEGER NOT NULL DEFAULT 300, distribution_split TEXT, enabled INTEGER NOT NULL DEFAULT 0, next_run_at TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS bagworker_oauth_state (state TEXT PRIMARY KEY, wallet TEXT NOT NULL, code_verifier TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS bagworker_profiles (id TEXT PRIMARY KEY, wallet TEXT NOT NULL UNIQUE, x_user_id TEXT NOT NULL UNIQUE, x_username TEXT NOT NULL, x_access_token_encrypted TEXT, x_refresh_token_encrypted TEXT, x_token_expires_at TEXT, verified_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_bagworker_profiles_wallet ON bagworker_profiles (wallet);
CREATE INDEX IF NOT EXISTS idx_bagworker_profiles_x_user_id ON bagworker_profiles (x_user_id);
CREATE TABLE IF NOT EXISTS bagworker_tweets (id TEXT PRIMARY KEY, wallet TEXT NOT NULL, token_mint TEXT NOT NULL, tweet_id TEXT NOT NULL, tweet_url TEXT, status TEXT NOT NULL DEFAULT 'pending', submitted_at TEXT NOT NULL DEFAULT (datetime('now')), reviewed_at TEXT, UNIQUE (wallet, token_mint, tweet_id));
CREATE INDEX IF NOT EXISTS idx_bagworker_tweets_wallet ON bagworker_tweets (wallet);
CREATE INDEX IF NOT EXISTS idx_bagworker_tweets_token ON bagworker_tweets (token_mint);
CREATE TABLE IF NOT EXISTS bagworker_periods (id TEXT PRIMARY KEY, period_key TEXT NOT NULL UNIQUE, started_at TEXT NOT NULL, ended_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS bagworker_engagement (id TEXT PRIMARY KEY, period_id TEXT NOT NULL, wallet TEXT NOT NULL, token_mint TEXT NOT NULL, impressions INTEGER NOT NULL DEFAULT 0, likes INTEGER NOT NULL DEFAULT 0, retweets INTEGER NOT NULL DEFAULT 0, replies INTEGER NOT NULL DEFAULT 0, raw_score REAL NOT NULL DEFAULT 0, share_pct REAL NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (period_id, wallet, token_mint));
CREATE INDEX IF NOT EXISTS idx_bagworker_engagement_period ON bagworker_engagement (period_id);
CREATE INDEX IF NOT EXISTS idx_bagworker_engagement_wallet ON bagworker_engagement (wallet);
CREATE TABLE IF NOT EXISTS bagworker_claims (id TEXT PRIMARY KEY, wallet TEXT NOT NULL, token_mint TEXT NOT NULL, period_id TEXT, amount_lamports REAL NOT NULL, share_pct REAL NOT NULL, tx_signature TEXT, claimed_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_bagworker_claims_wallet ON bagworker_claims (wallet);
CREATE TABLE IF NOT EXISTS detected_tweets (id TEXT PRIMARY KEY, tweet_id TEXT NOT NULL, token_mint TEXT NOT NULL, author_x_user_id TEXT NOT NULL, author_username TEXT NOT NULL, tweet_created_at TEXT, last_impressions INTEGER NOT NULL DEFAULT 0, last_likes INTEGER NOT NULL DEFAULT 0, last_retweets INTEGER NOT NULL DEFAULT 0, last_replies INTEGER NOT NULL DEFAULT 0, last_metrics_at TEXT, first_seen_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (tweet_id, token_mint));
CREATE INDEX IF NOT EXISTS idx_detected_tweets_token ON detected_tweets (token_mint);
CREATE INDEX IF NOT EXISTS idx_detected_tweets_author ON detected_tweets (author_x_user_id);
CREATE TABLE IF NOT EXISTS inactive_tokens (id TEXT PRIMARY KEY, mint TEXT NOT NULL UNIQUE, last_trade_at TEXT, market_cap_usd REAL, cto_eligible INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_inactive_tokens_mint ON inactive_tokens (mint);
CREATE TABLE IF NOT EXISTS cto_claims (id TEXT PRIMARY KEY, mint TEXT NOT NULL, new_authority TEXT NOT NULL, proposal_uri TEXT, tx_signature TEXT, claimed_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_cto_claims_mint ON cto_claims (mint);
`;

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const dir = join(process.cwd(), ".data");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    _db = new Database(dbPath);
    _db.exec(SCHEMA);
    try {
      _db.exec("ALTER TABLE deployer_profiles ADD COLUMN rating_automated REAL DEFAULT 50");
    } catch {
      /* column exists */
    }
    try {
      _db.exec("ALTER TABLE deployer_profiles ADD COLUMN rating_community REAL DEFAULT 50");
    } catch {
      /* column exists */
    }
    try {
      _db.exec("ALTER TABLE campaigns ADD COLUMN escrow_public_key TEXT");
    } catch {
      /* column exists */
    }
    try {
      _db.exec("ALTER TABLE cto_claims ADD COLUMN status TEXT DEFAULT 'pending'");
    } catch {
      /* column exists */
    }
    try {
      _db.exec("ALTER TABLE cto_claims ADD COLUMN fee_lamports INTEGER");
    } catch {
      /* column exists */
    }
    try {
      _db.exec("ALTER TABLE cto_claims ADD COLUMN fee_tx_sig TEXT");
    } catch {
      /* column exists */
    }
    try {
      _db.exec("ALTER TABLE campaigns ADD COLUMN content_guidelines TEXT");
    } catch {
      /* column exists */
    }
    try {
      _db.exec("ALTER TABLE campaigns ADD COLUMN platform_requirements TEXT");
    } catch {
      /* column exists */
    }
    try {
      _db.exec("ALTER TABLE token_creators ADD COLUMN deployer_rating_at_launch INTEGER");
    } catch {
      /* column exists */
    }
    try {
      _db.exec("ALTER TABLE campaigns ADD COLUMN content_requirements TEXT");
    } catch {
      /* column exists */
    }
    try {
      _db.exec("ALTER TABLE campaigns ADD COLUMN rate_per_1k_lamports INTEGER");
    } catch {
      /* column exists */
    }
    try {
      _db.exec("ALTER TABLE campaigns ADD COLUMN max_payout_lamports INTEGER");
    } catch {
      /* column exists */
    }
    try {
      _db.exec("ALTER TABLE campaign_submissions ADD COLUMN payout_views INTEGER");
    } catch {
      /* column exists */
    }
  }
  return _db;
}

function uuid() {
  return require("crypto").randomUUID();
}

export const sqliteDb: Db = {
  // used_images
  async insertUsedImage({ hash_sha256, mint }) {
    const db = getDb();
    try {
      db.prepare("INSERT INTO used_images (id, hash_sha256, mint) VALUES (?, ?, ?)").run(uuid(), hash_sha256, mint);
      return {};
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") return { error: { code: "23505", message: "Image already registered" } };
      return { error: { code: "500", message: String(err.message) } };
    }
  },
  async getUsedImageByHash(hash) {
    const row = getDb().prepare("SELECT id FROM used_images WHERE hash_sha256 = ?").get(hash) as { id: string } | undefined;
    return row ? { id: row.id } : null;
  },

  // tracked_tokens
  async upsertTrackedToken({ token_mint, search_query }) {
    const db = getDb();
    db.prepare(
      "INSERT INTO tracked_tokens (id, token_mint, search_query) VALUES (?, ?, ?) ON CONFLICT(token_mint) DO UPDATE SET search_query = excluded.search_query"
    ).run(uuid(), token_mint, search_query);
    return {};
  },
  async getTrackedTokens() {
    const rows = getDb().prepare("SELECT token_mint, search_query FROM tracked_tokens").all() as { token_mint: string; search_query: string }[];
    return rows;
  },

  // token_creators
  async upsertTokenCreator({ token_mint, creator_wallet, deployer_rating_at_launch }) {
    const db = getDb();
    const rating = deployer_rating_at_launch != null ? deployer_rating_at_launch : null;
    const existing = db.prepare("SELECT token_mint FROM token_creators WHERE token_mint = ?").get(token_mint);
    if (existing) {
      if (rating !== undefined) {
        db.prepare("UPDATE token_creators SET creator_wallet = ?, deployer_rating_at_launch = ? WHERE token_mint = ?").run(
          creator_wallet,
          rating,
          token_mint
        );
      } else {
        db.prepare("UPDATE token_creators SET creator_wallet = ? WHERE token_mint = ?").run(creator_wallet, token_mint);
      }
    } else {
      db.prepare(
        "INSERT INTO token_creators (token_mint, creator_wallet, deployer_rating_at_launch) VALUES (?, ?, ?)"
      ).run(token_mint, creator_wallet, rating);
    }
    return {};
  },
  async getTokenCreatorWithRating(token_mint: string) {
    const row = getDb()
      .prepare("SELECT creator_wallet, deployer_rating_at_launch FROM token_creators WHERE token_mint = ?")
      .get(token_mint) as { creator_wallet: string; deployer_rating_at_launch: number | null } | undefined;
    if (!row) return null;
    return {
      creator_wallet: row.creator_wallet,
      deployer_rating_at_launch: row.deployer_rating_at_launch != null ? row.deployer_rating_at_launch : null,
    };
  },
  async getTokensByCreator(creator_wallet: string) {
    const rows = getDb()
      .prepare(
        "SELECT t.token_mint, t.search_query FROM tracked_tokens t INNER JOIN token_creators c ON t.token_mint = c.token_mint WHERE c.creator_wallet = ?"
      )
      .all(creator_wallet) as { token_mint: string; search_query: string }[];
    return rows;
  },
  async getCreatorByToken(token_mint: string) {
    const row = getDb().prepare("SELECT creator_wallet FROM token_creators WHERE token_mint = ?").get(token_mint) as { creator_wallet: string } | undefined;
    return row ? row.creator_wallet : null;
  },

  // deployer_profiles
  async getDeployerProfile(wallet: string) {
    const row = getDb()
      .prepare(
        "SELECT wallet, created_at, paid_at, profile_fee_lamports, display_name, bio, avatar_url, rating_score, rating_automated, rating_community, rating_updated_at FROM deployer_profiles WHERE wallet = ?"
      )
      .get(wallet) as
      | {
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
      | undefined;
    return row ?? null;
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
    const db = getDb();
    const now = new Date().toISOString();
    const existing = db.prepare("SELECT wallet FROM deployer_profiles WHERE wallet = ?").get(params.wallet);
    if (existing) {
      const updates: string[] = [];
      const values: unknown[] = [];
      if (params.paid_at !== undefined) {
        updates.push("paid_at = ?");
        values.push(params.paid_at);
      }
      if (params.profile_fee_lamports !== undefined) {
        updates.push("profile_fee_lamports = ?");
        values.push(params.profile_fee_lamports);
      }
      if (params.display_name !== undefined) {
        updates.push("display_name = ?");
        values.push(params.display_name);
      }
      if (params.bio !== undefined) {
        updates.push("bio = ?");
        values.push(params.bio);
      }
      if (params.avatar_url !== undefined) {
        updates.push("avatar_url = ?");
        values.push(params.avatar_url);
      }
      if (params.rating_score !== undefined) {
        updates.push("rating_score = ?");
        values.push(params.rating_score);
      }
      if (params.rating_automated !== undefined) {
        updates.push("rating_automated = ?");
        values.push(params.rating_automated);
      }
      if (params.rating_community !== undefined) {
        updates.push("rating_community = ?");
        values.push(params.rating_community);
      }
      if (params.rating_updated_at !== undefined) {
        updates.push("rating_updated_at = ?");
        values.push(params.rating_updated_at);
      }
      if (updates.length) {
        values.push(params.wallet);
        db.prepare(`UPDATE deployer_profiles SET ${updates.join(", ")} WHERE wallet = ?`).run(...values);
      }
      return {};
    }
    db.prepare(
      "INSERT INTO deployer_profiles (wallet, created_at, paid_at, profile_fee_lamports, display_name, bio, avatar_url, rating_score, rating_automated, rating_community, rating_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      params.wallet,
      now,
      params.paid_at ?? null,
      params.profile_fee_lamports ?? 0,
      params.display_name ?? null,
      params.bio ?? null,
      params.avatar_url ?? null,
      params.rating_score ?? 50,
      params.rating_automated ?? 50,
      params.rating_community ?? 50,
      params.rating_updated_at ?? now
    );
    return {};
  },

  // deployer_ratings
  async upsertDeployerRating(params: { rater_wallet: string; deployer_wallet: string; score: number }) {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();
    try {
      db.prepare(
        "INSERT INTO deployer_ratings (id, rater_wallet, deployer_wallet, score, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(rater_wallet, deployer_wallet) DO UPDATE SET score = excluded.score"
      ).run(id, params.rater_wallet, params.deployer_wallet, Math.min(100, Math.max(0, params.score)), now);
      return {};
    } catch (e: unknown) {
      const err = e as { message?: string };
      return { error: { message: err.message ?? "Failed to upsert rating" } };
    }
  },
  async getRatingsForDeployer(deployer_wallet: string) {
    const rows = getDb()
      .prepare("SELECT rater_wallet, deployer_wallet, score, created_at FROM deployer_ratings WHERE deployer_wallet = ?")
      .all(deployer_wallet) as { rater_wallet: string; deployer_wallet: string; score: number; created_at: string }[];
    return rows;
  },

  // campaigns
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
    platform_requirements?: import("./types").CampaignPlatformRequirements | null;
    content_requirements?: string | null;
    rate_per_1k_lamports?: number | null;
    max_payout_lamports?: number | null;
  }) {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();
    const platformReq =
      params.platform_requirements != null ? JSON.stringify(params.platform_requirements) : null;
    try {
      db.prepare(
        "INSERT INTO campaigns (id, token_mint, creator_wallet, title, description, reward_mint, reward_amount_raw, holder_requirement_raw, holder_requirement_mint, tracking_window_days, starts_at, ends_at, status, escrow_public_key, content_guidelines, platform_requirements, content_requirements, rate_per_1k_lamports, max_payout_lamports, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        id,
        params.token_mint,
        params.creator_wallet,
        params.title,
        params.description ?? null,
        params.reward_mint,
        params.reward_amount_raw,
        params.holder_requirement_raw ?? null,
        params.holder_requirement_mint ?? null,
        params.tracking_window_days ?? 7,
        params.starts_at,
        params.ends_at,
        params.escrow_public_key,
        params.content_guidelines ?? null,
        platformReq,
        params.content_requirements ?? null,
        params.rate_per_1k_lamports ?? null,
        params.max_payout_lamports ?? null,
        now
      );
      return { id };
    } catch (e: unknown) {
      const err = e as { message?: string };
      return { error: { message: err.message ?? "Failed to create campaign" } };
    }
  },
  async updateCampaignGuidelines(
    id: string,
    params: {
      content_guidelines?: string | null;
      platform_requirements?: import("./types").CampaignPlatformRequirements | null;
      content_requirements?: string | null;
      rate_per_1k_lamports?: number | null;
      max_payout_lamports?: number | null;
    }
  ) {
    const db = getDb();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    if (params.content_guidelines !== undefined) {
      updates.push("content_guidelines = ?");
      values.push(params.content_guidelines);
    }
    if (params.platform_requirements !== undefined) {
      updates.push("platform_requirements = ?");
      values.push(params.platform_requirements != null ? JSON.stringify(params.platform_requirements) : null);
    }
    if (params.content_requirements !== undefined) {
      updates.push("content_requirements = ?");
      values.push(params.content_requirements);
    }
    if (params.rate_per_1k_lamports !== undefined) {
      updates.push("rate_per_1k_lamports = ?");
      values.push(params.rate_per_1k_lamports);
    }
    if (params.max_payout_lamports !== undefined) {
      updates.push("max_payout_lamports = ?");
      values.push(params.max_payout_lamports);
    }
    if (updates.length === 0) return {};
    const now = new Date().toISOString();
    values.push(now, id);
    db.prepare(`UPDATE campaigns SET ${updates.join(", ")}, updated_at = ? WHERE id = ?`).run(...values);
    return {};
  },
  async getCampaign(id: string) {
    const row = getDb()
      .prepare(
        "SELECT id, token_mint, creator_wallet, title, description, reward_mint, reward_amount_raw, holder_requirement_raw, holder_requirement_mint, tracking_window_days, starts_at, ends_at, status, funded_lamports, funding_tx_sig, escrow_public_key, created_at, updated_at, content_guidelines, platform_requirements, content_requirements, rate_per_1k_lamports, max_payout_lamports FROM campaigns WHERE id = ?"
      )
      .get(id) as (Omit<import("./types").CampaignRow, "platform_requirements"> & { platform_requirements: string | null }) | undefined;
    if (!row) return null;
    const pr = row.platform_requirements ? (JSON.parse(row.platform_requirements) as import("./types").CampaignPlatformRequirements) : null;
    return { ...row, platform_requirements: pr } as import("./types").CampaignRow;
  },
  async getCampaignsByToken(token_mint: string) {
    const rows = getDb()
      .prepare(
        "SELECT id, token_mint, creator_wallet, title, description, reward_mint, reward_amount_raw, holder_requirement_raw, holder_requirement_mint, tracking_window_days, starts_at, ends_at, status, funded_lamports, funding_tx_sig, escrow_public_key, created_at, updated_at, content_guidelines, platform_requirements, content_requirements, rate_per_1k_lamports, max_payout_lamports FROM campaigns WHERE token_mint = ? ORDER BY created_at DESC"
      )
      .all(token_mint) as (Omit<import("./types").CampaignRow, "platform_requirements"> & { platform_requirements: string | null })[];
    return rows.map((r) => ({ ...r, platform_requirements: r.platform_requirements ? JSON.parse(r.platform_requirements) : null })) as import("./types").CampaignRow[];
  },
  async getCampaignsByCreator(creator_wallet: string) {
    const rows = getDb()
      .prepare(
        "SELECT id, token_mint, creator_wallet, title, description, reward_mint, reward_amount_raw, holder_requirement_raw, holder_requirement_mint, tracking_window_days, starts_at, ends_at, status, funded_lamports, funding_tx_sig, escrow_public_key, created_at, updated_at, content_guidelines, platform_requirements, content_requirements, rate_per_1k_lamports, max_payout_lamports FROM campaigns WHERE creator_wallet = ? ORDER BY created_at DESC"
      )
      .all(creator_wallet) as (Omit<import("./types").CampaignRow, "platform_requirements"> & { platform_requirements: string | null })[];
    return rows.map((r) => ({ ...r, platform_requirements: r.platform_requirements ? JSON.parse(r.platform_requirements) : null })) as import("./types").CampaignRow[];
  },
  async getActiveCampaigns(limit = 50) {
    const now = new Date().toISOString();
    const rows = getDb()
      .prepare(
        "SELECT id, token_mint, creator_wallet, title, description, reward_mint, reward_amount_raw, holder_requirement_raw, holder_requirement_mint, tracking_window_days, starts_at, ends_at, status, funded_lamports, funding_tx_sig, escrow_public_key, created_at, updated_at, content_guidelines, platform_requirements, content_requirements, rate_per_1k_lamports, max_payout_lamports FROM campaigns WHERE status = 'active' AND starts_at <= ? AND ends_at >= ? ORDER BY created_at DESC LIMIT ?"
      )
      .all(now, now, limit) as (Omit<import("./types").CampaignRow, "platform_requirements"> & { platform_requirements: string | null })[];
    return rows.map((r) => ({ ...r, platform_requirements: r.platform_requirements ? JSON.parse(r.platform_requirements) : null })) as import("./types").CampaignRow[];
  },
  async updateCampaignFunding(id: string, funded_lamports: number, funding_tx_sig: string) {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare("UPDATE campaigns SET funded_lamports = ?, funding_tx_sig = ?, status = 'active', updated_at = ? WHERE id = ?").run(
      funded_lamports,
      funding_tx_sig,
      now,
      id
    );
    return {};
  },
  async updateCampaignStatus(id: string, status: "draft" | "active" | "ended") {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare("UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?").run(status, now, id);
    return {};
  },

  // campaign_escrow_keys (server-only; used by pay and return-funds)
  async setCampaignEscrowSecret(campaign_id: string, secret_key_base64: string) {
    const db = getDb();
    const now = new Date().toISOString();
    try {
      db.prepare(
        "INSERT INTO campaign_escrow_keys (campaign_id, secret_key_base64, created_at) VALUES (?, ?, ?) ON CONFLICT(campaign_id) DO UPDATE SET secret_key_base64 = excluded.secret_key_base64"
      ).run(campaign_id, secret_key_base64, now);
      return {};
    } catch (e: unknown) {
      const err = e as { message?: string };
      return { error: { message: err.message ?? "Failed to store escrow key" } };
    }
  },
  async getCampaignEscrowSecret(campaign_id: string) {
    const row = getDb()
      .prepare("SELECT secret_key_base64 FROM campaign_escrow_keys WHERE campaign_id = ?")
      .get(campaign_id) as { secret_key_base64: string } | undefined;
    return row?.secret_key_base64 ?? null;
  },

  // campaign_submissions
  async createSubmission(params: { campaign_id: string; submitter_wallet: string; content_url: string; description?: string | null }) {
    const db = getDb();
    const id = uuid();
    try {
      db.prepare(
        "INSERT INTO campaign_submissions (id, campaign_id, submitter_wallet, content_url, description) VALUES (?, ?, ?, ?, ?)"
      ).run(id, params.campaign_id, params.submitter_wallet, params.content_url, params.description ?? null);
      return { id };
    } catch (e: unknown) {
      const err = e as { message?: string };
      return { error: { message: err.message ?? "Failed to create submission" } };
    }
  },
  async getSubmission(id: string) {
    const row = getDb()
      .prepare(
        "SELECT id, campaign_id, submitter_wallet, content_url, description, status, amount_awarded_lamports, payout_tx_sig, reviewed_at, reviewed_by, created_at, payout_views FROM campaign_submissions WHERE id = ?"
      )
      .get(id) as import("./types").CampaignSubmissionRow | undefined;
    return row ? { ...row, payout_views: row.payout_views ?? null } : null;
  },
  async getSubmissionsByCampaign(campaign_id: string) {
    const rows = getDb()
      .prepare(
        "SELECT id, campaign_id, submitter_wallet, content_url, description, status, amount_awarded_lamports, payout_tx_sig, reviewed_at, reviewed_by, created_at, payout_views FROM campaign_submissions WHERE campaign_id = ? ORDER BY created_at DESC"
      )
      .all(campaign_id) as import("./types").CampaignSubmissionRow[];
    return rows.map((r) => ({ ...r, payout_views: r.payout_views ?? null }));
  },
  async updateSubmissionStatus(
    id: string,
    status: "pending" | "approved" | "rejected",
    amount_awarded_lamports: number,
    reviewed_by: string,
    payout_views?: number | null
  ) {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE campaign_submissions SET status = ?, amount_awarded_lamports = ?, reviewed_at = ?, reviewed_by = ?, payout_views = ? WHERE id = ?"
    ).run(status, amount_awarded_lamports, now, reviewed_by, payout_views ?? null, id);
    return {};
  },
  async setSubmissionPayout(id: string, payout_tx_sig: string) {
    getDb().prepare("UPDATE campaign_submissions SET payout_tx_sig = ? WHERE id = ?").run(payout_tx_sig, id);
    return {};
  },
  async getApprovedUnpaidSubmissions(campaign_id: string) {
    const rows = getDb()
      .prepare(
        "SELECT id, campaign_id, submitter_wallet, content_url, description, status, amount_awarded_lamports, payout_tx_sig, reviewed_at, reviewed_by, created_at, payout_views FROM campaign_submissions WHERE campaign_id = ? AND status = 'approved' AND (payout_tx_sig IS NULL OR payout_tx_sig = '')"
      )
      .all(campaign_id) as import("./types").CampaignSubmissionRow[];
    return rows.map((r) => ({ ...r, payout_views: r.payout_views ?? null }));
  },

  async getDeployCountForWalletToday(wallet: string) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
    const startStr = startOfDay.toISOString();
    const endStr = endOfDay.toISOString();
    const row = getDb()
      .prepare(
        "SELECT COUNT(*) AS cnt FROM token_creators WHERE creator_wallet = ? AND created_at >= ? AND created_at < ?"
      )
      .get(wallet, startStr, endStr) as { cnt: number };
    return row?.cnt ?? 0;
  },
  async getTopDeployers(limit: number) {
    const n = Math.max(1, Math.min(100, limit));
    const rows = getDb()
      .prepare(
        "SELECT wallet, created_at, paid_at, profile_fee_lamports, display_name, bio, avatar_url, rating_score, rating_automated, rating_community, rating_updated_at FROM deployer_profiles WHERE paid_at IS NOT NULL ORDER BY rating_score DESC, rating_updated_at DESC LIMIT ?"
      )
      .all(n) as import("./types").DeployerProfileRow[];
    return rows;
  },

  // reward_loops
  async getRewardLoop(token_mint: string) {
    const row = getDb()
      .prepare("SELECT token_mint, interval_sec, distribution_split, enabled, next_run_at, updated_at FROM reward_loops WHERE token_mint = ?")
      .get(token_mint) as
      | { token_mint: string; interval_sec: number; distribution_split: string | null; enabled: number; next_run_at: string | null; updated_at: string }
      | undefined;
    if (!row) return null;
    let distribution_split: import("./types").DistributionSplitDb | null = null;
    if (row.distribution_split) {
      try {
        distribution_split = JSON.parse(row.distribution_split) as import("./types").DistributionSplitDb;
      } catch {
        /* ignore */
      }
    }
    return {
      token_mint: row.token_mint,
      interval_sec: row.interval_sec,
      distribution_split,
      enabled: Boolean(row.enabled),
      next_run_at: row.next_run_at,
      updated_at: row.updated_at,
    };
  },
  async upsertRewardLoop(params: {
    token_mint: string;
    interval_sec?: number;
    distribution_split?: import("./types").DistributionSplitDb | null;
    enabled?: boolean;
    next_run_at?: string | null;
  }) {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = db.prepare("SELECT token_mint FROM reward_loops WHERE token_mint = ?").get(params.token_mint) as { token_mint: string } | undefined;
    const interval_sec = params.interval_sec ?? (existing ? undefined : 300);
    const distribution_split = params.distribution_split !== undefined ? JSON.stringify(params.distribution_split) : undefined;
    const enabled = params.enabled !== undefined ? (params.enabled ? 1 : 0) : undefined;
    const next_run_at = params.next_run_at !== undefined ? params.next_run_at : undefined;
    if (existing) {
      const updates: string[] = ["updated_at = ?"];
      const values: unknown[] = [now];
      if (interval_sec !== undefined) {
        updates.push("interval_sec = ?");
        values.push(interval_sec);
      }
      if (distribution_split !== undefined) {
        updates.push("distribution_split = ?");
        values.push(distribution_split);
      }
      if (enabled !== undefined) {
        updates.push("enabled = ?");
        values.push(enabled);
      }
      if (next_run_at !== undefined) {
        updates.push("next_run_at = ?");
        values.push(next_run_at);
      }
      values.push(params.token_mint);
      db.prepare(`UPDATE reward_loops SET ${updates.join(", ")} WHERE token_mint = ?`).run(...values);
    } else {
      db.prepare(
        "INSERT INTO reward_loops (token_mint, interval_sec, distribution_split, enabled, next_run_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(
        params.token_mint,
        interval_sec ?? 300,
        distribution_split ?? null,
        enabled ?? 0,
        next_run_at ?? null,
        now
      );
    }
    return {};
  },
  async getEnabledRewardLoops() {
    const rows = getDb()
      .prepare("SELECT token_mint, interval_sec, distribution_split, next_run_at FROM reward_loops WHERE enabled = 1")
      .all() as {
      token_mint: string;
      interval_sec: number;
      distribution_split: string | null;
      next_run_at: string | null;
    }[];
    return rows.map((r) => ({
      token_mint: r.token_mint,
      interval_sec: r.interval_sec,
      distribution_split: r.distribution_split ? (JSON.parse(r.distribution_split) as import("./types").DistributionSplitDb) : null,
      next_run_at: r.next_run_at,
    }));
  },

  // bagworker_oauth_state
  async upsertOauthState({ state, wallet, code_verifier }) {
    getDb()
      .prepare(
        "INSERT INTO bagworker_oauth_state (state, wallet, code_verifier) VALUES (?, ?, ?) ON CONFLICT(state) DO UPDATE SET wallet = ?, code_verifier = ?"
      )
      .run(state, wallet, code_verifier, wallet, code_verifier);
  },
  async getOauthState(state) {
    const row = getDb().prepare("SELECT wallet, code_verifier FROM bagworker_oauth_state WHERE state = ?").get(state) as { wallet: string; code_verifier: string } | undefined;
    return row ?? null;
  },
  async deleteOauthState(state) {
    getDb().prepare("DELETE FROM bagworker_oauth_state WHERE state = ?").run(state);
  },

  // bagworker_profiles
  async upsertProfile(params) {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO bagworker_profiles (id, wallet, x_user_id, x_username, x_access_token_encrypted, x_refresh_token_encrypted, x_token_expires_at, verified_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(wallet) DO UPDATE SET
         x_user_id = excluded.x_user_id, x_username = excluded.x_username,
         x_access_token_encrypted = excluded.x_access_token_encrypted,
         x_refresh_token_encrypted = excluded.x_refresh_token_encrypted,
         x_token_expires_at = excluded.x_token_expires_at, updated_at = excluded.updated_at`
    ).run(
      uuid(),
      params.wallet,
      params.x_user_id,
      params.x_username,
      params.x_access_token_encrypted ?? null,
      params.x_refresh_token_encrypted ?? null,
      params.x_token_expires_at ?? null,
      now,
      now
    );
  },
  async getProfileByWallet(wallet) {
    const row = getDb()
      .prepare("SELECT wallet, x_user_id, x_access_token_encrypted FROM bagworker_profiles WHERE wallet = ?")
      .get(wallet) as { wallet: string; x_user_id: string; x_access_token_encrypted?: string } | undefined;
    return row ?? null;
  },
  async getAllProfiles() {
    const rows = getDb()
      .prepare("SELECT wallet, x_user_id, x_access_token_encrypted FROM bagworker_profiles")
      .all() as { wallet: string; x_user_id: string; x_access_token_encrypted?: string }[];
    return rows;
  },

  // bagworker_tweets
  async upsertTweet({ wallet, token_mint, tweet_id, tweet_url, status = "pending" }) {
    const db = getDb();
    try {
      db.prepare(
        `INSERT INTO bagworker_tweets (id, wallet, token_mint, tweet_id, tweet_url, status) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(wallet, token_mint, tweet_id) DO UPDATE SET tweet_url = excluded.tweet_url, status = excluded.status`
      ).run(uuid(), wallet, token_mint, tweet_id, tweet_url ?? null, status);
      return {};
    } catch (e: unknown) {
      return { error: { message: String((e as Error).message) } };
    }
  },
  async getApprovedTweets() {
    const rows = getDb()
      .prepare("SELECT wallet, token_mint, tweet_id FROM bagworker_tweets WHERE status = 'approved'")
      .all() as { wallet: string; token_mint: string; tweet_id: string }[];
    return rows;
  },

  // bagworker_periods
  async getPeriodByKey(period_key) {
    const row = getDb().prepare("SELECT id FROM bagworker_periods WHERE period_key = ?").get(period_key) as { id: string } | undefined;
    return row ?? null;
  },
  async getLatestPeriod() {
    const row = getDb()
      .prepare("SELECT id, period_key FROM bagworker_periods ORDER BY ended_at DESC LIMIT 1")
      .get() as { id: string; period_key: string } | undefined;
    return row ?? null;
  },

  // bagworker_engagement
  async upsertEngagement(params) {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO bagworker_engagement (id, period_id, wallet, token_mint, impressions, likes, retweets, replies, raw_score, share_pct, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(period_id, wallet, token_mint) DO UPDATE SET
         impressions = excluded.impressions, likes = excluded.likes, retweets = excluded.retweets, replies = excluded.replies,
         raw_score = excluded.raw_score, share_pct = excluded.share_pct, updated_at = excluded.updated_at`
    ).run(
      uuid(),
      params.period_id,
      params.wallet,
      params.token_mint,
      params.impressions,
      params.likes,
      params.retweets,
      params.replies,
      params.raw_score,
      params.share_pct,
      now
    );
  },
  async getEngagement(period_id, wallet, token_mint) {
    const row = getDb()
      .prepare("SELECT share_pct, impressions, likes, retweets, replies FROM bagworker_engagement WHERE period_id = ? AND wallet = ? AND token_mint = ?")
      .get(period_id, wallet, token_mint) as { share_pct: number; impressions: number; likes: number; retweets: number; replies: number } | undefined;
    return row ?? null;
  },
  async getEngagementsByWallet(wallet) {
    const rows = getDb()
      .prepare("SELECT period_id, token_mint, share_pct FROM bagworker_engagement WHERE wallet = ? AND share_pct > 0")
      .all(wallet) as { period_id: string; token_mint: string; share_pct: number }[];
    return rows;
  },

  // bagworker_claims
  async insertClaim(params) {
    getDb()
      .prepare(
        "INSERT INTO bagworker_claims (id, wallet, token_mint, period_id, amount_lamports, share_pct, tx_signature) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(uuid(), params.wallet, params.token_mint, params.period_id, params.amount_lamports, params.share_pct, params.tx_signature ?? null);
    return {};
  },
  async getClaimsByWallet(wallet) {
    const rows = getDb()
      .prepare("SELECT period_id, token_mint, amount_lamports FROM bagworker_claims WHERE wallet = ?")
      .all(wallet) as { period_id: string; token_mint: string; amount_lamports: number }[];
    return rows;
  },

  // detected_tweets
  async upsertDetectedTweet(params) {
    const db = getDb();
    db.prepare(
      `INSERT INTO detected_tweets (id, tweet_id, token_mint, author_x_user_id, author_username, tweet_created_at)
       VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(tweet_id, token_mint) DO NOTHING`
    ).run(uuid(), params.tweet_id, params.token_mint, params.author_x_user_id, params.author_username, params.tweet_created_at ?? null);
  },
  async getAllDetectedTweets() {
    const rows = getDb()
      .prepare("SELECT id, tweet_id, token_mint, author_x_user_id, author_username, last_impressions, last_likes, last_retweets, last_replies FROM detected_tweets")
      .all() as { id: string; tweet_id: string; token_mint: string; author_x_user_id: string; author_username: string; last_impressions: number; last_likes: number; last_retweets: number; last_replies: number }[];
    return rows;
  },
  async getDetectedTweetsByToken(token_mint) {
    const rows = getDb()
      .prepare("SELECT id, tweet_id, author_username, last_likes, last_retweets, last_replies, first_seen_at FROM detected_tweets WHERE token_mint = ? ORDER BY first_seen_at DESC")
      .all(token_mint) as { id: string; tweet_id: string; author_username: string; last_likes: number; last_retweets: number; last_replies: number; first_seen_at: string }[];
    return rows;
  },
  async updateDetectedTweetMetrics(id, params) {
    getDb()
      .prepare(
        "UPDATE detected_tweets SET last_impressions = ?, last_likes = ?, last_retweets = ?, last_replies = ?, last_metrics_at = ? WHERE id = ?"
      )
      .run(params.last_impressions, params.last_likes, params.last_retweets, params.last_replies, params.last_metrics_at, id);
  },

  // inactive_tokens
  async getByMint(mint) {
    const row = getDb().prepare("SELECT mint, cto_eligible FROM inactive_tokens WHERE mint = ?").get(mint) as { mint: string; cto_eligible: number } | undefined;
    return row ? { mint: row.mint, cto_eligible: Boolean(row.cto_eligible) } : null;
  },

  // cto_claims
  async insertCtoClaim(params) {
    getDb()
      .prepare(
        "INSERT INTO cto_claims (id, mint, new_authority, proposal_uri, tx_signature, status) VALUES (?, ?, ?, ?, ?, 'pending')"
      )
      .run(uuid(), params.mint, params.new_authority, params.proposal_uri ?? null, params.tx_signature ?? null);
    return {};
  },
  async getCtoClaims(status?: import("./types").CtoClaimStatus) {
    const db = getDb();
    const rows = status
      ? (db.prepare("SELECT id, mint, new_authority, proposal_uri, tx_signature, claimed_at, status, fee_lamports, fee_tx_sig FROM cto_claims WHERE status = ? ORDER BY claimed_at DESC").all(status) as import("./types").CtoClaimRow[])
      : (db.prepare("SELECT id, mint, new_authority, proposal_uri, tx_signature, claimed_at, status, fee_lamports, fee_tx_sig FROM cto_claims ORDER BY claimed_at DESC").all() as import("./types").CtoClaimRow[]);
    return rows.map((r) => ({
      ...r,
      status: (r.status ?? "pending") as import("./types").CtoClaimStatus,
      fee_lamports: r.fee_lamports ?? null,
      fee_tx_sig: r.fee_tx_sig ?? null,
    }));
  },
  async updateCtoClaimStatus(id: string, params: { status?: import("./types").CtoClaimStatus; fee_lamports?: number | null; fee_tx_sig?: string | null }) {
    const db = getDb();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    if (params.status !== undefined) {
      updates.push("status = ?");
      values.push(params.status);
    }
    if (params.fee_lamports !== undefined) {
      updates.push("fee_lamports = ?");
      values.push(params.fee_lamports);
    }
    if (params.fee_tx_sig !== undefined) {
      updates.push("fee_tx_sig = ?");
      values.push(params.fee_tx_sig);
    }
    if (updates.length === 0) return {};
    values.push(id);
    db.prepare(`UPDATE cto_claims SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    return {};
  },
};

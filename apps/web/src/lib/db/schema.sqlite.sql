-- SQLite schema (mirrors Supabase for easy upgrade later). Run on first use.

-- used_images
CREATE TABLE IF NOT EXISTS used_images (
  id TEXT PRIMARY KEY,
  hash_sha256 TEXT NOT NULL UNIQUE,
  mint TEXT NOT NULL,
  registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_used_images_hash ON used_images (hash_sha256);
CREATE INDEX IF NOT EXISTS idx_used_images_mint ON used_images (mint);

-- tracked_tokens
CREATE TABLE IF NOT EXISTS tracked_tokens (
  id TEXT PRIMARY KEY,
  token_mint TEXT NOT NULL UNIQUE,
  search_query TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- token_creators: links token_mint to creator wallet (set at launch/register). deployer_rating_at_launch = snapshot at creation for fee tier.
CREATE TABLE IF NOT EXISTS token_creators (
  token_mint TEXT PRIMARY KEY,
  creator_wallet TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deployer_rating_at_launch INTEGER
);
CREATE INDEX IF NOT EXISTS idx_token_creators_creator ON token_creators (creator_wallet);
CREATE INDEX IF NOT EXISTS idx_token_creators_creator_created ON token_creators (creator_wallet, created_at);

-- deployer_profiles: paid profile for deployers (required to launch, daily cap, rating for fee scaling)
CREATE TABLE IF NOT EXISTS deployer_profiles (
  wallet TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT,
  profile_fee_lamports INTEGER NOT NULL DEFAULT 0,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  rating_score REAL NOT NULL DEFAULT 50,
  rating_updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- reward_loops: per-token rewards schedule and config for cron
CREATE TABLE IF NOT EXISTS reward_loops (
  token_mint TEXT PRIMARY KEY,
  interval_sec INTEGER NOT NULL DEFAULT 300,
  distribution_split TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  next_run_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- bagworker_oauth_state
CREATE TABLE IF NOT EXISTS bagworker_oauth_state (
  state TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- bagworker_profiles
CREATE TABLE IF NOT EXISTS bagworker_profiles (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL UNIQUE,
  x_user_id TEXT NOT NULL UNIQUE,
  x_username TEXT NOT NULL,
  x_access_token_encrypted TEXT,
  x_refresh_token_encrypted TEXT,
  x_token_expires_at TEXT,
  verified_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bagworker_profiles_wallet ON bagworker_profiles (wallet);
CREATE INDEX IF NOT EXISTS idx_bagworker_profiles_x_user_id ON bagworker_profiles (x_user_id);

-- bagworker_tweets
CREATE TABLE IF NOT EXISTS bagworker_tweets (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  token_mint TEXT NOT NULL,
  tweet_id TEXT NOT NULL,
  tweet_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  UNIQUE (wallet, token_mint, tweet_id)
);
CREATE INDEX IF NOT EXISTS idx_bagworker_tweets_wallet ON bagworker_tweets (wallet);
CREATE INDEX IF NOT EXISTS idx_bagworker_tweets_token ON bagworker_tweets (token_mint);

-- bagworker_periods
CREATE TABLE IF NOT EXISTS bagworker_periods (
  id TEXT PRIMARY KEY,
  period_key TEXT NOT NULL UNIQUE,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL
);

-- bagworker_engagement
CREATE TABLE IF NOT EXISTS bagworker_engagement (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES bagworker_periods(id),
  wallet TEXT NOT NULL,
  token_mint TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  retweets INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  raw_score REAL NOT NULL DEFAULT 0,
  share_pct REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (period_id, wallet, token_mint)
);
CREATE INDEX IF NOT EXISTS idx_bagworker_engagement_period ON bagworker_engagement (period_id);
CREATE INDEX IF NOT EXISTS idx_bagworker_engagement_wallet ON bagworker_engagement (wallet);

-- bagworker_claims
CREATE TABLE IF NOT EXISTS bagworker_claims (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  token_mint TEXT NOT NULL,
  period_id TEXT,
  amount_lamports REAL NOT NULL,
  share_pct REAL NOT NULL,
  tx_signature TEXT,
  claimed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bagworker_claims_wallet ON bagworker_claims (wallet);

-- detected_tweets
CREATE TABLE IF NOT EXISTS detected_tweets (
  id TEXT PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  token_mint TEXT NOT NULL,
  author_x_user_id TEXT NOT NULL,
  author_username TEXT NOT NULL,
  tweet_created_at TEXT,
  last_impressions INTEGER NOT NULL DEFAULT 0,
  last_likes INTEGER NOT NULL DEFAULT 0,
  last_retweets INTEGER NOT NULL DEFAULT 0,
  last_replies INTEGER NOT NULL DEFAULT 0,
  last_metrics_at TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tweet_id, token_mint)
);
CREATE INDEX IF NOT EXISTS idx_detected_tweets_token ON detected_tweets (token_mint);
CREATE INDEX IF NOT EXISTS idx_detected_tweets_author ON detected_tweets (author_x_user_id);

-- inactive_tokens
CREATE TABLE IF NOT EXISTS inactive_tokens (
  id TEXT PRIMARY KEY,
  mint TEXT NOT NULL UNIQUE,
  last_trade_at TEXT,
  market_cap_usd REAL,
  cto_eligible INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inactive_tokens_mint ON inactive_tokens (mint);

-- cto_claims
CREATE TABLE IF NOT EXISTS cto_claims (
  id TEXT PRIMARY KEY,
  mint TEXT NOT NULL,
  new_authority TEXT NOT NULL,
  proposal_uri TEXT,
  tx_signature TEXT,
  claimed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cto_claims_mint ON cto_claims (mint);

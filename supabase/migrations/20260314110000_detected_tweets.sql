-- Auto-detected tweets: found by searching X for the token CA (or canonical link). Used for delta-based, repeatable rewards.
create table if not exists public.detected_tweets (
  id uuid primary key default gen_random_uuid(),
  tweet_id text not null,
  token_mint text not null,
  author_x_user_id text not null,
  author_username text not null,
  tweet_created_at timestamptz,
  last_impressions bigint not null default 0,
  last_likes int not null default 0,
  last_retweets int not null default 0,
  last_replies int not null default 0,
  last_metrics_at timestamptz,
  first_seen_at timestamptz not null default now(),
  unique (tweet_id, token_mint)
);

create index if not exists idx_detected_tweets_token on public.detected_tweets (token_mint);
create index if not exists idx_detected_tweets_author on public.detected_tweets (author_x_user_id);
create index if not exists idx_detected_tweets_first_seen on public.detected_tweets (first_seen_at);

alter table public.detected_tweets enable row level security;

create policy "Service role full access"
  on public.detected_tweets for all using (true) with check (true) to service_role;

comment on table public.detected_tweets is 'Tweets auto-detected by searching for token CA; last_* used for delta scoring per period.';

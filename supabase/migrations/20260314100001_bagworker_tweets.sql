-- Tweets submitted by bagworkers for a token. We verify author = linked X and optionally content, then fetch metrics.
create table if not exists public.bagworker_tweets (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  token_mint text not null,
  tweet_id text not null,
  tweet_url text,
  status text not null default 'pending', -- pending | approved | rejected
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (wallet, token_mint, tweet_id)
);

create index if not exists idx_bagworker_tweets_wallet on public.bagworker_tweets (wallet);
create index if not exists idx_bagworker_tweets_token on public.bagworker_tweets (token_mint);
create index if not exists idx_bagworker_tweets_status on public.bagworker_tweets (status) where status = 'approved';

alter table public.bagworker_tweets enable row level security;

create policy "Service role full access"
  on public.bagworker_tweets for all using (true) with check (true) to service_role;

comment on table public.bagworker_tweets is 'Tweets submitted by bagworkers for a token; approved tweets count toward engagement score.';

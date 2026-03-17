-- Engagement metrics and computed score per wallet/token/period. Filled by cron after fetching X API metrics.
create table if not exists public.bagworker_periods (
  id uuid primary key default gen_random_uuid(),
  period_key text not null unique, -- e.g. 2026-W11
  started_at timestamptz not null,
  ended_at timestamptz not null
);

create table if not exists public.bagworker_engagement (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.bagworker_periods(id),
  wallet text not null,
  token_mint text not null,
  impressions bigint not null default 0,
  likes int not null default 0,
  retweets int not null default 0,
  replies int not null default 0,
  raw_score numeric not null default 0,
  share_pct numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (period_id, wallet, token_mint)
);

create index if not exists idx_bagworker_engagement_period on public.bagworker_engagement (period_id);
create index if not exists idx_bagworker_engagement_wallet on public.bagworker_engagement (wallet);
create index if not exists idx_bagworker_engagement_token on public.bagworker_engagement (token_mint);

alter table public.bagworker_engagement enable row level security;
alter table public.bagworker_periods enable row level security;

create policy "Service role full access engagement"
  on public.bagworker_engagement for all using (true) with check (true) to service_role;
create policy "Service role full access periods"
  on public.bagworker_periods for all using (true) with check (true) to service_role;

comment on table public.bagworker_engagement is 'Per-period engagement and share % for fee distribution.';

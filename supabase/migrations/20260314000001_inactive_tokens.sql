-- Tokens eligible for CTO: inactive (no trades for N days) + low MC. Populated by indexer/webhook.
create table if not exists public.inactive_tokens (
  id uuid primary key default gen_random_uuid(),
  mint text not null unique,
  last_trade_at timestamptz,
  market_cap_usd numeric,
  cto_eligible boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists idx_inactive_tokens_mint on public.inactive_tokens (mint);
create index if not exists idx_inactive_tokens_eligible on public.inactive_tokens (cto_eligible) where cto_eligible = true;

alter table public.inactive_tokens enable row level security;

create policy "Service role full access"
  on public.inactive_tokens
  for all
  using (true)
  with check (true)
  to service_role;

-- Record of fee payouts to bagworkers (per token/period).
create table if not exists public.bagworker_claims (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  token_mint text not null,
  period_id uuid references public.bagworker_periods(id),
  amount_lamports numeric not null,
  share_pct numeric not null,
  tx_signature text,
  claimed_at timestamptz not null default now()
);

create index if not exists idx_bagworker_claims_wallet on public.bagworker_claims (wallet);
create index if not exists idx_bagworker_claims_token on public.bagworker_claims (token_mint);

alter table public.bagworker_claims enable row level security;

create policy "Service role full access"
  on public.bagworker_claims for all using (true) with check (true) to service_role;

comment on table public.bagworker_claims is 'Fee payouts to bagworkers; amount = share of period fee pool.';

-- Record of CTO claims for announcements and dashboard.
create table if not exists public.cto_claims (
  id uuid primary key default gen_random_uuid(),
  mint text not null,
  new_authority text not null,
  proposal_uri text,
  tx_signature text,
  claimed_at timestamptz not null default now()
);

create index if not exists idx_cto_claims_mint on public.cto_claims (mint);

alter table public.cto_claims enable row level security;

create policy "Service role full access"
  on public.cto_claims
  for all
  using (true)
  with check (true)
  to service_role;

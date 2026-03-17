-- Bagworker: wallet <-> X account link. One wallet, one X account. Verified via Sign in with X (OAuth 2.0).
create table if not exists public.bagworker_profiles (
  id uuid primary key default gen_random_uuid(),
  wallet text not null unique,
  x_user_id text not null unique,
  x_username text not null,
  x_access_token_encrypted text,
  x_refresh_token_encrypted text,
  x_token_expires_at timestamptz,
  verified_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bagworker_profiles_wallet on public.bagworker_profiles (wallet);
create index if not exists idx_bagworker_profiles_x_user_id on public.bagworker_profiles (x_user_id);

alter table public.bagworker_profiles enable row level security;

create policy "Service role full access"
  on public.bagworker_profiles for all using (true) with check (true) to service_role;

comment on table public.bagworker_profiles is 'Wallet <-> X (Twitter) account link for bagworker verification.';

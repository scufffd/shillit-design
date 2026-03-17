-- Temporary state for X OAuth PKCE flow (state -> wallet, code_verifier). Delete after use or expire.
create table if not exists public.bagworker_oauth_state (
  state text primary key,
  wallet text not null,
  code_verifier text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_bagworker_oauth_state_created on public.bagworker_oauth_state (created_at);

alter table public.bagworker_oauth_state enable row level security;

create policy "Service role full access"
  on public.bagworker_oauth_state for all using (true) with check (true) to service_role;

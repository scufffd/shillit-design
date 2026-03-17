-- Tokens we run auto-detect for: search X for tweets containing search_query (CA or short link).
create table if not exists public.tracked_tokens (
  id uuid primary key default gen_random_uuid(),
  token_mint text not null unique,
  search_query text not null,
  created_at timestamptz not null default now()
);

comment on column public.tracked_tokens.search_query is 'Query for Twitter recent search: token CA or canonical short link (e.g. shillit.fun/t/xyz).';

alter table public.tracked_tokens enable row level security;
create policy "Service role full access" on public.tracked_tokens for all using (true) with check (true) to service_role;

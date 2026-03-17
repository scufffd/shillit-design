-- Image uniqueness: one token per image. Hash checked before mint; registered after mint.
create table if not exists public.used_images (
  id uuid primary key default gen_random_uuid(),
  hash_sha256 text not null unique,
  mint text not null,
  registered_at timestamptz not null default now()
);

create index if not exists idx_used_images_hash on public.used_images (hash_sha256);
create index if not exists idx_used_images_mint on public.used_images (mint);

alter table public.used_images enable row level security;

create policy "Service role full access"
  on public.used_images
  for all
  using (true)
  with check (true)
  to service_role;

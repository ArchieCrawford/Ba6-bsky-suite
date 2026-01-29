-- =========================================================
-- BA6 Bsky Suite: atproto sessions (Bluesky auth)
-- =========================================================

begin;

create table if not exists public.atproto_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'bluesky',
  did text not null,
  handle text,
  pds_url text,
  access_jwt text not null,
  refresh_jwt text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists atproto_sessions_user_id_idx on public.atproto_sessions (user_id);
create unique index if not exists atproto_sessions_user_provider_unique
  on public.atproto_sessions (user_id, provider);

alter table public.atproto_sessions enable row level security;

drop policy if exists "atproto_sessions_select_own" on public.atproto_sessions;
create policy "atproto_sessions_select_own"
  on public.atproto_sessions
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "atproto_sessions_insert_own" on public.atproto_sessions;
create policy "atproto_sessions_insert_own"
  on public.atproto_sessions
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "atproto_sessions_update_own" on public.atproto_sessions;
create policy "atproto_sessions_update_own"
  on public.atproto_sessions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "atproto_sessions_delete_own" on public.atproto_sessions;
create policy "atproto_sessions_delete_own"
  on public.atproto_sessions
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "atproto_sessions_service_role" on public.atproto_sessions;
create policy "atproto_sessions_service_role"
  on public.atproto_sessions
  for all
  to service_role
  using (true)
  with check (true);

drop trigger if exists trg_atproto_sessions_updated_at on public.atproto_sessions;
create trigger trg_atproto_sessions_updated_at
before update on public.atproto_sessions
for each row execute function public.set_updated_at();

commit;

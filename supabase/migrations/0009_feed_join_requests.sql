-- =========================================================
-- BA6 Bsky Suite: feed join requests (opt-in moderation)
-- =========================================================

begin;

create table if not exists public.feed_join_requests (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.feeds(id) on delete cascade,
  account_did text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists feed_join_requests_unique
  on public.feed_join_requests (feed_id, account_did);

create index if not exists feed_join_requests_feed_id_idx
  on public.feed_join_requests (feed_id);

drop trigger if exists trg_feed_join_requests_updated_at on public.feed_join_requests;
create trigger trg_feed_join_requests_updated_at
before update on public.feed_join_requests
for each row execute function public.set_updated_at();

alter table public.feed_join_requests enable row level security;

drop policy if exists "feed_join_requests_via_feeds" on public.feed_join_requests;
create policy "feed_join_requests_via_feeds"
on public.feed_join_requests
for all
using (
  exists (
    select 1 from public.feeds f
    where f.id = feed_join_requests.feed_id and f.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.feeds f
    where f.id = feed_join_requests.feed_id and f.user_id = auth.uid()
  )
);

drop policy if exists "feed_join_requests_service_role" on public.feed_join_requests;
create policy "feed_join_requests_service_role"
on public.feed_join_requests
for all
to service_role
using (true)
with check (true);

commit;

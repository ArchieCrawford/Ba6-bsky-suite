create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = id);

create table if not exists public.bsky_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  did text not null,
  handle text not null,
  service text not null default 'https://bsky.social',
  created_at timestamptz not null default now(),
  unique (user_id, did)
);

alter table public.bsky_accounts enable row level security;

create policy "bsky_accounts_select_own"
on public.bsky_accounts for select
using (auth.uid() = user_id);

create policy "bsky_accounts_insert_own"
on public.bsky_accounts for insert
with check (auth.uid() = user_id);

create policy "bsky_accounts_update_own"
on public.bsky_accounts for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.bsky_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_did text not null,
  access_jwt text not null,
  refresh_jwt text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account_did)
);

alter table public.bsky_sessions enable row level security;

create policy "bsky_sessions_select_own"
on public.bsky_sessions for select
using (auth.uid() = user_id);

create policy "bsky_sessions_insert_own"
on public.bsky_sessions for insert
with check (auth.uid() = user_id);

create policy "bsky_sessions_update_own"
on public.bsky_sessions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.drafts enable row level security;

create policy "drafts_crud_own"
on public.drafts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create type public.schedule_status as enum ('queued','posting','posted','failed','canceled');

create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_did text not null,
  draft_id uuid not null references public.drafts(id) on delete cascade,
  run_at timestamptz not null,
  status public.schedule_status not null default 'queued',
  attempt_count int not null default 0,
  max_attempts int not null default 5,
  last_error text,
  posted_uri text,
  posted_cid text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scheduled_posts_due_idx
on public.scheduled_posts (status, run_at);

alter table public.scheduled_posts enable row level security;

create policy "scheduled_posts_crud_own"
on public.scheduled_posts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.post_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_post_id uuid references public.scheduled_posts(id) on delete set null,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.post_events enable row level security;

create policy "post_events_select_own"
on public.post_events for select
using (auth.uid() = user_id);

create policy "post_events_insert_own"
on public.post_events for insert
with check (auth.uid() = user_id);

create table if not exists public.feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  display_name text not null,
  description text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

alter table public.feeds enable row level security;

create policy "feeds_crud_own"
on public.feeds
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.feed_sources (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.feeds(id) on delete cascade,
  source_type text not null check (source_type in ('account_list','self')),
  account_did text,
  created_at timestamptz not null default now()
);

create index if not exists feed_sources_feed_idx on public.feed_sources(feed_id);

alter table public.feed_sources enable row level security;

create policy "feed_sources_via_feeds"
on public.feed_sources
for all
using (
  exists (
    select 1 from public.feeds f
    where f.id = feed_sources.feed_id and f.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.feeds f
    where f.id = feed_sources.feed_id and f.user_id = auth.uid()
  )
);

create table if not exists public.feed_rules (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.feeds(id) on delete cascade,
  include_keywords text[] not null default '{}'::text[],
  exclude_keywords text[] not null default '{}'::text[],
  lang text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feed_rules enable row level security;

create policy "feed_rules_via_feeds"
on public.feed_rules
for all
using (
  exists (
    select 1 from public.feeds f
    where f.id = feed_rules.feed_id and f.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.feeds f
    where f.id = feed_rules.feed_id and f.user_id = auth.uid()
  )
);

create table if not exists public.indexed_posts (
  uri text primary key,
  cid text,
  author_did text not null,
  text text not null,
  created_at timestamptz not null,
  lang text,
  inserted_at timestamptz not null default now()
);

create index if not exists indexed_posts_author_idx on public.indexed_posts(author_did, created_at desc);
create index if not exists indexed_posts_created_idx on public.indexed_posts(created_at desc);

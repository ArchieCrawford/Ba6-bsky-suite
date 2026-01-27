-- =========================================================
-- BA6 Bsky Suite: Multi-user + schema mismatch fixes
-- Safe to run multiple times
-- =========================================================

begin;

-- 1) feeds columns (fix "feeds.title does not exist" on older DBs)
alter table public.feeds
  add column if not exists title text;

alter table public.feeds
  add column if not exists display_name text;

alter table public.feeds
  add column if not exists description text;

alter table public.feeds
  add column if not exists is_enabled boolean not null default true;

-- 2) feeds slug uniqueness should be per-user, not global
do $$
begin
  -- Drop old global unique(slug) if it exists (default name often feeds_slug_key)
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.feeds'::regclass
      and contype = 'u'
      and conname = 'feeds_slug_key'
  ) then
    execute 'alter table public.feeds drop constraint feeds_slug_key';
  end if;

  -- Add per-user unique constraint if missing
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.feeds'::regclass
      and contype = 'u'
      and conname = 'feeds_user_slug_key'
  ) then
    execute 'alter table public.feeds add constraint feeds_user_slug_key unique (user_id, slug)';
  end if;
end $$;

-- 3) scheduled_posts: make Bluesky account optional (nullable)
alter table public.scheduled_posts
  alter column account_id drop not null;

alter table public.scheduled_posts
  alter column account_did drop not null;

-- 4) accounts uniqueness should be per-user
do $$
begin
  -- Drop old global unique(account_did) if it exists (default name often accounts_account_did_key)
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.accounts'::regclass
      and contype = 'u'
      and conname = 'accounts_account_did_key'
  ) then
    execute 'alter table public.accounts drop constraint accounts_account_did_key';
  end if;

  -- Add per-user unique constraint if missing
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.accounts'::regclass
      and contype = 'u'
      and conname = 'accounts_user_did_key'
  ) then
    execute 'alter table public.accounts add constraint accounts_user_did_key unique (user_id, account_did)';
  end if;
end $$;

-- 4b) optional account label for display
alter table public.accounts
  add column if not exists label text;

-- 5) auto-bootstrap public.users on new auth signup
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, display_name)
  values (new.id, null)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- 6) Worker claim RPC: only claim posts that have an account connected
create or replace function public.claim_next_scheduled_post(
  lock_seconds int,
  worker_id text
)
returns setof public.scheduled_posts
language plpgsql
security definer
as $$
begin
  return query
  with candidate as (
    select sp.id
    from public.scheduled_posts sp
    where sp.status = 'queued'
      and sp.run_at <= now()
      and sp.account_id is not null
      and sp.account_did is not null
      and (sp.locked_at is null or sp.locked_at < (now() - make_interval(secs => lock_seconds)))
    order by sp.run_at asc
    limit 1
    for update skip locked
  )
  update public.scheduled_posts sp
  set status = 'posting',
      locked_at = now(),
      locked_by = worker_id,
      attempt_count = sp.attempt_count + 1,
      updated_at = now()
  from candidate
  where sp.id = candidate.id
  returning sp.*;
end;
$$;

revoke all on function public.claim_next_scheduled_post(int, text) from public;
grant execute on function public.claim_next_scheduled_post(int, text) to service_role;

commit;

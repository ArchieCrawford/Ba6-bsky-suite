-- =========================================================
-- BA6 Bsky Suite: schema safety + legacy compatibility
-- =========================================================

begin;

-- feeds columns
alter table public.feeds add column if not exists title text;
alter table public.feeds add column if not exists description text;
alter table public.feeds add column if not exists is_enabled boolean not null default true;

-- feeds slug uniqueness: drop unique on slug-only, add per-user unique
do $$
declare r record;
begin
  for r in (
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'feeds'
      and c.contype = 'u'
      and (
        select array_agg(a.attname order by a.attnum)
        from pg_attribute a
        where a.attrelid = t.oid and a.attnum = any(c.conkey)
      ) = array['slug']
  ) loop
    execute format('alter table public.feeds drop constraint %I', r.conname);
  end loop;

  for r in (
    select i.relname as indexname
    from pg_index ix
    join pg_class t on t.oid = ix.indrelid
    join pg_class i on i.oid = ix.indexrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'feeds'
      and ix.indisunique
      and ix.indkey::int[] = array[
        (select attnum from pg_attribute where attrelid = t.oid and attname = 'slug' limit 1)
      ]
  ) loop
    execute format('drop index if exists public.%I', r.indexname);
  end loop;
end $$;

create unique index if not exists feeds_user_slug_unique on public.feeds (user_id, slug);

-- accounts uniqueness: drop unique on account_did-only, add per-user unique
do $$
declare r record;
begin
  for r in (
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'accounts'
      and c.contype = 'u'
      and (
        select array_agg(a.attname order by a.attnum)
        from pg_attribute a
        where a.attrelid = t.oid and a.attnum = any(c.conkey)
      ) = array['account_did']
  ) loop
    execute format('alter table public.accounts drop constraint %I', r.conname);
  end loop;

  for r in (
    select i.relname as indexname
    from pg_index ix
    join pg_class t on t.oid = ix.indrelid
    join pg_class i on i.oid = ix.indexrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'accounts'
      and ix.indisunique
      and ix.indkey::int[] = array[
        (select attnum from pg_attribute where attrelid = t.oid and attname = 'account_did' limit 1)
      ]
  ) loop
    execute format('drop index if exists public.%I', r.indexname);
  end loop;
end $$;

create unique index if not exists accounts_user_account_did_unique
  on public.accounts (user_id, account_did);

-- scheduled_posts account columns
alter table public.scheduled_posts add column if not exists account_id uuid;
alter table public.scheduled_posts add column if not exists account_did text;

-- add FK if missing
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'scheduled_posts'
      and c.contype = 'f'
      and (
        select array_agg(a.attname order by a.attnum)
        from pg_attribute a
        where a.attrelid = t.oid and a.attnum = any(c.conkey)
      ) = array['account_id']
  ) then
    alter table public.scheduled_posts
      add constraint scheduled_posts_account_id_fkey
      foreign key (account_id) references public.accounts(id) on delete set null;
  end if;
end $$;

-- ensure auth.users trigger inserts into public.users
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

commit;

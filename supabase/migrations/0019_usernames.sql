-- =========================================================
-- BA6 Bsky Suite: identity usernames
-- =========================================================

begin;

alter table public.identities
  add column if not exists username text;

create or replace function public.normalize_username(value text)
returns text
language sql
immutable
as $$
  select nullif(lower(btrim(value)), '');
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.identities'::regclass
      and conname = 'identities_username_format'
  ) then
    execute 'alter table public.identities add constraint identities_username_format check (username is null or username ~ ''^[a-z][a-z0-9_]{2,19}$'')';
  end if;
end $$;

create unique index if not exists identities_username_unique
  on public.identities (lower(username))
  where username is not null;

create index if not exists identities_username_idx
  on public.identities (username);

commit;

-- =========================================================
-- BA6 Bsky Suite: feed_sources hardening
-- =========================================================

begin;

delete from public.feed_sources
where account_did = 'did:plc:REPLACE_ME'
   or account_did ilike '%REPLACE_ME%';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.feed_sources'::regclass
      and conname = 'feed_sources_account_did_not_blank'
  ) then
    execute 'alter table public.feed_sources add constraint feed_sources_account_did_not_blank check (account_did is null or length(btrim(account_did)) > 0)';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.feed_sources'::regclass
      and conname = 'feed_sources_account_did_not_placeholder'
  ) then
    execute 'alter table public.feed_sources add constraint feed_sources_account_did_not_placeholder check (account_did is null or account_did !~* ''REPLACE_ME'')';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.feed_sources'::regclass
      and conname = 'feed_sources_account_list_requires_did'
  ) then
    execute 'alter table public.feed_sources add constraint feed_sources_account_list_requires_did check (source_type <> ''account_list'' or account_did is not null)';
  end if;
end $$;

commit;

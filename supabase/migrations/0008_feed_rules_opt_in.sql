-- =========================================================
-- BA6 Bsky Suite: feed rules opt-in + submit tag support
-- =========================================================

begin;

alter table public.feed_rules
  add column if not exists rule_type text not null default 'keyword';

alter table public.feed_rules
  add column if not exists source_strategy text not null default 'curated';

alter table public.feed_rules
  add column if not exists include_mode text not null default 'any';

alter table public.feed_rules
  add column if not exists case_insensitive boolean not null default true;

alter table public.feed_rules
  add column if not exists opt_in_enabled boolean not null default false;

alter table public.feed_rules
  add column if not exists opt_in_mode text not null default 'public';

alter table public.feed_rules
  add column if not exists opt_in_tag text;

alter table public.feed_rules
  add column if not exists submit_enabled boolean not null default false;

alter table public.feed_rules
  add column if not exists submit_tag text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.feed_rules'::regclass
      and conname = 'feed_rules_include_mode_check'
  ) then
    execute 'alter table public.feed_rules add constraint feed_rules_include_mode_check check (include_mode in (''any'',''all''))';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.feed_rules'::regclass
      and conname = 'feed_rules_source_strategy_check'
  ) then
    execute 'alter table public.feed_rules add constraint feed_rules_source_strategy_check check (source_strategy in (''curated'',''opt_in''))';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.feed_rules'::regclass
      and conname = 'feed_rules_opt_in_mode_check'
  ) then
    execute 'alter table public.feed_rules add constraint feed_rules_opt_in_mode_check check (opt_in_mode in (''public'',''moderated''))';
  end if;
end $$;

commit;

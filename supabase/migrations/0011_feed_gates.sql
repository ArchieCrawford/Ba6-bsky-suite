-- =========================================================
-- BA6 Bsky Suite: feed gates + join requests
-- =========================================================

begin;

create table if not exists public.feed_gates (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.feeds(id) on delete cascade,
  gate_type text not null,
  mode text,
  config jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feed_gates_feed_id_idx on public.feed_gates (feed_id);
create index if not exists feed_gates_type_idx on public.feed_gates (gate_type);
create index if not exists feed_gates_enabled_idx on public.feed_gates (is_enabled);

alter table public.feed_gates enable row level security;

drop policy if exists "feed_gates_via_feeds" on public.feed_gates;
create policy "feed_gates_via_feeds"
  on public.feed_gates
  for all
  using (
    exists (
      select 1 from public.feeds f
      where f.id = feed_gates.feed_id and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.feeds f
      where f.id = feed_gates.feed_id and f.user_id = auth.uid()
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.feed_gates'::regclass
      and conname = 'feed_gates_gate_type_check'
  ) then
    execute 'alter table public.feed_gates add constraint feed_gates_gate_type_check check (gate_type in (''hashtag_opt_in'',''token_gate'',''pay_gate'',''manual_approval'',''follow_gate''))';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.feed_gates'::regclass
      and conname = 'feed_gates_mode_check'
  ) then
    execute 'alter table public.feed_gates add constraint feed_gates_mode_check check (mode is null or mode in (''public'',''moderated''))';
  end if;
end $$;

drop trigger if exists trg_feed_gates_updated_at on public.feed_gates;
create trigger trg_feed_gates_updated_at
before update on public.feed_gates
for each row execute function public.set_updated_at();

-- Feed join requests adjustments (from 0009)
alter table public.feed_join_requests
  add column if not exists requester_did text;

update public.feed_join_requests
set requester_did = account_did
where requester_did is null and account_did is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.feed_join_requests'::regclass
      and conname = 'feed_join_requests_status_check'
  ) then
    execute 'alter table public.feed_join_requests add constraint feed_join_requests_status_check check (status in (''pending'',''approved'',''rejected''))';
  end if;
end $$;

create index if not exists feed_join_requests_feed_status_idx
  on public.feed_join_requests (feed_id, status);

-- Expand RLS to allow authenticated join requests

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

drop policy if exists "feed_join_requests_insert_authenticated" on public.feed_join_requests;
create policy "feed_join_requests_insert_authenticated"
  on public.feed_join_requests
  for insert
  to authenticated
  with check (requester_did is not null);

commit;

create table if not exists public.worker_heartbeats (
  worker_id text primary key,
  last_seen_at timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb
);

alter table public.worker_heartbeats
  add column if not exists last_seen_at timestamptz not null default now();

alter table public.worker_heartbeats
  add column if not exists detail jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'worker_heartbeats'
      and column_name = 'last_seen'
  ) then
    execute 'update public.worker_heartbeats set last_seen_at = coalesce(last_seen_at, last_seen)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'worker_heartbeats'
      and column_name = 'meta'
  ) then
    execute 'update public.worker_heartbeats
             set detail = case
               when detail is null or detail = ''{}''::jsonb then coalesce(meta, ''{}''::jsonb)
               else detail
             end';
  end if;
end
$$;

alter table public.worker_heartbeats drop column if exists last_seen;
alter table public.worker_heartbeats drop column if exists meta;

alter table public.worker_heartbeats enable row level security;

drop policy if exists "worker_heartbeats_select_authenticated" on public.worker_heartbeats;
drop policy if exists "worker_heartbeats_service_role_all" on public.worker_heartbeats;

create policy "worker_heartbeats_select_authenticated"
on public.worker_heartbeats for select
using (auth.uid() is not null);

create policy "worker_heartbeats_service_role_all"
on public.worker_heartbeats
for all
to service_role
using (true)
with check (true);

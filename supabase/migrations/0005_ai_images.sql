begin;

-- 1) Core tables
create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  kind text not null check (kind in ('image')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','canceled')),

  provider text not null default 'venice',
  model text not null,

  prompt text not null,
  negative_prompt text,
  params jsonb not null default '{}'::jsonb,

  provider_request_id text,
  error text,

  locked_at timestamptz,
  locked_by text,
  attempt_count int not null default 0,
  max_attempts int not null default 3,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_jobs_user_id_created_at_idx on public.ai_jobs (user_id, created_at desc);
create index if not exists ai_jobs_status_created_at_idx on public.ai_jobs (status, created_at asc);
create index if not exists ai_jobs_locked_at_idx on public.ai_jobs (locked_at);

create table if not exists public.ai_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.ai_jobs(id) on delete cascade,

  kind text not null check (kind in ('image')),
  storage_bucket text not null default 'ai',
  storage_path text not null,
  mime_type text not null default 'image/webp',
  width int,
  height int,

  created_at timestamptz not null default now()
);

create index if not exists ai_assets_user_id_created_at_idx on public.ai_assets (user_id, created_at desc);
create index if not exists ai_assets_job_id_idx on public.ai_assets (job_id);

create table if not exists public.ai_job_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.ai_jobs(id) on delete cascade,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_job_events_job_id_created_at_idx on public.ai_job_events (job_id, created_at asc);

-- 2) Updated-at trigger (reuse helper if present)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_jobs_touch_updated_at on public.ai_jobs;
create trigger ai_jobs_touch_updated_at
before update on public.ai_jobs
for each row execute function public.touch_updated_at();

-- 3) RLS
alter table public.ai_jobs enable row level security;
alter table public.ai_assets enable row level security;
alter table public.ai_job_events enable row level security;

drop policy if exists ai_jobs_select_own on public.ai_jobs;
create policy ai_jobs_select_own on public.ai_jobs
for select using (auth.uid() = user_id);

drop policy if exists ai_jobs_insert_own on public.ai_jobs;
create policy ai_jobs_insert_own on public.ai_jobs
for insert with check (auth.uid() = user_id);

drop policy if exists ai_jobs_update_own on public.ai_jobs;
create policy ai_jobs_update_own on public.ai_jobs
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ai_assets_select_own on public.ai_assets;
create policy ai_assets_select_own on public.ai_assets
for select using (auth.uid() = user_id);

drop policy if exists ai_assets_insert_own on public.ai_assets;
create policy ai_assets_insert_own on public.ai_assets
for insert with check (auth.uid() = user_id);

drop policy if exists ai_job_events_select_own on public.ai_job_events;
create policy ai_job_events_select_own on public.ai_job_events
for select using (auth.uid() = user_id);

drop policy if exists ai_job_events_insert_own on public.ai_job_events;
create policy ai_job_events_insert_own on public.ai_job_events
for insert with check (auth.uid() = user_id);

-- 4) Worker claim RPC
create or replace function public.claim_next_ai_image_job(
  lock_seconds int,
  worker_id text
)
returns setof public.ai_jobs
language plpgsql
security definer
as $$
begin
  return query
  with candidate as (
    select j.id
    from public.ai_jobs j
    where j.kind = 'image'
      and j.status = 'queued'
      and j.attempt_count < j.max_attempts
      and (j.locked_at is null or j.locked_at < (now() - make_interval(secs => lock_seconds)))
    order by j.created_at asc
    limit 1
    for update skip locked
  )
  update public.ai_jobs j
  set status = 'running',
      locked_at = now(),
      locked_by = worker_id,
      attempt_count = j.attempt_count + 1,
      updated_at = now()
  from candidate
  where j.id = candidate.id
  returning j.*;
end;
$$;

revoke all on function public.claim_next_ai_image_job(int, text) from public;
grant execute on function public.claim_next_ai_image_job(int, text) to service_role;

-- 5) Storage bucket + policies
-- Create bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('ai', 'ai', false)
on conflict (id) do nothing;

-- Policies: users can read their own files under images/<uid>/...
-- Note: storage.objects.name is the full path within the bucket.

do $$
begin
  -- SELECT
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='ai_objects_select_own'
  ) then
    execute $$
      create policy ai_objects_select_own
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'ai'
        and (storage.foldername(name))[1] = 'images'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
    $$;
  end if;

  -- INSERT
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='ai_objects_insert_own'
  ) then
    execute $$
      create policy ai_objects_insert_own
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'ai'
        and (storage.foldername(name))[1] = 'images'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
    $$;
  end if;

  -- UPDATE
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='ai_objects_update_own'
  ) then
    execute $$
      create policy ai_objects_update_own
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'ai'
        and (storage.foldername(name))[1] = 'images'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      with check (
        bucket_id = 'ai'
        and (storage.foldername(name))[1] = 'images'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
    $$;
  end if;

  -- DELETE
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='ai_objects_delete_own'
  ) then
    execute $$
      create policy ai_objects_delete_own
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'ai'
        and (storage.foldername(name))[1] = 'images'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
    $$;
  end if;
end$$;

commit;

-- =========================================================
-- BA6 Bsky Suite: DID-first identities
-- =========================================================

begin;

create table if not exists public.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  did text not null,
  did_type text not null,
  handle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  unique (did)
);

drop trigger if exists trg_identities_updated_at on public.identities;
create trigger trg_identities_updated_at
before update on public.identities
for each row execute function public.set_updated_at();

alter table public.identities enable row level security;

drop policy if exists "identities_select_authenticated" on public.identities;
create policy "identities_select_authenticated"
  on public.identities
  for select
  to authenticated
  using (true);

drop policy if exists "identities_insert_own" on public.identities;
create policy "identities_insert_own"
  on public.identities
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "identities_update_own" on public.identities;
create policy "identities_update_own"
  on public.identities
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "identities_service_role_all" on public.identities;
create policy "identities_service_role_all"
  on public.identities
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.ensure_identity(p_user_id uuid)
returns public.identities
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.identities;
  jwt_role text := current_setting('request.jwt.claim.role', true);
begin
  if p_user_id is null then
    raise exception 'Missing user_id';
  end if;

  if auth.uid() is null and jwt_role is distinct from 'service_role' then
    raise exception 'Not authenticated';
  end if;

  if auth.uid() is not null and auth.uid() <> p_user_id and jwt_role is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;

  select * into row from public.identities where user_id = p_user_id limit 1;
  if row.id is not null then
    return row;
  end if;

  insert into public.identities (user_id, did, did_type)
  values (p_user_id, 'did:ba6:' || p_user_id::text, 'internal')
  returning * into row;

  return row;
end;
$$;

revoke all on function public.ensure_identity(uuid) from public;
grant execute on function public.ensure_identity(uuid) to authenticated;
grant execute on function public.ensure_identity(uuid) to service_role;

commit;

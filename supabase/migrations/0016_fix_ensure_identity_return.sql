-- =========================================================
-- BA6 Bsky Suite: fix ensure_identity return type + RLS
-- =========================================================

begin;

-- tighten select policy to own rows only
drop policy if exists "identities_select_authenticated" on public.identities;
drop policy if exists "identities_select_own" on public.identities;
create policy "identities_select_own"
  on public.identities
  for select
  to authenticated
  using (user_id = auth.uid());

-- optional delete policy for own row
drop policy if exists "identities_delete_own" on public.identities;
create policy "identities_delete_own"
  on public.identities
  for delete
  to authenticated
  using (user_id = auth.uid());

-- change ensure_identity return type (requires drop)
drop function if exists public.ensure_identity(uuid);

create function public.ensure_identity(p_user_id uuid)
returns setof public.identities
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
    return query select * from public.identities where id = row.id;
    return;
  end if;

  insert into public.identities (user_id, did, did_type)
  values (p_user_id, 'did:ba6:' || p_user_id::text, 'internal')
  returning * into row;

  return query select * from public.identities where id = row.id;
end;
$$;

revoke all on function public.ensure_identity(uuid) from public;
grant execute on function public.ensure_identity(uuid) to authenticated;
grant execute on function public.ensure_identity(uuid) to service_role;

commit;

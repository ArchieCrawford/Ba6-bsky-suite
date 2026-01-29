-- =========================================================
-- BA6 Bsky Suite: fix space RLS recursion
-- =========================================================

begin;

-- Helper functions to avoid RLS recursion
create or replace function public.is_space_member(p_space_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space_id
      and user_id = p_user_id
      and status = 'active'
  );
$$;

create or replace function public.is_space_admin(p_space_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space_id
      and user_id = p_user_id
      and role in ('owner','admin')
      and status = 'active'
  );
$$;

revoke all on function public.is_space_member(uuid, uuid) from public;
grant execute on function public.is_space_member(uuid, uuid) to authenticated;
grant execute on function public.is_space_member(uuid, uuid) to service_role;

revoke all on function public.is_space_admin(uuid, uuid) from public;
grant execute on function public.is_space_admin(uuid, uuid) to authenticated;
grant execute on function public.is_space_admin(uuid, uuid) to service_role;

-- space_members
drop policy if exists "space_members_select_member" on public.space_members;
create policy "space_members_select_member"
  on public.space_members
  for select
  using (public.is_space_member(space_members.space_id, auth.uid()));

drop policy if exists "space_members_insert" on public.space_members;
create policy "space_members_insert"
  on public.space_members
  for insert
  with check (
    (
      user_id = auth.uid()
      and exists (
        select 1 from public.spaces s
        where s.id = space_members.space_id
          and (s.join_mode = 'public' or s.owner_user_id = auth.uid())
      )
    )
    or public.is_space_admin(space_members.space_id, auth.uid())
  );

drop policy if exists "space_members_update" on public.space_members;
create policy "space_members_update"
  on public.space_members
  for update
  using (public.is_space_admin(space_members.space_id, auth.uid()))
  with check (public.is_space_admin(space_members.space_id, auth.uid()));

drop policy if exists "space_members_delete" on public.space_members;
create policy "space_members_delete"
  on public.space_members
  for delete
  using (
    user_id = auth.uid()
    or public.is_space_admin(space_members.space_id, auth.uid())
  );

-- space_join_requests
drop policy if exists "space_join_requests_select" on public.space_join_requests;
create policy "space_join_requests_select"
  on public.space_join_requests
  for select
  using (
    user_id = auth.uid()
    or public.is_space_admin(space_join_requests.space_id, auth.uid())
  );

drop policy if exists "space_join_requests_insert" on public.space_join_requests;
create policy "space_join_requests_insert"
  on public.space_join_requests
  for insert
  with check (user_id = auth.uid());

drop policy if exists "space_join_requests_update" on public.space_join_requests;
create policy "space_join_requests_update"
  on public.space_join_requests
  for update
  using (public.is_space_admin(space_join_requests.space_id, auth.uid()))
  with check (public.is_space_admin(space_join_requests.space_id, auth.uid()));

-- space_invites
drop policy if exists "space_invites_owner_admin" on public.space_invites;
create policy "space_invites_owner_admin"
  on public.space_invites
  for all
  using (public.is_space_admin(space_invites.space_id, auth.uid()))
  with check (public.is_space_admin(space_invites.space_id, auth.uid()));

-- space_messages
drop policy if exists "space_messages_member" on public.space_messages;
create policy "space_messages_member"
  on public.space_messages
  for all
  using (public.is_space_member(space_messages.space_id, auth.uid()))
  with check (public.is_space_member(space_messages.space_id, auth.uid()) and user_id = auth.uid());

-- space_threads
drop policy if exists "space_threads_member" on public.space_threads;
create policy "space_threads_member"
  on public.space_threads
  for all
  using (public.is_space_member(space_threads.space_id, auth.uid()))
  with check (public.is_space_member(space_threads.space_id, auth.uid()) and user_id = auth.uid());

-- space_thread_comments
drop policy if exists "space_thread_comments_member" on public.space_thread_comments;
create policy "space_thread_comments_member"
  on public.space_thread_comments
  for all
  using (
    exists (
      select 1 from public.space_threads t
      where t.id = space_thread_comments.thread_id
        and public.is_space_member(t.space_id, auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.space_threads t
      where t.id = space_thread_comments.thread_id
        and public.is_space_member(t.space_id, auth.uid())
    )
    and user_id = auth.uid()
  );

-- space_digests
drop policy if exists "space_digests_select_member" on public.space_digests;
create policy "space_digests_select_member"
  on public.space_digests
  for select
  using (public.is_space_member(space_digests.space_id, auth.uid()));

drop policy if exists "space_digests_owner_admin" on public.space_digests;
create policy "space_digests_owner_admin"
  on public.space_digests
  for all
  using (public.is_space_admin(space_digests.space_id, auth.uid()))
  with check (public.is_space_admin(space_digests.space_id, auth.uid()));

commit;

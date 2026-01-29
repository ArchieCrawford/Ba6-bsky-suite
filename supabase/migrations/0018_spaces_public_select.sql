-- =========================================================
-- BA6 Bsky Suite: allow public/moderated spaces to be selectable
-- =========================================================

begin;

drop policy if exists "spaces_select_member" on public.spaces;
drop policy if exists "spaces_select_member_or_public" on public.spaces;
create policy "spaces_select_member_or_public"
  on public.spaces
  for select
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from public.space_members m
      where m.space_id = spaces.id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
    or spaces.join_mode in ('public','moderated')
  );

commit;

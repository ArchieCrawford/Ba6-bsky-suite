-- =========================================================
-- BA6 Bsky Suite: Spaces + gate targets
-- =========================================================

begin;

-- Spaces
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  join_mode text not null default 'public' check (join_mode in ('public','moderated','invite_only')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists spaces_slug_unique on public.spaces (slug);
create index if not exists spaces_owner_user_id_idx on public.spaces (owner_user_id);

drop trigger if exists trg_spaces_updated_at on public.spaces;
create trigger trg_spaces_updated_at
before update on public.spaces
for each row execute function public.set_updated_at();

create table if not exists public.space_members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  status text not null default 'active' check (status in ('active','banned')),
  joined_at timestamptz not null default now()
);

create unique index if not exists space_members_unique on public.space_members (space_id, user_id);
create index if not exists space_members_space_id_idx on public.space_members (space_id);

create table if not exists public.space_join_requests (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique (space_id, user_id)
);

create index if not exists space_join_requests_feed_status_idx on public.space_join_requests (space_id, status);

create table if not exists public.space_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  code text not null,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz,
  max_uses int,
  uses int not null default 0,
  created_at timestamptz not null default now(),
  unique (code)
);

create index if not exists space_invites_space_id_idx on public.space_invites (space_id);

create table if not exists public.space_messages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists space_messages_space_id_idx on public.space_messages (space_id, created_at desc);

create table if not exists public.space_threads (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists space_threads_space_id_idx on public.space_threads (space_id, created_at desc);

drop trigger if exists trg_space_threads_updated_at on public.space_threads;
create trigger trg_space_threads_updated_at
before update on public.space_threads
for each row execute function public.set_updated_at();

create table if not exists public.space_thread_comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.space_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists space_thread_comments_thread_id_idx on public.space_thread_comments (thread_id, created_at asc);

create table if not exists public.space_digests (
  id uuid primary key default gen_random_uuid(),
  space_id uuid unique not null references public.spaces(id) on delete cascade,
  include_keywords text[] not null default '{}'::text[],
  exclude_keywords text[] not null default '{}'::text[],
  lang text,
  include_mode text not null default 'any' check (include_mode in ('any','all')),
  case_insensitive boolean not null default true,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_space_digests_updated_at on public.space_digests;
create trigger trg_space_digests_updated_at
before update on public.space_digests
for each row execute function public.set_updated_at();

-- RLS
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.space_join_requests enable row level security;
alter table public.space_invites enable row level security;
alter table public.space_messages enable row level security;
alter table public.space_threads enable row level security;
alter table public.space_thread_comments enable row level security;
alter table public.space_digests enable row level security;

drop policy if exists "spaces_select_member" on public.spaces;
create policy "spaces_select_member"
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
  );

drop policy if exists "spaces_insert_own" on public.spaces;
create policy "spaces_insert_own"
  on public.spaces
  for insert
  with check (owner_user_id = auth.uid());

drop policy if exists "spaces_update_own" on public.spaces;
create policy "spaces_update_own"
  on public.spaces
  for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "spaces_delete_own" on public.spaces;
create policy "spaces_delete_own"
  on public.spaces
  for delete
  using (owner_user_id = auth.uid());

drop policy if exists "space_members_select_member" on public.space_members;
create policy "space_members_select_member"
  on public.space_members
  for select
  using (
    exists (
      select 1 from public.space_members m
      where m.space_id = space_members.space_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

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
    or exists (
      select 1 from public.space_members m
      where m.space_id = space_members.space_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
  );

drop policy if exists "space_members_update" on public.space_members;
create policy "space_members_update"
  on public.space_members
  for update
  using (
    exists (
      select 1 from public.space_members m
      where m.space_id = space_members.space_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.space_members m
      where m.space_id = space_members.space_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
  );

drop policy if exists "space_members_delete" on public.space_members;
create policy "space_members_delete"
  on public.space_members
  for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.space_members m
      where m.space_id = space_members.space_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
  );

drop policy if exists "space_join_requests_select" on public.space_join_requests;
create policy "space_join_requests_select"
  on public.space_join_requests
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.space_members m
      where m.space_id = space_join_requests.space_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
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
  using (
    exists (
      select 1 from public.space_members m
      where m.space_id = space_join_requests.space_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.space_members m
      where m.space_id = space_join_requests.space_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
  );

drop policy if exists "space_invites_owner_admin" on public.space_invites;
create policy "space_invites_owner_admin"
  on public.space_invites
  for all
  using (
    exists (
      select 1 from public.space_members m
      where m.space_id = space_invites.space_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.space_members m
      where m.space_id = space_invites.space_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
  );

drop policy if exists "space_messages_member" on public.space_messages;
create policy "space_messages_member"
  on public.space_messages
  for all
  using (
    exists (
      select 1 from public.space_members m
      where m.space_id = space_messages.space_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.space_members m
      where m.space_id = space_messages.space_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
    and user_id = auth.uid()
  );

drop policy if exists "space_threads_member" on public.space_threads;
create policy "space_threads_member"
  on public.space_threads
  for all
  using (
    exists (
      select 1 from public.space_members m
      where m.space_id = space_threads.space_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.space_members m
      where m.space_id = space_threads.space_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
    and user_id = auth.uid()
  );

drop policy if exists "space_thread_comments_member" on public.space_thread_comments;
create policy "space_thread_comments_member"
  on public.space_thread_comments
  for all
  using (
    exists (
      select 1 from public.space_members m
      where m.space_id = (select space_id from public.space_threads t where t.id = space_thread_comments.thread_id)
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.space_members m
      where m.space_id = (select space_id from public.space_threads t where t.id = space_thread_comments.thread_id)
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
    and user_id = auth.uid()
  );

drop policy if exists "space_digests_select_member" on public.space_digests;
create policy "space_digests_select_member"
  on public.space_digests
  for select
  using (
    exists (
      select 1 from public.space_members m
      where m.space_id = space_digests.space_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

drop policy if exists "space_digests_owner_admin" on public.space_digests;
create policy "space_digests_owner_admin"
  on public.space_digests
  for all
  using (
    exists (
      select 1 from public.space_members m
      where m.space_id = space_digests.space_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.space_members m
      where m.space_id = space_digests.space_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
  );

-- Feed gates: add target_type + space_id
alter table public.feed_gates
  add column if not exists target_type text not null default 'feed';

alter table public.feed_gates
  add column if not exists space_id uuid references public.spaces(id) on delete cascade;

update public.feed_gates
set target_type = 'feed'
where target_type is null;

alter table public.feed_gates
  alter column feed_id drop not null;

create index if not exists feed_gates_space_id_idx on public.feed_gates (space_id);
create index if not exists feed_gates_target_type_idx on public.feed_gates (target_type);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.feed_gates'::regclass
      and conname = 'feed_gates_gate_type_check'
  ) then
    execute 'alter table public.feed_gates drop constraint feed_gates_gate_type_check';
  end if;

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
      and conname = 'feed_gates_target_type_check'
  ) then
    execute 'alter table public.feed_gates add constraint feed_gates_target_type_check check (target_type in (''feed'',''space''))';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.feed_gates'::regclass
      and conname = 'feed_gates_target_ref_check'
  ) then
    execute 'alter table public.feed_gates add constraint feed_gates_target_ref_check check ((target_type = ''feed'' and feed_id is not null and space_id is null) or (target_type = ''space'' and space_id is not null and feed_id is null))';
  end if;
end $$;

drop policy if exists "feed_gates_via_feeds" on public.feed_gates;
drop policy if exists "feed_gates_via_target" on public.feed_gates;
create policy "feed_gates_via_target"
  on public.feed_gates
  for all
  using (
    (target_type = 'feed' and exists (
      select 1 from public.feeds f
      where f.id = feed_gates.feed_id and f.user_id = auth.uid()
    ))
    or (target_type = 'space' and exists (
      select 1 from public.space_members m
      where m.space_id = feed_gates.space_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    ))
  )
  with check (
    (target_type = 'feed' and exists (
      select 1 from public.feeds f
      where f.id = feed_gates.feed_id and f.user_id = auth.uid()
    ))
    or (target_type = 'space' and exists (
      select 1 from public.space_members m
      where m.space_id = feed_gates.space_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    ))
  );

commit;

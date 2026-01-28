-- =========================================================
-- BA6 Bsky Suite: migrate legacy tables to users/accounts
-- Option A: migrate + drop legacy tables
-- Safe to run multiple times
-- =========================================================

begin;

-- 1) Migrate public.profiles -> public.users (insert missing rows)
do $$
declare
  has_profiles boolean;
  has_users boolean;
  has_display boolean;
  has_created boolean;
  has_updated boolean;
  cols text := 'id';
  sels text := 'id';
begin
  select exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'profiles'
  ) into has_profiles;
  select exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'users'
  ) into has_users;

  if not has_profiles or not has_users then
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'display_name'
  ) into has_display;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'created_at'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'created_at'
  ) into has_created;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'updated_at'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'updated_at'
  ) into has_updated;

  if has_display then
    cols := cols || ', display_name';
    sels := sels || ', display_name';
  end if;
  if has_created then
    cols := cols || ', created_at';
    sels := sels || ', created_at';
  end if;
  if has_updated then
    cols := cols || ', updated_at';
    sels := sels || ', updated_at';
  end if;

  execute format(
    'insert into public.users (%s) select %s from public.profiles on conflict (id) do nothing',
    cols,
    sels
  );
end $$;

-- 2) Migrate public.bsky_accounts -> public.accounts (insert missing rows)
do $$
declare
  has_source boolean;
  has_target boolean;
  user_id_col text;
  did_col text;
  has_handle boolean;
  has_label boolean;
  has_is_active boolean;
  has_created boolean;
  has_updated boolean;
  has_app_password boolean;
  cols text := 'user_id, account_did';
  sels text;
begin
  select exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'bsky_accounts'
  ) into has_source;
  select exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'accounts'
  ) into has_target;

  if not has_source or not has_target then
    return;
  end if;

  -- Find user_id column name in legacy table
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bsky_accounts' and column_name = 'user_id'
  ) then
    user_id_col := 'user_id';
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bsky_accounts' and column_name = 'profile_id'
  ) then
    user_id_col := 'profile_id';
  else
    return;
  end if;

  -- Find DID column name in legacy table
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bsky_accounts' and column_name = 'account_did'
  ) then
    did_col := 'account_did';
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bsky_accounts' and column_name = 'did'
  ) then
    did_col := 'did';
  else
    return;
  end if;

  sels := format('%I, %I', user_id_col, did_col);

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bsky_accounts' and column_name = 'handle'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'handle'
  ) into has_handle;
  if has_handle then
    cols := cols || ', handle';
    sels := sels || ', handle';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bsky_accounts' and column_name = 'label'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'label'
  ) into has_label;
  if has_label then
    cols := cols || ', label';
    sels := sels || ', label';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bsky_accounts' and column_name = 'is_active'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'is_active'
  ) into has_is_active;
  if has_is_active then
    cols := cols || ', is_active';
    sels := sels || ', is_active';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bsky_accounts' and column_name = 'created_at'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'created_at'
  ) into has_created;
  if has_created then
    cols := cols || ', created_at';
    sels := sels || ', created_at';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bsky_accounts' and column_name = 'updated_at'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'updated_at'
  ) into has_updated;
  if has_updated then
    cols := cols || ', updated_at';
    sels := sels || ', updated_at';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bsky_accounts' and column_name = 'app_password'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'app_password'
  ) into has_app_password;
  if has_app_password then
    cols := cols || ', app_password';
    sels := sels || ', app_password';
  end if;

  execute format(
    'insert into public.accounts (%s) select %s from public.bsky_accounts where %I is not null and %I is not null on conflict (user_id, account_did) do nothing',
    cols,
    sels,
    user_id_col,
    did_col
  );
end $$;

-- 3) Drop legacy tables (uncomment if you want to keep them)
drop table if exists public.bsky_sessions cascade;
drop table if exists public.bsky_accounts cascade;
drop table if exists public.profiles cascade;

commit;

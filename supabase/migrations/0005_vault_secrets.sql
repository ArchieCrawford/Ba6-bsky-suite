-- =========================================================
-- BA6 Bsky Suite: Vault-backed account secrets
-- =========================================================

begin;

create extension if not exists supabase_vault;

alter table public.accounts
  add column if not exists vault_secret_id uuid;

create or replace function public.create_account_secret(
  secret text,
  name text default null,
  description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_id uuid;
  jwt_role text := current_setting('request.jwt.claim.role', true);
begin
  if auth.uid() is null and jwt_role is distinct from 'service_role' then
    raise exception 'Not authenticated';
  end if;

  select vault.create_secret(secret, name, description) into secret_id;
  return secret_id;
end;
$$;

revoke all on function public.create_account_secret(text, text, text) from public;
grant execute on function public.create_account_secret(text, text, text) to authenticated;
grant execute on function public.create_account_secret(text, text, text) to service_role;

create or replace function public.get_account_secret(account_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_id uuid;
  decrypted text;
  jwt_role text := current_setting('request.jwt.claim.role', true);
begin
  if auth.uid() is null and jwt_role is distinct from 'service_role' then
    raise exception 'Not authenticated';
  end if;

  select a.vault_secret_id
  into secret_id
  from public.accounts a
  where a.id = account_id
    and (a.user_id = auth.uid() or jwt_role = 'service_role');

  if secret_id is null then
    return null;
  end if;

  select decrypted_secret
  into decrypted
  from vault.decrypted_secrets
  where id = secret_id;

  return decrypted;
end;
$$;

revoke all on function public.get_account_secret(uuid) from public;
grant execute on function public.get_account_secret(uuid) to authenticated;
grant execute on function public.get_account_secret(uuid) to service_role;

commit;

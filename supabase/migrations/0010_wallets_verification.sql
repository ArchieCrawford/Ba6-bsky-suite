-- =========================================================
-- BA6 Bsky Suite: wallets + verification
-- =========================================================

begin;

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chain text not null,
  address text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.wallets
  add column if not exists user_id uuid,
  add column if not exists chain text,
  add column if not exists address text,
  add column if not exists is_default boolean,
  add column if not exists created_at timestamptz,
  add column if not exists provider text default 'wallet',
  add column if not exists network text,
  add column if not exists magic_issuer text,
  add column if not exists magic_user_id text,
  add column if not exists is_verified boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

update public.wallets
set chain = 'evm'
where lower(chain) in ('ethereum', 'eth', 'eip155');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.wallets'::regclass
      and conname = 'wallets_chain_check'
  ) then
    execute 'alter table public.wallets add constraint wallets_chain_check check (chain in (''evm'',''solana''))';
  end if;
end $$;

create unique index if not exists wallets_user_chain_address_unique
  on public.wallets (user_id, chain, address);

create unique index if not exists wallets_one_default_per_user
  on public.wallets (user_id)
  where is_default = true;

alter table public.wallets enable row level security;

drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own"
  on public.wallets for select
  using (user_id = auth.uid());

drop policy if exists "wallets_insert_own" on public.wallets;
create policy "wallets_insert_own"
  on public.wallets for insert
  with check (user_id = auth.uid());

drop policy if exists "wallets_update_own" on public.wallets;
create policy "wallets_update_own"
  on public.wallets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "wallets_delete_own" on public.wallets;
create policy "wallets_delete_own"
  on public.wallets for delete
  using (user_id = auth.uid());

create table if not exists public.wallet_verifications (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  nonce text not null,
  message text not null,
  signature text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.wallet_verifications enable row level security;

drop policy if exists "wallet_verifications_select_own" on public.wallet_verifications;
create policy "wallet_verifications_select_own"
  on public.wallet_verifications for select
  using (
    exists (
      select 1 from public.wallets w
      where w.id = wallet_verifications.wallet_id
        and w.user_id = auth.uid()
    )
  );

drop policy if exists "wallet_verifications_insert_own" on public.wallet_verifications;
create policy "wallet_verifications_insert_own"
  on public.wallet_verifications for insert
  with check (
    exists (
      select 1 from public.wallets w
      where w.id = wallet_verifications.wallet_id
        and w.user_id = auth.uid()
    )
  );

drop policy if exists "wallet_verifications_update_own" on public.wallet_verifications;
create policy "wallet_verifications_update_own"
  on public.wallet_verifications for update
  using (
    exists (
      select 1 from public.wallets w
      where w.id = wallet_verifications.wallet_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.wallets w
      where w.id = wallet_verifications.wallet_id
        and w.user_id = auth.uid()
    )
  );

drop policy if exists "wallet_verifications_delete_own" on public.wallet_verifications;
create policy "wallet_verifications_delete_own"
  on public.wallet_verifications for delete
  using (
    exists (
      select 1 from public.wallets w
      where w.id = wallet_verifications.wallet_id
        and w.user_id = auth.uid()
    )
  );

commit;

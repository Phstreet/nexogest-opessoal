-- Additive relational support for every legacy JSONB collection.
-- A fresh private snapshot was verified before this migration; no legacy rows are modified here.
do $$
declare
  v_source integer;
  v_snapshot integer;
  v_exact integer;
begin
  select count(*) into v_source from public.nexo_user_data;
  select count(*) into v_snapshot
    from nexo_private_backup.nexo_user_data_snapshot_20261126_181600;
  select count(*) into v_exact
    from public.nexo_user_data s
    join nexo_private_backup.nexo_user_data_snapshot_20261126_181600 b
      using (user_id, data_key, payload, revision, updated_at);
  if v_source <> v_snapshot or v_source <> v_exact then
    raise exception 'Legacy snapshot mismatch; aborting relational extension. source %, snapshot %, exact %',
      v_source, v_snapshot, v_exact;
  end if;
end $$;

alter table public.nexo_profiles
  add column if not exists sex text,
  add column if not exists full_name text,
  add column if not exists birth_date date,
  add column if not exists profession text,
  add column if not exists monthly_income_cents bigint,
  add column if not exists legacy_payload jsonb not null default '{}'::jsonb;

alter table public.nexo_accounts
  add column if not exists legacy_id text,
  add column if not exists legacy_payload jsonb not null default '{}'::jsonb;

create unique index if not exists nexo_accounts_user_legacy_id_uidx
  on public.nexo_accounts(user_id, legacy_id)
  where legacy_id is not null;

alter table public.nexo_transactions_relational
  add column if not exists legacy_id text,
  add column if not exists subcategory text,
  add column if not exists payment_method text,
  add column if not exists settled_amount_cents bigint,
  add column if not exists recurrence text,
  add column if not exists recurrence_group_id text,
  add column if not exists legacy_payload jsonb not null default '{}'::jsonb;

create unique index if not exists nexo_transactions_user_legacy_id_uidx
  on public.nexo_transactions_relational(user_id, legacy_id)
  where legacy_id is not null;

alter table public.nexo_routine_items
  add column if not exists source_key text,
  add column if not exists legacy_id text,
  add column if not exists legacy_payload jsonb not null default '{}'::jsonb;

create unique index if not exists nexo_routine_user_source_legacy_uidx
  on public.nexo_routine_items(user_id, source_key, legacy_id)
  where source_key is not null and legacy_id is not null;

create table if not exists public.nexo_reserves_relational (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  account_id uuid,
  name text not null check (length(trim(name)) between 1 and 200),
  description text,
  category text,
  institution text,
  initial_balance_cents bigint not null default 0,
  target_amount_cents bigint not null default 0,
  monthly_contribution_cents bigint not null default 0,
  start_date date,
  target_date date,
  status text not null default 'active',
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, id),
  unique(user_id, legacy_id),
  foreign key(user_id, account_id) references public.nexo_accounts(user_id, id)
);

create table if not exists public.nexo_reserve_movements_relational (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  reserve_id uuid,
  amount_cents bigint not null default 0,
  movement_type text not null default 'contribution',
  occurred_at timestamptz,
  description text,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, id),
  unique(user_id, legacy_id),
  foreign key(user_id, reserve_id)
    references public.nexo_reserves_relational(user_id, id)
);

create table if not exists public.nexo_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  legacy_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array[
    'nexo_reserves_relational',
    'nexo_reserve_movements_relational',
    'nexo_preferences'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('drop policy if exists owner_select on public.%I', t);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('drop policy if exists owner_insert on public.%I', t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('drop policy if exists owner_update on public.%I', t);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('drop policy if exists owner_delete on public.%I', t);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

create index if not exists nexo_reserves_user_account_idx
  on public.nexo_reserves_relational(user_id, account_id);
create index if not exists nexo_reserve_movements_user_reserve_idx
  on public.nexo_reserve_movements_relational(user_id, reserve_id);

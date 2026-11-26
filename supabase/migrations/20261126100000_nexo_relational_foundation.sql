-- NEXO release foundation: additive relational schema, isolated per owner.
-- Existing JSONB storage remains intact; no data is deleted or migrated in this phase.
create schema if not exists nexo_private;

create table if not exists public.nexo_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.nexo_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  account_type text not null check (account_type in ('checking','savings','cash','credit','investment','other')),
  currency char(3) not null default 'BRL',
  opening_balance_cents bigint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,id)
);
create table if not exists public.nexo_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  kind text not null check (kind in ('income','expense')),
  created_at timestamptz not null default now(),
  unique(user_id,name,kind), unique(user_id,id)
);
create table if not exists public.nexo_transactions_relational (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid,
  category_id uuid,
  description text not null check (length(trim(description)) between 1 and 500),
  amount_cents bigint not null check (amount_cents > 0),
  kind text not null check (kind in ('income','expense')),
  occurred_on date not null,
  status text not null default 'posted' check (status in ('posted','pending','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(user_id,account_id) references public.nexo_accounts(user_id,id),
  foreign key(user_id,category_id) references public.nexo_categories(user_id,id)
);
create table if not exists public.nexo_goals_relational (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  target_cents bigint check (target_cents is null or target_cents >= 0),
  current_cents bigint not null default 0 check (current_cents >= 0),
  due_on date,
  status text not null default 'active' check (status in ('active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.nexo_routine_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('task','habit','event')),
  title text not null check (length(trim(title)) between 1 and 200),
  scheduled_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['nexo_profiles','nexo_accounts','nexo_categories','nexo_transactions_relational','nexo_goals_relational','nexo_routine_items'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon, public',t);
    execute format('grant select,insert,update,delete on table public.%I to authenticated',t);
    execute format('drop policy if exists owner_select on public.%I',t);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)',t);
    execute format('drop policy if exists owner_insert on public.%I',t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',t);
    execute format('drop policy if exists owner_update on public.%I',t);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',t);
    execute format('drop policy if exists owner_delete on public.%I',t);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',t);
  end loop;
end $$;

create index if not exists nexo_accounts_user_idx on public.nexo_accounts(user_id);
create index if not exists nexo_categories_user_idx on public.nexo_categories(user_id);
create index if not exists nexo_transactions_user_date_idx on public.nexo_transactions_relational(user_id,occurred_on);
create index if not exists nexo_goals_user_idx on public.nexo_goals_relational(user_id);
create index if not exists nexo_routine_user_sched_idx on public.nexo_routine_items(user_id,scheduled_at);

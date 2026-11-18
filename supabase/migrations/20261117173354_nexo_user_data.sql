-- NEXO: armazenamento multi-dispositivo por usuário.
-- Aplicar no SQL Editor do projeto Supabase após revisar este arquivo.
-- Esta migration não altera nem apaga os dados locais existentes.

create table if not exists public.nexo_user_data (
  user_id uuid not null references auth.users (id) on delete cascade,
  data_key text not null,
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint nexo_user_data_pkey primary key (user_id, data_key),
  constraint nexo_user_data_allowed_key check (
    data_key in (
      'nexo_transactions',
      'nexo_accounts',
      'nexo_reserves',
      'nexo_reserve_movements',
      'nexo_tasks',
      'nexo_habits',
      'nexo_preferences',
      'nexo_profile'
    )
  )
);

alter table public.nexo_user_data enable row level security;

revoke all on table public.nexo_user_data from anon, public;
grant select, insert, update, delete on table public.nexo_user_data to authenticated;

drop policy if exists "NEXO users read own data" on public.nexo_user_data;
create policy "NEXO users read own data"
  on public.nexo_user_data
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "NEXO users insert own data" on public.nexo_user_data;
create policy "NEXO users insert own data"
  on public.nexo_user_data
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "NEXO users update own data" on public.nexo_user_data;
create policy "NEXO users update own data"
  on public.nexo_user_data
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "NEXO users delete own data" on public.nexo_user_data;
create policy "NEXO users delete own data"
  on public.nexo_user_data
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Gravação com controle otimista de concorrência.
-- expected_revision = 0 cria um registro inexistente.
-- Para atualizar, o cliente precisa informar a revisão que leu.
create or replace function public.save_nexo_user_data(
  p_data_key text,
  p_payload jsonb,
  p_expected_revision bigint
)
returns table (
  saved boolean,
  current_revision bigint,
  current_updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_revision bigint;
  v_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Autenticação obrigatória para salvar dados do NEXO.';
  end if;

  if p_data_key not in (
    'nexo_transactions',
    'nexo_accounts',
    'nexo_reserves',
    'nexo_reserve_movements',
    'nexo_tasks',
    'nexo_habits',
    'nexo_preferences',
    'nexo_profile'
  ) then
    raise exception 'Chave de dados não permitida para sincronização.';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Revisão esperada inválida.';
  end if;

  if p_expected_revision = 0 then
    insert into public.nexo_user_data (user_id, data_key, payload, revision)
    values (v_user_id, p_data_key, p_payload, 1)
    on conflict (user_id, data_key) do nothing
    returning revision, updated_at into v_revision, v_updated_at;

    if found then
      return query select true, v_revision, v_updated_at;
      return;
    end if;
  end if;

  update public.nexo_user_data as stored
     set payload = p_payload,
         revision = stored.revision + 1,
         updated_at = now()
   where stored.user_id = v_user_id
     and stored.data_key = p_data_key
     and stored.revision = p_expected_revision
  returning stored.revision, stored.updated_at
       into v_revision, v_updated_at;

  if found then
    return query select true, v_revision, v_updated_at;
    return;
  end if;

  select stored.revision, stored.updated_at
    into v_revision, v_updated_at
    from public.nexo_user_data as stored
   where stored.user_id = v_user_id
     and stored.data_key = p_data_key;

  return query select false, v_revision, v_updated_at;
end;
$$;

revoke all on function public.save_nexo_user_data(text, jsonb, bigint) from public, anon;
grant execute on function public.save_nexo_user_data(text, jsonb, bigint) to authenticated;

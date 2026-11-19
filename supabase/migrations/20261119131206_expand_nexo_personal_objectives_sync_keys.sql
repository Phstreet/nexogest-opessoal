-- Amplia as coleções permitidas pelo armazenamento sincronizado do NEXO.
-- Necessário para objetivos pessoais, planejamento e backups de tarefas.
-- Mantém RLS, políticas por auth.uid() e controle otimista de revisão.

alter table public.nexo_user_data
  drop constraint if exists nexo_user_data_allowed_key;

alter table public.nexo_user_data
  add constraint nexo_user_data_allowed_key
  check (data_key = any (array[
    'nexo_transactions',
    'nexo_accounts',
    'nexo_reserves',
    'nexo_reserve_movements',
    'nexo_tasks',
    'nexo_habits',
    'nexo_preferences',
    'nexo_profile',
    'nexo_planning_budgets',
    'nexo_planning_goals',
    'nexo_personal_goals',
    'nexo_task_backups'
  ]::text[]));

create or replace function public.save_nexo_user_data(
  p_data_key text,
  p_payload jsonb,
  p_expected_revision bigint
)
returns table(saved boolean, current_revision bigint, current_updated_at timestamptz)
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_revision bigint;
  v_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Autenticação obrigatória para salvar dados do NEXO.';
  end if;

  if p_data_key not in (
    'nexo_transactions','nexo_accounts','nexo_reserves','nexo_reserve_movements',
    'nexo_tasks','nexo_habits','nexo_preferences','nexo_profile',
    'nexo_planning_budgets','nexo_planning_goals','nexo_personal_goals','nexo_task_backups'
  ) then
    raise exception 'Chave de dados não permitida para sincronização.';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Revisão esperada inválida.';
  end if;

  if p_expected_revision = 0 then
    insert into public.nexo_user_data(user_id,data_key,payload,revision)
    values(v_user_id,p_data_key,p_payload,1)
    on conflict(user_id,data_key) do nothing
    returning revision,updated_at into v_revision,v_updated_at;

    if found then
      return query select true,v_revision,v_updated_at;
      return;
    end if;
  end if;

  update public.nexo_user_data as stored
  set payload=p_payload,revision=stored.revision+1,updated_at=now()
  where stored.user_id=v_user_id
    and stored.data_key=p_data_key
    and stored.revision=p_expected_revision
  returning stored.revision,stored.updated_at into v_revision,v_updated_at;

  if found then
    return query select true,v_revision,v_updated_at;
    return;
  end if;

  select stored.revision,stored.updated_at into v_revision,v_updated_at
  from public.nexo_user_data as stored
  where stored.user_id=v_user_id and stored.data_key=p_data_key;

  return query select false,v_revision,v_updated_at;
end;
$function$;

revoke all on function public.save_nexo_user_data(text,jsonb,bigint) from public, anon;
grant execute on function public.save_nexo_user_data(text,jsonb,bigint) to authenticated;

-- Atomic JSONB + relational writes. The application invokes this only when
-- NEXO_RELATIONAL_STORAGE_ENABLED=true; setting it false reverts to JSONB.
create or replace function public.save_nexo_user_data_relational(
  p_data_key text,
  p_payload jsonb,
  p_expected_revision bigint
)
returns table(saved boolean,current_revision bigint,current_updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_result record;
  v_row_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Autenticação obrigatória para salvar dados do NEXO.';
  end if;

  if p_data_key = any(array[
    'nexo_accounts','nexo_transactions','nexo_tasks','nexo_habits',
    'nexo_reserves','nexo_reserve_movements'
  ]) and jsonb_typeof(p_payload) <> 'array' then
    raise exception 'A coleção relacional precisa ser um array JSON.';
  end if;

  if p_data_key = any(array['nexo_profile','nexo_preferences'])
    and jsonb_typeof(p_payload) <> 'object' then
    raise exception 'O documento relacional precisa ser um objeto JSON.';
  end if;

  -- Optimistic concurrency and JSONB write happen first in the same transaction.
  select * into v_result
  from public.save_nexo_user_data(p_data_key,p_payload,p_expected_revision);

  if not v_result.saved then
    return query select v_result.saved,v_result.current_revision,v_result.current_updated_at;
    return;
  end if;

  -- Collections not yet normalized continue to use the legacy JSONB repository.
  if p_data_key not in (
    'nexo_accounts','nexo_transactions','nexo_tasks','nexo_habits',
    'nexo_reserves','nexo_reserve_movements','nexo_profile','nexo_preferences'
  ) then
    return query select v_result.saved,v_result.current_revision,v_result.current_updated_at;
    return;
  end if;

  if p_data_key = 'nexo_accounts' then
    insert into public.nexo_accounts (
      user_id,legacy_id,legacy_position,name,account_type,currency,
      opening_balance_cents,archived,institution,is_primary,legacy_payload,deleted_at
    )
    select
      v_user_id,e->>'id',ordinality::integer,left(trim(e->>'name'),120),
      case
        when lower(coalesce(e->>'type','')) like '%corrente%' or lower(coalesce(e->>'type','')) like '%checking%' then 'checking'
        when lower(coalesce(e->>'type','')) like '%poup%' or lower(coalesce(e->>'type','')) like '%savings%' then 'savings'
        when lower(coalesce(e->>'type','')) like '%dinheiro%' or lower(coalesce(e->>'type','')) like '%cash%' then 'cash'
        when lower(coalesce(e->>'type','')) like '%credito%' or lower(coalesce(e->>'type','')) like '%credit%' or lower(coalesce(e->>'type','')) like '%cart%' then 'credit'
        when lower(coalesce(e->>'type','')) like '%invest%' then 'investment'
        else 'other'
      end,
      'BRL',round((e->>'initialBalance')::numeric*100)::bigint,
      not coalesce((e->>'active')::boolean,true),
      nullif(trim(e->>'institution'),''),coalesce((e->>'isPrimary')::boolean,false),e,null
    from jsonb_array_elements(p_payload) with ordinality as x(e,ordinality)
    on conflict (user_id,legacy_id) where legacy_id is not null
    do update set
      legacy_position=excluded.legacy_position,name=excluded.name,
      account_type=excluded.account_type,currency=excluded.currency,
      opening_balance_cents=excluded.opening_balance_cents,
      archived=excluded.archived,institution=excluded.institution,
      is_primary=excluded.is_primary,legacy_payload=excluded.legacy_payload,
      deleted_at=null,updated_at=now();

    update public.nexo_accounts a
    set deleted_at=now(),updated_at=now()
    where a.user_id=v_user_id and a.legacy_id is not null and a.deleted_at is null
      and not exists (
        select 1 from jsonb_array_elements(p_payload) e where e->>'id'=a.legacy_id
      );

    select count(*) into v_row_count from public.nexo_accounts
    where user_id=v_user_id and legacy_id is not null and deleted_at is null;

  elsif p_data_key = 'nexo_transactions' then
    with tx as (
      select e,
        case when lower(coalesce(e->>'type','')) like '%receit%'
          or lower(coalesce(e->>'type',''))='income' then 'income' else 'expense' end as kind
      from jsonb_array_elements(p_payload) e
    )
    insert into public.nexo_categories(user_id,name,kind)
    select distinct v_user_id,left(trim(e->>'category'),120),kind
    from tx where nullif(trim(e->>'category'),'') is not null
    on conflict(user_id,name,kind) do nothing;

    with tx as (
      select e,ordinality::integer as position,
        case when lower(coalesce(e->>'type','')) like '%receit%'
          or lower(coalesce(e->>'type',''))='income' then 'income' else 'expense' end as kind,
        case
          when lower(coalesce(e->>'status','')) in ('cancelada','cancelado','cancelled') then 'cancelled'
          when lower(coalesce(e->>'status','')) in ('pendente','pending') then 'pending'
          else 'posted'
        end as mapped_status,
        case
          when (e->>'date') ~ '^\d{4}-\d{2}-\d{2}$' then (e->>'date')::date
          when (e->>'date') ~ '^\d{2}/\d{2}/\d{4}$' then to_date(e->>'date','DD/MM/YYYY')
          else null
        end as mapped_date
      from jsonb_array_elements(p_payload) with ordinality as x(e,ordinality)
    )
    insert into public.nexo_transactions_relational(
      user_id,legacy_id,legacy_position,account_id,category_id,description,
      amount_cents,kind,occurred_on,status,subcategory,payment_method,
      settled_amount_cents,recurrence,recurrence_group_id,legacy_payload
    )
    select
      v_user_id,t.e->>'id',t.position,a.id,c.id,
      left(coalesce(nullif(trim(t.e->>'description'),''),'Sem descrição'),500),
      round((t.e->>'amount')::numeric*100)::bigint,t.kind,t.mapped_date,t.mapped_status,
      nullif(trim(t.e->>'subcategory'),''),nullif(trim(t.e->>'paymentMethod'),''),
      case when jsonb_typeof(t.e->'settledAmount')='number'
        then round((t.e->>'settledAmount')::numeric*100)::bigint else null end,
      nullif(t.e->>'recurrence',''),nullif(t.e->>'recurrenceGroupId',''),t.e
    from tx t
    left join public.nexo_accounts a
      on a.user_id=v_user_id and a.deleted_at is null
      and lower(trim(a.name))=lower(trim(t.e->>'account'))
    left join public.nexo_categories c
      on c.user_id=v_user_id and c.name=left(trim(t.e->>'category'),120) and c.kind=t.kind
    on conflict (user_id,legacy_id) where legacy_id is not null
    do update set
      legacy_position=excluded.legacy_position,account_id=excluded.account_id,
      category_id=excluded.category_id,description=excluded.description,
      amount_cents=excluded.amount_cents,kind=excluded.kind,
      occurred_on=excluded.occurred_on,status=excluded.status,
      subcategory=excluded.subcategory,payment_method=excluded.payment_method,
      settled_amount_cents=excluded.settled_amount_cents,
      recurrence=excluded.recurrence,recurrence_group_id=excluded.recurrence_group_id,
      legacy_payload=excluded.legacy_payload,updated_at=now();

    delete from public.nexo_transactions_relational t
    where t.user_id=v_user_id and t.legacy_id is not null
      and not exists(select 1 from jsonb_array_elements(p_payload) e where e->>'id'=t.legacy_id);
    select count(*) into v_row_count from public.nexo_transactions_relational
    where user_id=v_user_id and legacy_id is not null;

  elsif p_data_key = 'nexo_tasks' then
    with source as (
      select e,ordinality::integer as position,
        case
          when (e->>'date') ~ '^\d{4}-\d{2}-\d{2}$' then (e->>'date')::date
          when (e->>'date') ~ '^\d{2}/\d{2}/\d{4}$' then to_date(e->>'date','DD/MM/YYYY')
          else null
        end as scheduled_date,
        case when (e->>'time') ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
          then (e->>'time')::time else time '00:00' end as scheduled_time
      from jsonb_array_elements(p_payload) with ordinality as x(e,ordinality)
    )
    insert into public.nexo_routine_items(
      user_id,item_type,title,scheduled_at,completed_at,completed,active,
      metadata,source_key,legacy_id,legacy_position,legacy_payload
    )
    select
      v_user_id,'task',left(coalesce(nullif(trim(e->>'description'),''),'Tarefa sem título'),200),
      case when scheduled_date is not null
        then (scheduled_date+scheduled_time) at time zone 'America/Sao_Paulo' else null end,
      null,coalesce((e->>'done')::boolean,false),true,
      jsonb_build_object('category',e->'category','notes',e->'notes','priority',e->'priority','time',e->'time'),
      'nexo_tasks',e->>'id',position,e
    from source
    on conflict(user_id,source_key,legacy_id)
      where source_key is not null and legacy_id is not null
    do update set
      title=excluded.title,scheduled_at=excluded.scheduled_at,
      completed=excluded.completed,active=excluded.active,
      metadata=excluded.metadata,legacy_position=excluded.legacy_position,
      legacy_payload=excluded.legacy_payload,updated_at=now();

    delete from public.nexo_routine_items r
    where r.user_id=v_user_id and r.source_key='nexo_tasks' and r.legacy_id is not null
      and not exists(select 1 from jsonb_array_elements(p_payload) e where e->>'id'=r.legacy_id);
    select count(*) into v_row_count from public.nexo_routine_items
    where user_id=v_user_id and source_key='nexo_tasks' and legacy_id is not null;

  elsif p_data_key = 'nexo_habits' then
    insert into public.nexo_routine_items(
      user_id,item_type,title,scheduled_at,completed_at,completed,active,
      metadata,source_key,legacy_id,legacy_position,legacy_payload
    )
    select
      v_user_id,'habit',left(coalesce(nullif(trim(e->>'name'),''),'Hábito sem nome'),200),
      null,null,false,coalesce((e->>'active')::boolean,true),
      jsonb_build_object(
        'category',e->'category','frequency',e->'frequency',
        'completedDates',e->'completedDates','notes',e->'notes','time',e->'time'
      ),
      'nexo_habits',e->>'id',ordinality::integer,e
    from jsonb_array_elements(p_payload) with ordinality as x(e,ordinality)
    on conflict(user_id,source_key,legacy_id)
      where source_key is not null and legacy_id is not null
    do update set
      title=excluded.title,active=excluded.active,metadata=excluded.metadata,
      legacy_position=excluded.legacy_position,legacy_payload=excluded.legacy_payload,
      updated_at=now();

    delete from public.nexo_routine_items r
    where r.user_id=v_user_id and r.source_key='nexo_habits' and r.legacy_id is not null
      and not exists(select 1 from jsonb_array_elements(p_payload) e where e->>'id'=r.legacy_id);
    select count(*) into v_row_count from public.nexo_routine_items
    where user_id=v_user_id and source_key='nexo_habits' and legacy_id is not null;

  elsif p_data_key = 'nexo_reserves' then
    with source as (
      select e,ordinality::integer as position,
        case
          when (e->>'startDate') ~ '^\d{4}-\d{2}-\d{2}$' then (e->>'startDate')::date
          when (e->>'startDate') ~ '^\d{2}/\d{2}/\d{4}$' then to_date(e->>'startDate','DD/MM/YYYY')
          else null
        end as mapped_start_date,
        case
          when (e->>'targetDate') ~ '^\d{4}-\d{2}-\d{2}$' then (e->>'targetDate')::date
          when (e->>'targetDate') ~ '^\d{2}/\d{2}/\d{4}$' then to_date(e->>'targetDate','DD/MM/YYYY')
          else null
        end as mapped_target_date
      from jsonb_array_elements(p_payload) with ordinality as x(e,ordinality)
    )
    insert into public.nexo_reserves_relational(
      user_id,legacy_id,legacy_position,account_id,name,description,category,institution,
      initial_balance_cents,target_amount_cents,monthly_contribution_cents,
      start_date,target_date,status,legacy_payload,deleted_at
    )
    select
      v_user_id,e->>'id',position,a.id,left(trim(e->>'name'),200),
      nullif(trim(e->>'description'),''),nullif(trim(e->>'category'),''),
      nullif(trim(e->>'institution'),''),
      round((e->>'initialBalance')::numeric*100)::bigint,
      round((e->>'targetAmount')::numeric*100)::bigint,
      round((e->>'monthlyContribution')::numeric*100)::bigint,
      mapped_start_date,mapped_target_date,
      case
        when lower(coalesce(e->>'status','')) in ('completed','concluida','concluída') then 'completed'
        when lower(coalesce(e->>'status','')) in ('paused','pausada') then 'paused'
        when lower(coalesce(e->>'status','')) in ('archived','arquivada') then 'archived'
        else 'active'
      end,e,null
    from source
    left join public.nexo_accounts a
      on a.user_id=v_user_id and a.legacy_id=e->>'accountId' and a.deleted_at is null
    on conflict(user_id,legacy_id)
    do update set
      legacy_position=excluded.legacy_position,account_id=excluded.account_id,
      name=excluded.name,description=excluded.description,category=excluded.category,
      institution=excluded.institution,initial_balance_cents=excluded.initial_balance_cents,
      target_amount_cents=excluded.target_amount_cents,
      monthly_contribution_cents=excluded.monthly_contribution_cents,
      start_date=excluded.start_date,target_date=excluded.target_date,status=excluded.status,
      legacy_payload=excluded.legacy_payload,deleted_at=null,updated_at=now();

    update public.nexo_reserves_relational r
    set deleted_at=now(),updated_at=now()
    where r.user_id=v_user_id and r.legacy_id is not null and r.deleted_at is null
      and not exists(select 1 from jsonb_array_elements(p_payload) e where e->>'id'=r.legacy_id);
    select count(*) into v_row_count from public.nexo_reserves_relational
    where user_id=v_user_id and legacy_id is not null and deleted_at is null;

  elsif p_data_key = 'nexo_reserve_movements' then
    insert into public.nexo_reserve_movements_relational(
      user_id,legacy_id,legacy_position,reserve_id,amount_cents,movement_type,
      occurred_at,description,legacy_payload
    )
    select
      v_user_id,e->>'id',ordinality::integer,r.id,
      case
        when jsonb_typeof(e->'amount')='number' then round((e->>'amount')::numeric*100)::bigint
        when jsonb_typeof(e->'amount_cents')='number' then (e->>'amount_cents')::bigint
        else 0
      end,
      coalesce(nullif(e->>'movementType',''),nullif(e->>'type',''),'contribution'),
      case
        when (e->>'occurredAt') ~ '^\d{4}-\d{2}-\d{2}T' then (e->>'occurredAt')::timestamptz
        when (e->>'date') ~ '^\d{4}-\d{2}-\d{2}$' then ((e->>'date')::date + time '00:00') at time zone 'America/Sao_Paulo'
        when (e->>'date') ~ '^\d{2}/\d{2}/\d{4}$' then (to_date(e->>'date','DD/MM/YYYY') + time '00:00') at time zone 'America/Sao_Paulo'
        else null
      end,
      nullif(trim(coalesce(e->>'description',e->>'notes')),''),e
    from jsonb_array_elements(p_payload) with ordinality as x(e,ordinality)
    left join public.nexo_reserves_relational r
      on r.user_id=v_user_id and r.legacy_id=coalesce(e->>'reserveId',e->>'reserve_id') and r.deleted_at is null
    on conflict(user_id,legacy_id)
    do update set
      legacy_position=excluded.legacy_position,reserve_id=excluded.reserve_id,
      amount_cents=excluded.amount_cents,movement_type=excluded.movement_type,
      occurred_at=excluded.occurred_at,description=excluded.description,
      legacy_payload=excluded.legacy_payload;

    delete from public.nexo_reserve_movements_relational m
    where m.user_id=v_user_id and m.legacy_id is not null
      and not exists(select 1 from jsonb_array_elements(p_payload) e where e->>'id'=m.legacy_id);
    select count(*) into v_row_count from public.nexo_reserve_movements_relational
    where user_id=v_user_id and legacy_id is not null;

  elsif p_data_key = 'nexo_profile' then
    insert into public.nexo_profiles(
      user_id,display_name,sex,full_name,birth_date,profession,monthly_income_cents,legacy_payload
    )
    values(
      v_user_id,
      coalesce(nullif(trim(p_payload->>'displayName'),''),nullif(trim(p_payload->>'fullName'),'')),
      nullif(trim(p_payload->>'sex'),''),nullif(trim(p_payload->>'fullName'),''),
      case
        when (p_payload->>'birthDate') ~ '^\d{4}-\d{2}-\d{2}$' then (p_payload->>'birthDate')::date
        when (p_payload->>'birthDate') ~ '^\d{2}/\d{2}/\d{4}$' then to_date(p_payload->>'birthDate','DD/MM/YYYY')
        else null
      end,
      nullif(trim(p_payload->>'profession'),''),
      case
        when jsonb_typeof(p_payload->'monthlyIncome')='number'
          then round((p_payload->>'monthlyIncome')::numeric*100)::bigint
        when jsonb_typeof(p_payload->'monthlyIncome')='string' then
          round((
            case when position(',' in p_payload->>'monthlyIncome')>0 then
              replace(replace(regexp_replace(p_payload->>'monthlyIncome','[^0-9,.-]','','g'),'.',''),',','.')
            else regexp_replace(p_payload->>'monthlyIncome','[^0-9.-]','','g') end
          )::numeric*100)::bigint
        else null
      end,
      p_payload
    )
    on conflict(user_id) do update set
      display_name=excluded.display_name,sex=excluded.sex,full_name=excluded.full_name,
      birth_date=excluded.birth_date,profession=excluded.profession,
      monthly_income_cents=excluded.monthly_income_cents,
      legacy_payload=excluded.legacy_payload,updated_at=now();
    v_row_count := 1;

  elsif p_data_key = 'nexo_preferences' then
    insert into public.nexo_preferences(user_id,payload,legacy_payload,updated_at)
    values(v_user_id,p_payload,p_payload,now())
    on conflict(user_id) do update set
      payload=excluded.payload,legacy_payload=excluded.legacy_payload,updated_at=now();
    v_row_count := 1;
  end if;

  insert into public.nexo_relational_sync_state(user_id,data_key,revision,row_count,updated_at)
  values(v_user_id,p_data_key,v_result.current_revision,v_row_count,v_result.current_updated_at)
  on conflict(user_id,data_key) do update set
    revision=excluded.revision,row_count=excluded.row_count,updated_at=excluded.updated_at;

  return query select v_result.saved,v_result.current_revision,v_result.current_updated_at;
end;
$function$;

revoke all on function public.save_nexo_user_data_relational(text,jsonb,bigint) from public, anon;
grant execute on function public.save_nexo_user_data_relational(text,jsonb,bigint) to authenticated;

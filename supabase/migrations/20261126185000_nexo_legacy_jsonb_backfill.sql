-- Idempotent DEV backfill. Original JSONB is retained and never deleted.
do $$
declare v_source integer; v_snapshot integer; v_exact integer;
begin
  select count(*) into v_source from public.nexo_user_data;
  select count(*) into v_snapshot from nexo_private_backup.nexo_user_data_snapshot_20261126_181600;
  select count(*) into v_exact from public.nexo_user_data s
    join nexo_private_backup.nexo_user_data_snapshot_20261126_181600 b
      using(user_id,data_key,payload,revision,updated_at);
  if v_source <> v_snapshot or v_source <> v_exact then
    raise exception 'Legacy snapshot mismatch; aborting backfill. source %, snapshot %, exact %',
      v_source, v_snapshot, v_exact;
  end if;
end $$;

-- 1) Accounts: preserve legacy ID, institution, primary flag and full source payload.
insert into public.nexo_accounts (
  user_id, legacy_id, name, account_type, currency, opening_balance_cents,
  archived, institution, is_primary, legacy_payload
)
select
  s.user_id,
  e->>'id',
  left(trim(e->>'name'), 120),
  case
    when lower(coalesce(e->>'type','')) like '%corrente%'
      or lower(coalesce(e->>'type','')) like '%checking%' then 'checking'
    when lower(coalesce(e->>'type','')) like '%poup%'
      or lower(coalesce(e->>'type','')) like '%savings%' then 'savings'
    when lower(coalesce(e->>'type','')) like '%dinheiro%'
      or lower(coalesce(e->>'type','')) like '%cash%' then 'cash'
    when lower(coalesce(e->>'type','')) like '%credito%'
      or lower(coalesce(e->>'type','')) like '%credit%'
      or lower(coalesce(e->>'type','')) like '%cart%' then 'credit'
    when lower(coalesce(e->>'type','')) like '%invest%' then 'investment'
    else 'other'
  end,
  'BRL',
  round((e->>'initialBalance')::numeric * 100)::bigint,
  not coalesce((e->>'active')::boolean, true),
  nullif(trim(e->>'institution'),''),
  coalesce((e->>'isPrimary')::boolean, false),
  e
from public.nexo_user_data s
cross join lateral jsonb_array_elements(s.payload) e
where s.data_key = 'nexo_accounts'
on conflict (user_id, legacy_id) where legacy_id is not null
do update set
  name = excluded.name,
  account_type = excluded.account_type,
  currency = excluded.currency,
  opening_balance_cents = excluded.opening_balance_cents,
  archived = excluded.archived,
  institution = excluded.institution,
  is_primary = excluded.is_primary,
  legacy_payload = excluded.legacy_payload,
  updated_at = now();

-- 2) Categories are derived from transaction category + kind.
with tx as (
  select s.user_id, e,
    case
      when lower(coalesce(e->>'type','')) like '%receit%'
        or lower(coalesce(e->>'type','')) = 'income' then 'income'
      else 'expense'
    end as kind
  from public.nexo_user_data s
  cross join lateral jsonb_array_elements(s.payload) e
  where s.data_key = 'nexo_transactions'
)
insert into public.nexo_categories (user_id, name, kind)
select distinct user_id, left(trim(e->>'category'), 120), kind
from tx
where nullif(trim(e->>'category'),'') is not null
on conflict (user_id, name, kind) do nothing;

-- 3) Transactions: monetary values are converted to integer cents.
with tx as (
  select s.user_id, e,
    case
      when lower(coalesce(e->>'type','')) like '%receit%'
        or lower(coalesce(e->>'type','')) = 'income' then 'income'
      else 'expense'
    end as kind,
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
  from public.nexo_user_data s
  cross join lateral jsonb_array_elements(s.payload) e
  where s.data_key = 'nexo_transactions'
)
insert into public.nexo_transactions_relational (
  user_id, legacy_id, account_id, category_id, description, amount_cents,
  kind, occurred_on, status, subcategory, payment_method,
  settled_amount_cents, recurrence, recurrence_group_id, legacy_payload
)
select
  t.user_id,
  t.e->>'id',
  a.id,
  c.id,
  left(coalesce(nullif(trim(t.e->>'description'),''),'Sem descrição'),500),
  round((t.e->>'amount')::numeric * 100)::bigint,
  t.kind,
  t.mapped_date,
  t.mapped_status,
  nullif(trim(t.e->>'subcategory'),''),
  nullif(trim(t.e->>'paymentMethod'),''),
  case when jsonb_typeof(t.e->'settledAmount')='number'
    then round((t.e->>'settledAmount')::numeric * 100)::bigint else null end,
  nullif(t.e->>'recurrence',''),
  nullif(t.e->>'recurrenceGroupId',''),
  t.e
from tx t
left join public.nexo_accounts a
  on a.user_id = t.user_id
  and lower(trim(a.name)) = lower(trim(t.e->>'account'))
left join public.nexo_categories c
  on c.user_id = t.user_id
  and c.name = left(trim(t.e->>'category'),120)
  and c.kind = t.kind
on conflict (user_id, legacy_id) where legacy_id is not null
do update set
  account_id = excluded.account_id,
  category_id = excluded.category_id,
  description = excluded.description,
  amount_cents = excluded.amount_cents,
  kind = excluded.kind,
  occurred_on = excluded.occurred_on,
  status = excluded.status,
  subcategory = excluded.subcategory,
  payment_method = excluded.payment_method,
  settled_amount_cents = excluded.settled_amount_cents,
  recurrence = excluded.recurrence,
  recurrence_group_id = excluded.recurrence_group_id,
  legacy_payload = excluded.legacy_payload,
  updated_at = now();

-- 4) Tasks: dates/times are interpreted in America/Sao_Paulo; done is preserved explicitly.
with source as (
  select s.user_id, e,
    case
      when (e->>'date') ~ '^\d{4}-\d{2}-\d{2}$' then (e->>'date')::date
      when (e->>'date') ~ '^\d{2}/\d{2}/\d{4}$' then to_date(e->>'date','DD/MM/YYYY')
      else null
    end as scheduled_date,
    case
      when (e->>'time') ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' then (e->>'time')::time
      else time '00:00'
    end as scheduled_time
  from public.nexo_user_data s
  cross join lateral jsonb_array_elements(s.payload) e
  where s.data_key = 'nexo_tasks'
)
insert into public.nexo_routine_items (
  user_id, item_type, title, scheduled_at, completed_at, completed, active,
  metadata, source_key, legacy_id, legacy_payload
)
select
  user_id,
  'task',
  left(coalesce(nullif(trim(e->>'description'),''),'Tarefa sem título'),200),
  case when scheduled_date is not null
    then (scheduled_date + scheduled_time) at time zone 'America/Sao_Paulo' else null end,
  null,
  coalesce((e->>'done')::boolean,false),
  true,
  jsonb_build_object(
    'category',e->'category','notes',e->'notes','priority',e->'priority','time',e->'time'
  ),
  'nexo_tasks',
  e->>'id',
  e
from source
on conflict (user_id, source_key, legacy_id)
  where source_key is not null and legacy_id is not null
do update set
  title = excluded.title,
  scheduled_at = excluded.scheduled_at,
  completed = excluded.completed,
  active = excluded.active,
  metadata = excluded.metadata,
  legacy_payload = excluded.legacy_payload,
  updated_at = now();

-- 5) Habits: completion dates/frequency remain in metadata and the full payload.
insert into public.nexo_routine_items (
  user_id, item_type, title, scheduled_at, completed_at, completed, active,
  metadata, source_key, legacy_id, legacy_payload
)
select
  s.user_id,
  'habit',
  left(coalesce(nullif(trim(e->>'name'),''),'Hábito sem nome'),200),
  null,
  null,
  false,
  coalesce((e->>'active')::boolean,true),
  jsonb_build_object(
    'category',e->'category','frequency',e->'frequency',
    'completedDates',e->'completedDates','notes',e->'notes','time',e->'time'
  ),
  'nexo_habits',
  e->>'id',
  e
from public.nexo_user_data s
cross join lateral jsonb_array_elements(s.payload) e
where s.data_key = 'nexo_habits'
on conflict (user_id, source_key, legacy_id)
  where source_key is not null and legacy_id is not null
do update set
  title = excluded.title,
  active = excluded.active,
  metadata = excluded.metadata,
  legacy_payload = excluded.legacy_payload,
  updated_at = now();

-- 6) Reserves are kept separate from goals; legacy account references are mapped by legacy_id.
with source as (
  select s.user_id, e,
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
  from public.nexo_user_data s
  cross join lateral jsonb_array_elements(s.payload) e
  where s.data_key = 'nexo_reserves'
)
insert into public.nexo_reserves_relational (
  user_id, legacy_id, account_id, name, description, category, institution,
  initial_balance_cents, target_amount_cents, monthly_contribution_cents,
  start_date, target_date, status, legacy_payload
)
select
  s.user_id,
  s.e->>'id',
  a.id,
  left(trim(s.e->>'name'),200),
  nullif(trim(s.e->>'description'),''),
  nullif(trim(s.e->>'category'),''),
  nullif(trim(s.e->>'institution'),''),
  round((s.e->>'initialBalance')::numeric*100)::bigint,
  round((s.e->>'targetAmount')::numeric*100)::bigint,
  round((s.e->>'monthlyContribution')::numeric*100)::bigint,
  s.mapped_start_date,
  s.mapped_target_date,
  case
    when lower(coalesce(s.e->>'status','')) in ('completed','concluida','concluída') then 'completed'
    when lower(coalesce(s.e->>'status','')) in ('paused','pausada') then 'paused'
    when lower(coalesce(s.e->>'status','')) in ('archived','arquivada') then 'archived'
    else 'active'
  end,
  s.e
from source s
left join public.nexo_accounts a
  on a.user_id = s.user_id and a.legacy_id = s.e->>'accountId'
on conflict (user_id, legacy_id)
do update set
  account_id = excluded.account_id,
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  institution = excluded.institution,
  initial_balance_cents = excluded.initial_balance_cents,
  target_amount_cents = excluded.target_amount_cents,
  monthly_contribution_cents = excluded.monthly_contribution_cents,
  start_date = excluded.start_date,
  target_date = excluded.target_date,
  status = excluded.status,
  legacy_payload = excluded.legacy_payload,
  updated_at = now();

-- 7) Profile: Brazilian currency strings are converted to cents without floating point.
insert into public.nexo_profiles (
  user_id, display_name, sex, full_name, birth_date, profession,
  monthly_income_cents, legacy_payload
)
select
  user_id,
  coalesce(nullif(trim(payload->>'displayName'),''),nullif(trim(payload->>'fullName'),'')),
  nullif(trim(payload->>'sex'),''),
  nullif(trim(payload->>'fullName'),''),
  case
    when (payload->>'birthDate') ~ '^\d{4}-\d{2}-\d{2}$' then (payload->>'birthDate')::date
    when (payload->>'birthDate') ~ '^\d{2}/\d{2}/\d{4}$' then to_date(payload->>'birthDate','DD/MM/YYYY')
    else null
  end,
  nullif(trim(payload->>'profession'),''),
  case
    when jsonb_typeof(payload->'monthlyIncome')='number'
      then round((payload->>'monthlyIncome')::numeric*100)::bigint
    when jsonb_typeof(payload->'monthlyIncome')='string' then
      round((
        case
          when position(',' in payload->>'monthlyIncome') > 0 then
            replace(
              replace(regexp_replace(payload->>'monthlyIncome','[^0-9,.-]','','g'),'.',''),
              ',','.'
            )
          else regexp_replace(payload->>'monthlyIncome','[^0-9.-]','','g')
        end
      )::numeric*100)::bigint
    else null
  end,
  payload
from public.nexo_user_data
where data_key='nexo_profile'
on conflict (user_id)
do update set
  display_name = excluded.display_name,
  sex = excluded.sex,
  full_name = excluded.full_name,
  birth_date = excluded.birth_date,
  profession = excluded.profession,
  monthly_income_cents = excluded.monthly_income_cents,
  legacy_payload = excluded.legacy_payload,
  updated_at = now();

-- 8) Preferences remain structured JSONB but now have owner-scoped relational storage.
insert into public.nexo_preferences (user_id, payload, legacy_payload, updated_at)
select user_id, payload, payload, now()
from public.nexo_user_data
where data_key='nexo_preferences'
on conflict (user_id)
do update set
  payload = excluded.payload,
  legacy_payload = excluded.legacy_payload,
  updated_at = now();

-- 9) Validate counts and references; fail/rollback if anything was skipped.
do $$
declare
  v_accounts_expected integer;
  v_accounts_actual integer;
  v_tx_expected integer;
  v_tx_actual integer;
  v_routines_expected integer;
  v_routines_actual integer;
  v_reserves_expected integer;
  v_reserves_actual integer;
  v_profiles_expected integer;
  v_profiles_actual integer;
  v_preferences_expected integer;
  v_preferences_actual integer;
  v_missing_categories integer;
begin
  select coalesce(sum(jsonb_array_length(payload)),0) into v_accounts_expected
    from public.nexo_user_data where data_key='nexo_accounts';
  select count(*) into v_accounts_actual
    from public.nexo_accounts where legacy_id is not null;

  select coalesce(sum(jsonb_array_length(payload)),0) into v_tx_expected
    from public.nexo_user_data where data_key='nexo_transactions';
  select count(*) into v_tx_actual
    from public.nexo_transactions_relational where legacy_id is not null;

  select
    (select coalesce(sum(jsonb_array_length(payload)),0) from public.nexo_user_data where data_key='nexo_tasks') +
    (select coalesce(sum(jsonb_array_length(payload)),0) from public.nexo_user_data where data_key='nexo_habits')
    into v_routines_expected;
  select count(*) into v_routines_actual
    from public.nexo_routine_items where source_key in ('nexo_tasks','nexo_habits') and legacy_id is not null;

  select coalesce(sum(jsonb_array_length(payload)),0) into v_reserves_expected
    from public.nexo_user_data where data_key='nexo_reserves';
  select count(*) into v_reserves_actual
    from public.nexo_reserves_relational where legacy_id is not null;

  select count(*) into v_profiles_expected from public.nexo_user_data where data_key='nexo_profile';
  select count(*) into v_profiles_actual
    from public.nexo_profiles p
    where exists (select 1 from public.nexo_user_data s where s.user_id=p.user_id and s.data_key='nexo_profile');

  select count(*) into v_preferences_expected from public.nexo_user_data where data_key='nexo_preferences';
  select count(*) into v_preferences_actual
    from public.nexo_preferences p
    where exists (select 1 from public.nexo_user_data s where s.user_id=p.user_id and s.data_key='nexo_preferences');

  with tx as (
    select s.user_id,e,
      case when lower(coalesce(e->>'type','')) like '%receit%'
        or lower(coalesce(e->>'type',''))='income' then 'income' else 'expense' end as kind
    from public.nexo_user_data s
    cross join lateral jsonb_array_elements(s.payload) e
    where s.data_key='nexo_transactions'
  )
  select count(*) into v_missing_categories
  from (
    select distinct user_id,left(trim(e->>'category'),120) as name,kind from tx
    where nullif(trim(e->>'category'),'') is not null
  ) d
  where not exists (
    select 1 from public.nexo_categories c
    where c.user_id=d.user_id and c.name=d.name and c.kind=d.kind
  );

  if v_accounts_expected <> v_accounts_actual
    or v_tx_expected <> v_tx_actual
    or v_routines_expected <> v_routines_actual
    or v_reserves_expected <> v_reserves_actual
    or v_profiles_expected <> v_profiles_actual
    or v_preferences_expected <> v_preferences_actual
    or v_missing_categories <> 0 then
    raise exception 'Backfill validation failed: accounts %/%, transactions %/%, routines %/%, reserves %/%, profiles %/%, preferences %/%, missing categories %',
      v_accounts_actual,v_accounts_expected,v_tx_actual,v_tx_expected,
      v_routines_actual,v_routines_expected,v_reserves_actual,v_reserves_expected,
      v_profiles_actual,v_profiles_expected,v_preferences_actual,v_preferences_expected,
      v_missing_categories;
  end if;
end $$;

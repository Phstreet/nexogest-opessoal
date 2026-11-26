-- Relational compatibility state, ordering and read fallback.
do $$
declare v_source integer; v_snapshot integer; v_exact integer;
begin
  select count(*) into v_source from public.nexo_user_data;
  select count(*) into v_snapshot from nexo_private_backup.nexo_user_data_snapshot_20261126_181600;
  select count(*) into v_exact from public.nexo_user_data s
    join nexo_private_backup.nexo_user_data_snapshot_20261126_181600 b
      using(user_id,data_key,payload,revision,updated_at);
  if v_source <> v_snapshot or v_source <> v_exact then
    raise exception 'Legacy snapshot mismatch; aborting relational compatibility migration.';
  end if;
end $$;

alter table public.nexo_accounts
  add column if not exists legacy_position integer,
  add column if not exists deleted_at timestamptz;
alter table public.nexo_transactions_relational
  add column if not exists legacy_position integer;
alter table public.nexo_routine_items
  add column if not exists legacy_position integer;
alter table public.nexo_reserves_relational
  add column if not exists legacy_position integer,
  add column if not exists deleted_at timestamptz;
alter table public.nexo_reserve_movements_relational
  add column if not exists legacy_position integer;

create table if not exists public.nexo_relational_sync_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  data_key text not null check (data_key = any(array[
    'nexo_accounts','nexo_transactions','nexo_tasks','nexo_habits',
    'nexo_reserves','nexo_reserve_movements','nexo_profile','nexo_preferences'
  ])),
  revision bigint not null,
  row_count integer not null default 0 check (row_count >= 0),
  updated_at timestamptz not null default now(),
  primary key(user_id,data_key)
);

alter table public.nexo_relational_sync_state enable row level security;
revoke all on table public.nexo_relational_sync_state from anon, public;
grant select, insert, update, delete on table public.nexo_relational_sync_state to authenticated;
drop policy if exists owner_select on public.nexo_relational_sync_state;
create policy owner_select on public.nexo_relational_sync_state
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists owner_insert on public.nexo_relational_sync_state;
create policy owner_insert on public.nexo_relational_sync_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists owner_update on public.nexo_relational_sync_state;
create policy owner_update on public.nexo_relational_sync_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists owner_delete on public.nexo_relational_sync_state;
create policy owner_delete on public.nexo_relational_sync_state
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Recover the original array ordering from the still-preserved JSONB payload.
update public.nexo_accounts a
set legacy_position = src.position
from (
  select s.user_id,e->>'id' as legacy_id, ordinality::integer as position
  from public.nexo_user_data s
  cross join lateral jsonb_array_elements(s.payload) with ordinality as x(e,ordinality)
  where s.data_key='nexo_accounts'
) src
where a.user_id=src.user_id and a.legacy_id=src.legacy_id;

update public.nexo_transactions_relational t
set legacy_position = src.position
from (
  select s.user_id,e->>'id' as legacy_id, ordinality::integer as position
  from public.nexo_user_data s
  cross join lateral jsonb_array_elements(s.payload) with ordinality as x(e,ordinality)
  where s.data_key='nexo_transactions'
) src
where t.user_id=src.user_id and t.legacy_id=src.legacy_id;

update public.nexo_routine_items r
set legacy_position = src.position
from (
  select s.user_id,'nexo_tasks'::text as source_key,e->>'id' as legacy_id,ordinality::integer as position
  from public.nexo_user_data s
  cross join lateral jsonb_array_elements(s.payload) with ordinality as x(e,ordinality)
  where s.data_key='nexo_tasks'
  union all
  select s.user_id,'nexo_habits'::text,e->>'id',ordinality::integer
  from public.nexo_user_data s
  cross join lateral jsonb_array_elements(s.payload) with ordinality as x(e,ordinality)
  where s.data_key='nexo_habits'
) src
where r.user_id=src.user_id and r.source_key=src.source_key and r.legacy_id=src.legacy_id;

update public.nexo_reserves_relational r
set legacy_position = src.position
from (
  select s.user_id,e->>'id' as legacy_id,ordinality::integer as position
  from public.nexo_user_data s
  cross join lateral jsonb_array_elements(s.payload) with ordinality as x(e,ordinality)
  where s.data_key='nexo_reserves'
) src
where r.user_id=src.user_id and r.legacy_id=src.legacy_id;

update public.nexo_reserve_movements_relational r
set legacy_position = src.position
from (
  select s.user_id,e->>'id' as legacy_id,ordinality::integer as position
  from public.nexo_user_data s
  cross join lateral jsonb_array_elements(s.payload) with ordinality as x(e,ordinality)
  where s.data_key='nexo_reserve_movements'
) src
where r.user_id=src.user_id and r.legacy_id=src.legacy_id;

-- Mark collections as relational only after the verified backfill exists.
insert into public.nexo_relational_sync_state(user_id,data_key,revision,row_count,updated_at)
select
  s.user_id,
  s.data_key,
  s.revision,
  case s.data_key
    when 'nexo_accounts' then (select count(*) from public.nexo_accounts x where x.user_id=s.user_id and x.legacy_id is not null and x.deleted_at is null)
    when 'nexo_transactions' then (select count(*) from public.nexo_transactions_relational x where x.user_id=s.user_id and x.legacy_id is not null)
    when 'nexo_tasks' then (select count(*) from public.nexo_routine_items x where x.user_id=s.user_id and x.source_key='nexo_tasks' and x.legacy_id is not null)
    when 'nexo_habits' then (select count(*) from public.nexo_routine_items x where x.user_id=s.user_id and x.source_key='nexo_habits' and x.legacy_id is not null)
    when 'nexo_reserves' then (select count(*) from public.nexo_reserves_relational x where x.user_id=s.user_id and x.legacy_id is not null and x.deleted_at is null)
    when 'nexo_reserve_movements' then (select count(*) from public.nexo_reserve_movements_relational x where x.user_id=s.user_id and x.legacy_id is not null)
    when 'nexo_profile' then (select count(*) from public.nexo_profiles x where x.user_id=s.user_id)
    when 'nexo_preferences' then (select count(*) from public.nexo_preferences x where x.user_id=s.user_id)
    else 0
  end,
  s.updated_at
from public.nexo_user_data s
where s.data_key = any(array[
  'nexo_accounts','nexo_transactions','nexo_tasks','nexo_habits',
  'nexo_reserves','nexo_reserve_movements','nexo_profile','nexo_preferences'
])
on conflict(user_id,data_key) do update set
  revision=excluded.revision,
  row_count=excluded.row_count,
  updated_at=excluded.updated_at;

create or replace function public.nexo_relational_payload(p_user_id uuid, p_data_key text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select case p_data_key
    when 'nexo_accounts' then coalesce((
      select jsonb_agg(a.legacy_payload order by a.legacy_position nulls last,a.id)
      from public.nexo_accounts a
      where a.user_id=p_user_id and a.legacy_id is not null and a.deleted_at is null
    ),'[]'::jsonb)
    when 'nexo_transactions' then coalesce((
      select jsonb_agg(t.legacy_payload order by t.legacy_position nulls last,t.id)
      from public.nexo_transactions_relational t
      where t.user_id=p_user_id and t.legacy_id is not null
    ),'[]'::jsonb)
    when 'nexo_tasks' then coalesce((
      select jsonb_agg(r.legacy_payload order by r.legacy_position nulls last,r.id)
      from public.nexo_routine_items r
      where r.user_id=p_user_id and r.source_key='nexo_tasks' and r.legacy_id is not null
    ),'[]'::jsonb)
    when 'nexo_habits' then coalesce((
      select jsonb_agg(r.legacy_payload order by r.legacy_position nulls last,r.id)
      from public.nexo_routine_items r
      where r.user_id=p_user_id and r.source_key='nexo_habits' and r.legacy_id is not null
    ),'[]'::jsonb)
    when 'nexo_reserves' then coalesce((
      select jsonb_agg(r.legacy_payload order by r.legacy_position nulls last,r.id)
      from public.nexo_reserves_relational r
      where r.user_id=p_user_id and r.legacy_id is not null and r.deleted_at is null
    ),'[]'::jsonb)
    when 'nexo_reserve_movements' then coalesce((
      select jsonb_agg(r.legacy_payload order by r.legacy_position nulls last,r.id)
      from public.nexo_reserve_movements_relational r
      where r.user_id=p_user_id and r.legacy_id is not null
    ),'[]'::jsonb)
    when 'nexo_profile' then coalesce((
      select p.legacy_payload from public.nexo_profiles p where p.user_id=p_user_id
    ),'{}'::jsonb)
    when 'nexo_preferences' then coalesce((
      select p.legacy_payload from public.nexo_preferences p where p.user_id=p_user_id
    ),'{}'::jsonb)
    else null
  end;
$function$;

create or replace function public.get_nexo_user_data_compat(p_data_keys text[] default null)
returns table(data_key text,payload jsonb,revision bigint,updated_at timestamptz)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Autenticação obrigatória para consultar dados do NEXO.';
  end if;

  return query
  select
    s.data_key,
    case
      when st.data_key is not null and st.revision=s.revision
        then public.nexo_relational_payload(v_user_id,s.data_key)
      else s.payload
    end,
    s.revision,
    s.updated_at
  from public.nexo_user_data s
  left join public.nexo_relational_sync_state st
    on st.user_id=s.user_id and st.data_key=s.data_key
  where s.user_id=v_user_id
    and (p_data_keys is null or s.data_key=any(p_data_keys))
  order by s.data_key;
end;
$function$;

revoke all on function public.nexo_relational_payload(uuid,text) from public, anon;
revoke all on function public.get_nexo_user_data_compat(text[]) from public, anon;
grant execute on function public.nexo_relational_payload(uuid,text) to authenticated;
grant execute on function public.get_nexo_user_data_compat(text[]) to authenticated;

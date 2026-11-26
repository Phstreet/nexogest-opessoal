do $$
declare v_source integer; v_snapshot integer; v_exact integer;
begin
  select count(*) into v_source from public.nexo_user_data;
  select count(*) into v_snapshot from nexo_private_backup.nexo_user_data_snapshot_20261126_181600;
  select count(*) into v_exact from public.nexo_user_data s
    join nexo_private_backup.nexo_user_data_snapshot_20261126_181600 b
      using(user_id,data_key,payload,revision,updated_at);
  if v_source <> v_snapshot or v_source <> v_exact then
    raise exception 'Legacy snapshot mismatch before legacy fields migration.';
  end if;
end $$;

alter table public.nexo_accounts
  add column if not exists institution text,
  add column if not exists is_primary boolean not null default false;

alter table public.nexo_routine_items
  add column if not exists completed boolean not null default false,
  add column if not exists active boolean not null default true;

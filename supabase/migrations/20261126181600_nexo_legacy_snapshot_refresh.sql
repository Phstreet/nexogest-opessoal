-- Fresh DEV-only snapshot because legacy JSONB changed after the first snapshot.
create schema if not exists nexo_private_backup;
revoke all on schema nexo_private_backup from public, anon, authenticated;

create table nexo_private_backup.nexo_user_data_snapshot_20261126_181600 as
select *, now() as snapshot_created_at
from public.nexo_user_data;

alter table nexo_private_backup.nexo_user_data_snapshot_20261126_181600
  add constraint nexo_user_data_snapshot_20261126_181600_pkey
  primary key (user_id, data_key);

revoke all on table nexo_private_backup.nexo_user_data_snapshot_20261126_181600
  from public, anon, authenticated;

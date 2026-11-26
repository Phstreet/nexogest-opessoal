-- Snapshot integrity for the DEV-only legacy-data backup.
-- The source table primary key is (user_id, data_key); preserve that identity.
alter table nexo_private_backup.nexo_user_data_snapshot_20261126
  add constraint nexo_user_data_snapshot_20261126_pkey
  primary key (user_id, data_key);

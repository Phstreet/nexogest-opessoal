-- Add indexes for the two ownership-aware transaction foreign keys.
-- Safe and additive; no existing rows are changed.
create index if not exists nexo_transactions_user_account_idx
  on public.nexo_transactions_relational (user_id, account_id)
  where account_id is not null;

create index if not exists nexo_transactions_user_category_idx
  on public.nexo_transactions_relational (user_id, category_id)
  where category_id is not null;

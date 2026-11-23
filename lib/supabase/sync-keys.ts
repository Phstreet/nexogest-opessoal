export const NEXO_SYNC_KEYS = [
  "nexo_transactions",
  "nexo_accounts",
  "nexo_reserves",
  "nexo_reserve_movements",
  "nexo_tasks",
  "nexo_habits",
  "nexo_preferences",
  "nexo_profile",
  "nexo_planning_budgets",
  "nexo_planning_goals",
  "nexo_personal_goals",
  "nexo_task_backups",
] as const;

export type NexoSyncKey = (typeof NEXO_SYNC_KEYS)[number];

const allowedKeys: ReadonlySet<string> = new Set(NEXO_SYNC_KEYS);

export function isNexoSyncKey(value: string): value is NexoSyncKey {
  return allowedKeys.has(value);
}

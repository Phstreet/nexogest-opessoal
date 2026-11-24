import type { NexoSyncKey } from "./sync-keys";
import { isValidTransaction } from "@/lib/finance/finance-utils";
import type { Account, Reserve, ReserveMovement } from "@/lib/finance/types";
import { isValidRoutineHabit, isValidRoutineTask } from "@/lib/routine/types";

const ARRAY_KEYS = new Set<NexoSyncKey>([
  "nexo_transactions", "nexo_accounts", "nexo_reserves", "nexo_reserve_movements",
  "nexo_tasks", "nexo_habits", "nexo_planning_budgets", "nexo_planning_goals",
  "nexo_personal_goals", "nexo_task_backups",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidAccount(value: unknown): value is Account {
  return isRecord(value) && isFiniteNumber(value.id) &&
    typeof value.name === "string" && Boolean(value.name.trim()) &&
    typeof value.institution === "string" && typeof value.type === "string" &&
    isFiniteNumber(value.initialBalance) && typeof value.active === "boolean" &&
    typeof value.createdAt === "string";
}

function isValidReserve(value: unknown): value is Reserve {
  return isRecord(value) && isFiniteNumber(value.id) &&
    typeof value.name === "string" && typeof value.description === "string" &&
    isFiniteNumber(value.targetAmount) && isFiniteNumber(value.initialBalance) &&
    isFiniteNumber(value.monthlyContribution) && typeof value.startDate === "string" &&
    typeof value.targetDate === "string" &&
    (value.accountId === null || isFiniteNumber(value.accountId)) &&
    typeof value.institution === "string" && typeof value.status === "string" &&
    typeof value.createdAt === "string";
}

function isValidReserveMovement(value: unknown): value is ReserveMovement {
  return isRecord(value) && isFiniteNumber(value.id) && isFiniteNumber(value.reserveId) &&
    ["Aporte", "Resgate", "Rendimento", "Ajuste"].includes(String(value.type)) &&
    isFiniteNumber(value.amount) && value.amount > 0 &&
    typeof value.date === "string" && typeof value.description === "string" &&
    typeof value.createdAt === "string";
}

/** Valida a estrutura de cada coleção antes de qualquer gravação do backup. */
export function isValidBackupCollection(key: NexoSyncKey, payload: unknown): boolean {
  if (ARRAY_KEYS.has(key)) {
    if (!Array.isArray(payload)) return false;
    switch (key) {
      case "nexo_transactions":
        return payload.every((item) => isRecord(item) && isValidTransaction(
          item.settledAmount === null ? { ...item, settledAmount: undefined } : item
        ));
      case "nexo_accounts": return payload.every(isValidAccount);
      case "nexo_reserves": return payload.every(isValidReserve);
      case "nexo_reserve_movements": return payload.every(isValidReserveMovement);
      case "nexo_tasks": return payload.every(isValidRoutineTask);
      case "nexo_habits": return payload.every(isValidRoutineHabit);
      default: return payload.every(isRecord);
    }
  }
  return isRecord(payload);
}

import type { MovementType, Transaction } from "@/lib/finance/types";
import { subcategories } from "@/lib/finance/categories";

export type FormMovementType = Extract<MovementType, "Receita" | "Despesa" | "Transferência" | "Investimento">;

export function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function parseAmount(value: string) {
  const normalized = value.trim().replace(/\s/g, "");
  if (!normalized) return NaN;
  if (normalized.includes(",")) {
    return Number(normalized.replace(/\./g, "").replace(",", "."));
  }
  if (/^-?\d{1,3}(\.\d{3})+$/.test(normalized)) {
    return Number(normalized.replace(/\./g, ""));
  }
  return Number(normalized);
}

export function localDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
}

export function getDefaultCategory(type: FormMovementType) {
  if (type === "Receita") return "Salário";
  if (type === "Despesa") return "Moradia";
  if (type === "Investimento") return "Investimento";
  return "Transferência";
}

export function getDefaultSubcategory(category: string) {
  return subcategories[category]?.[0] || "Outros";
}

export function isInvestmentApplied(item: Transaction) {
  const isInvestment = item.type === "Investimento" || item.type === "Aplicação";
  if (!isInvestment || item.status === "Cancelada") return false;
  return item.status === "Aplicado" || !item.status;
}

export function isValidTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const validTypes: MovementType[] = [
    "Receita", "Despesa", "Transferência", "Investimento", "Aplicação", "Reserva",
  ];
  if (
    typeof item.id !== "number" || !Number.isFinite(item.id) ||
    typeof item.description !== "string" || !item.description.trim() ||
    !validTypes.includes(item.type as MovementType) ||
    typeof item.amount !== "number" || !Number.isFinite(item.amount) ||
    item.amount <= 0
  ) return false;

  if (
    item.settledAmount !== undefined &&
    (typeof item.settledAmount !== "number" ||
      !Number.isFinite(item.settledAmount) ||
      item.settledAmount < 0 ||
      item.settledAmount > item.amount)
  ) return false;

  if (item.date !== undefined &&
    (typeof item.date !== "string" || !isValidDate(item.date))) return false;

  const optionalStringFields = [
    "category", "subcategory", "account", "destinationAccount",
    "paymentMethod", "status", "recurrence", "recurrenceGroupId",
    "reserveType", "investment", "institution", "createdAt", "updatedAt",
  ];
  for (const field of optionalStringFields) {
    if (item[field] !== undefined && typeof item[field] !== "string") return false;
  }
  return true;
}

export function getSettledAmount(item: Transaction) {
  if (item.status === "Cancelada") return 0;
  if (item.type === "Receita") {
    if (item.status === "Recebida") return item.amount;
    if (item.status === "Recebida parcialmente") {
      return Math.min(Number(item.settledAmount || 0), item.amount);
    }
    return item.status ? 0 : item.amount;
  }
  if (item.type === "Despesa") {
    if (item.status === "Pago") return item.amount;
    if (item.status === "Paga parcialmente") {
      return Math.min(Number(item.settledAmount || 0), item.amount);
    }
    return item.status ? 0 : item.amount;
  }
  return isInvestmentApplied(item) ? item.amount : 0;
}

export function getNextTransactionId(transactions: Transaction[]) {
  const usedIds = new Set(transactions.map((item) => item.id));
  let id = Date.now();
  while (usedIds.has(id)) id += 1;
  return id;
}

export function movementIcon(item: Transaction) {
  if (item.type === "Receita") return "↗";
  if (item.type === "Despesa") return "↙";
  if (item.type === "Aplicação" || item.type === "Investimento") return "◈";
  if (item.type === "Reserva") return "▣";
  return "⇄";
}

export function movementValue(item: Transaction) {
  if (item.type === "Receita") return "+";
  if (item.type === "Despesa") return "-";
  if ((item.type === "Investimento" || item.type === "Aplicação") && isInvestmentApplied(item)) return "-";
  return "";
}

export function movementClass(item: Transaction) {
  if (item.type === "Receita") return "income";
  if (item.type === "Despesa") return "expense";
  if (item.type === "Aplicação" || item.type === "Investimento") return "investment-movement";
  if (item.type === "Reserva") return "reserve-movement";
  return "";
}

import type { MovementType, Transaction } from "@/lib/finance/types";
import { subcategories } from "@/lib/finance/categories";
import { getSettledTransactionAmount, isCancelledTransaction } from "@/lib/finance/accounts";
import { formatBRL, parseCurrencyToCents, fromCents } from "@/lib/utils/currency";
import { localISODate, isValidISODate } from "@/lib/utils/dates";

export type FormMovementType = Extract<MovementType, "Receita" | "Despesa" | "Transferência" | "Investimento">;

export function money(value: number) {
  return formatBRL(value);
}

export function parseAmount(value: string) {
  const cents = parseCurrencyToCents(value);
  return cents === null ? NaN : fromCents(cents);
}

export function localDate() {
  return localISODate();
}

export function isValidDate(value: string) {
  return isValidISODate(value);
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
  return isInvestment && getSettledTransactionAmount(item) > 0;
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
  return getSettledTransactionAmount(item);
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

export type FinanceTotals = {
  receitas: number;
  despesas: number;
  receitasRealizadas: number;
  despesasRealizadas: number;
  investimentosAplicados: number;
  resultado: number;
};

function sumAmountsInCents(items: Transaction[], amountOf: (item: Transaction) => number): number {
  const cents = items.reduce((sum, item) => {
    const value = amountOf(item);
    return sum + (Number.isFinite(value) ? Math.round(value * 100) : 0);
  }, 0);
  return fromCents(cents);
}

export function calculateFinanceTotals(transactions: Transaction[]): FinanceTotals {
  const active = transactions.filter((item) => !isCancelledTransaction(item));
  const receitasItems = active.filter((item) => item.type === "Receita");
  const despesasItems = active.filter((item) => item.type === "Despesa");
  const investmentItems = active.filter(isInvestmentApplied);

  const receitas = sumAmountsInCents(receitasItems, (item) => item.amount);
  const despesas = sumAmountsInCents(despesasItems, (item) => item.amount);
  const receitasRealizadas = sumAmountsInCents(receitasItems, getSettledAmount);
  const despesasRealizadas = sumAmountsInCents(despesasItems, getSettledAmount);
  const investimentosAplicados = sumAmountsInCents(investmentItems, getSettledAmount);

  const resultadoCents =
    Math.round(receitasRealizadas * 100) -
    Math.round(despesasRealizadas * 100) -
    Math.round(investimentosAplicados * 100);

  return {
    receitas,
    despesas,
    receitasRealizadas,
    despesasRealizadas,
    investimentosAplicados,
    resultado: fromCents(resultadoCents),
  };
}

export function getMovementFilterOptions(transactions: Transaction[], movementTypes: string[]) {
  const existingTypes = transactions
    .map((item) => item.type)
    .filter((item) => item === "Aplicação" || item === "Reserva");

  return [...movementTypes, ...Array.from(new Set(existingTypes))];
}

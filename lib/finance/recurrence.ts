
import type { Transaction } from "./types";
import {
  getTransactions,
  saveTransactions,
} from "./storage";

export type RecurrenceFrequency =
  | "diaria"
  | "semanal"
  | "quinzenal"
  | "mensal"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual";

function addMonths(date: Date, months: number): Date {
  const originalDay = date.getDate();
  const result = new Date(date);

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(originalDay, lastDay));

  return result;
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  const month = result.getMonth();
  const day = result.getDate();

  result.setDate(1);
  result.setFullYear(result.getFullYear() + years);

  const lastDay = new Date(
    result.getFullYear(),
    month + 1,
    0
  ).getDate();

  result.setMonth(month);
  result.setDate(Math.min(day, lastDay));

  return result;
}

export function addRecurrenceDate(
  dateString: string,
  frequency: RecurrenceFrequency
): string {
  const date = new Date(`${dateString}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Data inválida para recorrência.");
  }

  let result = new Date(date);

  switch (frequency) {
    case "diaria":
      result.setDate(result.getDate() + 1);
      break;
    case "semanal":
      result.setDate(result.getDate() + 7);
      break;
    case "quinzenal":
      result.setDate(result.getDate() + 15);
      break;
    case "mensal":
      result = addMonths(result, 1);
      break;
    case "bimestral":
      result = addMonths(result, 2);
      break;
    case "trimestral":
      result = addMonths(result, 3);
      break;
    case "semestral":
      result = addMonths(result, 6);
      break;
    case "anual":
      result = addYears(result, 1);
      break;
  }

  const year = result.getFullYear();
  const month = String(result.getMonth() + 1).padStart(2, "0");
  const day = String(result.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function generateRecurrences(
  original: Transaction,
  frequency: RecurrenceFrequency,
  quantity: number
): Transaction[] {
  if (!original.date) {
    throw new Error("A movimentação precisa ter uma data.");
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 120) {
    throw new Error("A quantidade deve estar entre 1 e 120.");
  }

  const transactions = getTransactions();
  const generated: Transaction[] = [];

  let nextDate = original.date;

  for (let index = 0; index < quantity; index++) {
    nextDate = addRecurrenceDate(nextDate, frequency);

    const exists = transactions.some(
      (item) =>
        item.description === original.description &&
        item.type === original.type &&
        item.date === nextDate &&
        item.recurrence === frequency
    );

    if (exists) continue;

    generated.push({
      ...original,
      id: Date.now() + index + 1,
      date: nextDate,
      status: "Pendente",
      recurrence: frequency,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const updated = [...transactions, ...generated];

  if (!saveTransactions(updated)) {
    throw new Error("Não foi possível salvar as recorrências.");
  }

  return generated;
}

export function deleteFutureRecurrences(
  description: string,
  fromDate: string
): number {
  const transactions = getTransactions();

  const filtered = transactions.filter((item) => {
    const isMatching =
      item.description === description &&
      Boolean(item.recurrence) &&
      Boolean(item.date && item.date >= fromDate);

    return !isMatching;
  });

  const removed = transactions.length - filtered.length;

  if (removed > 0 && !saveTransactions(filtered)) {
    throw new Error("Não foi possível excluir as recorrências.");
  }

  return removed;
}

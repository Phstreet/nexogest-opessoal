import type { Transaction } from "./types";

export type RecurrenceFrequency =
  | "diaria" | "semanal" | "quinzenal" | "mensal"
  | "bimestral" | "trimestral" | "semestral" | "anual";

function addMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

export function addRecurrenceDate(dateString: string, frequency: RecurrenceFrequency): string {
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Data inválida para recorrência.");
  const result = new Date(date);
  switch (frequency) {
    case "diaria": result.setDate(result.getDate() + 1); break;
    case "semanal": result.setDate(result.getDate() + 7); break;
    case "quinzenal": result.setDate(result.getDate() + 14); break;
    case "mensal": result.setTime(addMonths(result, 1).getTime()); break;
    case "bimestral": result.setTime(addMonths(result, 2).getTime()); break;
    case "trimestral": result.setTime(addMonths(result, 3).getTime()); break;
    case "semestral": result.setTime(addMonths(result, 6).getTime()); break;
    case "anual": result.setTime(addMonths(result, 12).getTime()); break;
  }
  return [result.getFullYear(), String(result.getMonth() + 1).padStart(2, "0"), String(result.getDate()).padStart(2, "0")].join("-");
}

/** Retorna ocorrências futuras sem gravar dados; o chamador persiste a coleção completa no Supabase. */
export function generateRecurrences(
  original: Transaction,
  frequency: RecurrenceFrequency,
  quantity: number,
  existingTransactions: Transaction[]
): Transaction[] {
  if (!original.date) throw new Error("A movimentação precisa ter uma data.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 120) {
    throw new Error("A quantidade deve estar entre 1 e 120.");
  }
  const generated: Transaction[] = [];
  let nextDate = original.date;
  for (let index = 0; index < quantity; index += 1) {
    nextDate = addRecurrenceDate(nextDate, frequency);
    const exists = existingTransactions.some((item) =>
      item.description.trim().toLowerCase() === original.description.trim().toLowerCase() &&
      item.type === original.type && item.date === nextDate && item.recurrence === frequency
    );
    if (exists) continue;
    let id = Date.now() + index + 1;
    while (existingTransactions.some((item) => item.id === id) || generated.some((item) => item.id === id)) id += 1;
    generated.push({
      ...original,
      id,
      date: nextDate,
      status: "Pendente",
      settledAmount: undefined,
      recurrence: frequency,
      createdAt: new Date().toISOString(),
      updatedAt: undefined,
    });
  }
  return generated;
}

export function deleteFutureRecurrences(
  transactions: Transaction[],
  description: string,
  fromDate: string
): Transaction[] {
  return transactions.filter((item) => !(
    item.description === description &&
    Boolean(item.recurrence) &&
    Boolean(item.date && item.date >= fromDate)
  ));
}

import type { Transaction } from "./types";
import { isCancelledTransaction } from "./accounts";

type RecurrenceLabel =
  | "Semanal"
  | "Quinzenal"
  | "Mensal"
  | "Bimestral"
  | "Trimestral"
  | "Semestral"
  | "Anual";

const RECURRENCES: RecurrenceLabel[] = [
  "Semanal", "Quinzenal", "Mensal", "Bimestral",
  "Trimestral", "Semestral", "Anual",
];

function addMonthsAnchored(dateString: string, months: number): string {
  const [year, month, day] = dateString.slice(0, 10).split("-").map(Number);
  const target = new Date(year, month - 1 + months, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return [
    target.getFullYear(),
    String(target.getMonth() + 1).padStart(2, "0"),
    String(Math.min(day, lastDay)).padStart(2, "0"),
  ].join("-");
}

export function getNextRecurrenceDate(
  dateString: string,
  recurrence: string,
  occurrence: number
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString) || !Number.isInteger(occurrence) || occurrence < 1) {
    throw new Error("Data ou ocorrência inválida para gerar recorrência.");
  }
  if (recurrence === "Semanal" || recurrence === "Quinzenal") {
    const date = new Date(`${dateString}T12:00:00`);
    date.setDate(date.getDate() + occurrence * (recurrence === "Semanal" ? 7 : 14));
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }
  const monthsByFrequency: Record<string, number> = {
    Mensal: 1, Bimestral: 2, Trimestral: 3, Semestral: 6, Anual: 12,
  };
  const months = monthsByFrequency[recurrence];
  if (!months) throw new Error("Frequência de recorrência não reconhecida.");
  return addMonthsAnchored(dateString, months * occurrence);
}

function sameSeries(root: Transaction, candidate: Transaction): boolean {
  return candidate.type === root.type &&
    candidate.description.trim().toLocaleLowerCase("pt-BR") === root.description.trim().toLocaleLowerCase("pt-BR") &&
    Number(candidate.amount) === Number(root.amount) &&
    (candidate.category || "") === (root.category || "") &&
    (candidate.subcategory || "") === (root.subcategory || "") &&
    (candidate.account || "") === (root.account || "") &&
    (candidate.destinationAccount || "") === (root.destinationAccount || "") &&
    (candidate.paymentMethod || "") === (root.paymentMethod || "") &&
    candidate.recurrence === root.recurrence;
}

/** Completa até três ocorrências futuras para cada série, sem duplicar datas existentes. */
export function expandRecurringTransactions(transactions: Transaction[]): Transaction[] {
  const result = transactions.map((item) => ({ ...item }));
  const roots = [...result].filter((item) =>
    RECURRENCES.includes(item.recurrence as RecurrenceLabel) &&
    (item.type === "Receita" || item.type === "Despesa") &&
    !item.recurrenceGroupId &&
    !isCancelledTransaction(item) &&
    Boolean(item.date)
  );

  const rootIds = new Set(roots.map((item) => item.id));

  for (const candidate of roots) {
    const index = result.findIndex((item) => item.id === candidate.id);
    if (index < 0 || result[index].recurrenceGroupId || !candidate.date) continue;
    const groupId = `recorrencia-${candidate.id}`;
    const root = { ...candidate, recurrenceGroupId: groupId };
    result[index] = root;

    for (let occurrence = 1; occurrence <= 3; occurrence += 1) {
      const date = getNextRecurrenceDate(root.date!, root.recurrence!, occurrence);
      const exists = result.some((item) =>
        item.id !== root.id &&
        item.date === date &&
        !isCancelledTransaction(item) &&
        (item.recurrenceGroupId === groupId || (!item.recurrenceGroupId && !rootIds.has(item.id))) &&
        sameSeries(root, item)
      );
      if (exists) continue;
      const now = new Date().toISOString();
      let id = Date.now() + occurrence;
      while (result.some((item) => item.id === id)) id += 1;
      result.push({
        ...root,
        id,
        date,
        status: "Pendente",
        settledAmount: undefined,
        recurrenceGroupId: groupId,
        createdAt: now,
        updatedAt: undefined,
      });
    }
  }
  return result;
}

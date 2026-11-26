import type { Transaction } from "./types";
import { isCancelledTransaction } from "./accounts";
import { isValidISODate, localISODate } from "@/lib/utils/dates";

type RecurrenceLabel =
  | "Semanal"
  | "Quinzenal"
  | "Mensal"
  | "Bimestral"
  | "Trimestral"
  | "Semestral"
  | "Anual";

const RECURRENCES: RecurrenceLabel[] = [
  "Semanal",
  "Quinzenal",
  "Mensal",
  "Bimestral",
  "Trimestral",
  "Semestral",
  "Anual",
];

function addMonthsAnchored(dateString: string, months: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const firstOfTargetMonth = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(firstOfTargetMonth.getUTCFullYear(), firstOfTargetMonth.getUTCMonth() + 1, 0)
  ).getUTCDate();

  return [
    firstOfTargetMonth.getUTCFullYear(),
    String(firstOfTargetMonth.getUTCMonth() + 1).padStart(2, "0"),
    String(Math.min(day, lastDay)).padStart(2, "0"),
  ].join("-");
}

export function getNextRecurrenceDate(
  dateString: string,
  recurrence: string,
  occurrence: number
): string {
  if (!isValidISODate(dateString) || !Number.isInteger(occurrence) || occurrence < 1) {
    throw new Error("Data ou ocorrência inválida para gerar recorrência.");
  }

  if (recurrence === "Semanal" || recurrence === "Quinzenal") {
    const [year, month, day] = dateString.split("-").map(Number);
    const daysToAdd = occurrence * (recurrence === "Semanal" ? 7 : 14);
    return new Date(Date.UTC(year, month - 1, day + daysToAdd))
      .toISOString()
      .slice(0, 10);
  }

  const monthsByFrequency: Record<string, number> = {
    Mensal: 1,
    Bimestral: 2,
    Trimestral: 3,
    Semestral: 6,
    Anual: 12,
  };
  const months = monthsByFrequency[recurrence];
  if (!months) throw new Error("Frequência de recorrência não reconhecida.");

  return addMonthsAnchored(dateString, months * occurrence);
}

function sameSeries(root: Transaction, candidate: Transaction): boolean {
  return (
    candidate.type === root.type &&
    candidate.description.trim().toLocaleLowerCase("pt-BR") ===
      root.description.trim().toLocaleLowerCase("pt-BR") &&
    Number(candidate.amount) === Number(root.amount) &&
    (candidate.category || "") === (root.category || "") &&
    (candidate.subcategory || "") === (root.subcategory || "") &&
    (candidate.account || "") === (root.account || "") &&
    (candidate.destinationAccount || "") === (root.destinationAccount || "") &&
    (candidate.paymentMethod || "") === (root.paymentMethod || "") &&
    candidate.recurrence === root.recurrence
  );
}

type RecurrenceSeries = {
  root: Transaction;
  groupId: string;
  members: Transaction[];
};

/**
 * Gera ocorrências até 12 meses à frente, sem duplicar lançamentos.
 * Reexecutar a função é seguro: ocorrências já existentes são preservadas.
 */
export function expandRecurringTransactions(
  transactions: Transaction[]
): Transaction[] {
  const result = transactions.map((item) => ({ ...item }));
  const recurringItems = result.filter(
    (item) =>
      RECURRENCES.includes(item.recurrence as RecurrenceLabel) &&
      (item.type === "Receita" || item.type === "Despesa") &&
      !isCancelledTransaction(item) &&
      Boolean(item.date) &&
      isValidISODate(item.date || "")
  );

  const grouped = new Map<string, Transaction[]>();
  const ungrouped: Transaction[] = [];

  for (const item of recurringItems) {
    if (!item.recurrenceGroupId) {
      ungrouped.push(item);
      continue;
    }
    const members = grouped.get(item.recurrenceGroupId) ?? [];
    members.push(item);
    grouped.set(item.recurrenceGroupId, members);
  }

  const series: RecurrenceSeries[] = [];

  for (const [groupId, members] of grouped) {
    const ordered = [...members].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
    series.push({ root: ordered[0], groupId, members: ordered });
  }

  for (const root of ungrouped) {
    series.push({
      root,
      groupId: `recorrencia-${root.id}`,
      members: [root],
    });
  }

  const horizon = addMonthsAnchored(localISODate(), 12);

  for (const itemSeries of series) {
    const { root, groupId } = itemSeries;
    if (!root.date || !root.recurrence) continue;

    const rootIndex = result.findIndex((item) => item.id === root.id);
    if (rootIndex < 0) continue;

    result[rootIndex] = { ...result[rootIndex], recurrenceGroupId: groupId };

    const members = result.filter(
      (item) =>
        item.recurrenceGroupId === groupId &&
        sameSeries(root, item) &&
        Boolean(item.date)
    );
    const latestExistingDate = members.reduce(
      (latest, item) => (String(item.date) > latest ? String(item.date) : latest),
      root.date
    );

    let occurrence = 1;
    let nextDate = getNextRecurrenceDate(root.date, root.recurrence, occurrence);

    // Pula as ocorrências já persistidas; limite defensivo para dados antigos.
    while (nextDate <= latestExistingDate && occurrence < 5000) {
      occurrence += 1;
      nextDate = getNextRecurrenceDate(root.date, root.recurrence, occurrence);
    }

    while (nextDate <= horizon && occurrence < 5000) {
      const exists = result.some(
        (item) =>
          item.recurrenceGroupId === groupId &&
          item.date === nextDate &&
          !isCancelledTransaction(item) &&
          sameSeries(root, item)
      );

      if (!exists) {
        let id = Date.now() + occurrence;
        while (result.some((item) => item.id === id)) id += 1;

        result.push({
          ...root,
          id,
          date: nextDate,
          status: "Pendente",
          settledAmount: undefined,
          recurrenceGroupId: groupId,
          createdAt: new Date().toISOString(),
          updatedAt: undefined,
        });
      }

      occurrence += 1;
      nextDate = getNextRecurrenceDate(root.date, root.recurrence, occurrence);
    }
  }

  return result;
}

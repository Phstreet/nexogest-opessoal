
import type { Transaction } from "./types";
import {
  getTransactions,
  saveTransactions,
} from "./storage";

export function getAllInvestments(): Transaction[] {
  return getTransactions().filter(
    (item) =>
      item.type === "Investimento" ||
      item.type === "Aplicação"
  );
}

export function getActiveInvestments(): Transaction[] {
  return getAllInvestments().filter(
    (item) =>
      (item.status ?? "").toLowerCase() === "aplicado"
  );
}

export function getPendingInvestments(): Transaction[] {
  return getAllInvestments().filter((item) => {
    const status = (item.status ?? "").toLowerCase();

    return status === "pendente" || status === "prevista";
  });
}

export function getCancelledInvestments(): Transaction[] {
  return getAllInvestments().filter(
    (item) =>
      (item.status ?? "").toLowerCase() === "cancelada"
  );
}

export function getTotalInvested(): number {
  return getActiveInvestments().reduce(
    (total, item) => total + (Number(item.amount) || 0),
    0
  );
}

export function getInvestmentByInstitution() {
  const investments = getActiveInvestments();
  const result: Record<string, number> = {};

  for (const investment of investments) {
    const institution = investment.institution || "Não informada";

    result[institution] =
      (result[institution] || 0) +
      (Number(investment.amount) || 0);
  }

  return Object.entries(result).map(([institution, amount]) => ({
    institution,
    amount,
  }));
}

export function getInvestmentByType() {
  const investments = getActiveInvestments();
  const result: Record<string, number> = {};

  for (const investment of investments) {
    const type =
      investment.investment ||
      investment.subcategory ||
      investment.category ||
      "Outros";

    result[type] =
      (result[type] || 0) +
      (Number(investment.amount) || 0);
  }

  return Object.entries(result).map(([type, amount]) => ({
    type,
    amount,
  }));
}

export function updateInvestmentStatus(
  id: number,
  status: string
): Transaction {
  const transactions = getTransactions();
  const index = transactions.findIndex((item) => item.id === id);

  if (index === -1) {
    throw new Error("Investimento não encontrado.");
  }

  const investment = transactions[index];

  if (
    investment.type !== "Investimento" &&
    investment.type !== "Aplicação"
  ) {
    throw new Error("O registro informado não é um investimento.");
  }

  const updated: Transaction = {
    ...investment,
    status,
    updatedAt: new Date().toISOString(),
  };

  transactions[index] = updated;

  if (!saveTransactions(transactions)) {
    throw new Error("Não foi possível atualizar o investimento.");
  }

  return updated;
}

export function getInvestmentsByInstitution(
  institution: string
): Transaction[] {
  return getActiveInvestments().filter(
    (item) => item.institution === institution
  );
}

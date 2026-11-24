import type { Transaction } from "./types";
import { addMoney, sumMoney } from "./money";

export function getAllInvestments(transactions: Transaction[]): Transaction[] {
  return transactions.filter((item) => item.type === "Investimento" || item.type === "Aplicação");
}

export function getActiveInvestments(transactions: Transaction[]): Transaction[] {
  return getAllInvestments(transactions).filter((item) => (item.status ?? "").toLowerCase() === "aplicado");
}

export function getPendingInvestments(transactions: Transaction[]): Transaction[] {
  return getAllInvestments(transactions).filter((item) => ["pendente", "prevista"].includes((item.status ?? "").toLowerCase()));
}

export function getCancelledInvestments(transactions: Transaction[]): Transaction[] {
  return getAllInvestments(transactions).filter((item) => (item.status ?? "").toLowerCase().includes("cancel"));
}

export function getTotalInvested(transactions: Transaction[]): number {
  return sumMoney(getActiveInvestments(transactions).map((item) => Number(item.amount) || 0));
}

export function getInvestmentByInstitution(transactions: Transaction[]) {
  const result: Record<string, number> = {};
  for (const investment of getActiveInvestments(transactions)) {
    const institution = investment.institution || "Não informada";
    result[institution] = addMoney(result[institution] || 0, Number(investment.amount) || 0);
  }
  return Object.entries(result).map(([institution, amount]) => ({ institution, amount }));
}

export function getInvestmentByType(transactions: Transaction[]) {
  const result: Record<string, number> = {};
  for (const investment of getActiveInvestments(transactions)) {
    const type = investment.investment || investment.subcategory || investment.category || "Outros";
    result[type] = addMoney(result[type] || 0, Number(investment.amount) || 0);
  }
  return Object.entries(result).map(([type, amount]) => ({ type, amount }));
}

export function updateInvestmentStatus(transactions: Transaction[], id: number, status: string): Transaction[] {
  const target = transactions.find((item) => item.id === id);
  if (!target) throw new Error("Investimento não encontrado.");
  if (target.type !== "Investimento" && target.type !== "Aplicação") throw new Error("O registro informado não é um investimento.");
  return transactions.map((item) => item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item);
}

export function getInvestmentsByInstitution(transactions: Transaction[], institution: string): Transaction[] {
  return getActiveInvestments(transactions).filter((item) => item.institution === institution);
}

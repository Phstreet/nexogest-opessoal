import type { Transaction } from "./types";

export function getAllTransactions(transactions: Transaction[]): Transaction[] {
  return transactions;
}

export function getTransactionById(transactions: Transaction[], id: number): Transaction | undefined {
  return transactions.find((item) => item.id === id);
}

export function createTransaction(transactions: Transaction[], data: Omit<Transaction, "id"> & { id?: number }): Transaction[] {
  const transaction: Transaction = {
    ...data,
    id: data.id ?? Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return [...transactions, transaction];
}

export function updateTransaction(transactions: Transaction[], id: number, changes: Partial<Omit<Transaction, "id">>): Transaction[] {
  if (!transactions.some((item) => item.id === id)) throw new Error("Movimentação não encontrada.");
  return transactions.map((item) => item.id === id ? { ...item, ...changes, id, updatedAt: new Date().toISOString() } : item);
}

export function deleteTransaction(transactions: Transaction[], id: number): Transaction[] {
  return transactions.filter((item) => item.id !== id);
}

export function getTransactionsByType(transactions: Transaction[], type: Transaction["type"]): Transaction[] {
  return transactions.filter((item) => item.type === type);
}

export function getTransactionsByAccount(transactions: Transaction[], accountName: string): Transaction[] {
  return transactions.filter((item) => item.account === accountName || item.destinationAccount === accountName);
}

export function getTransactionsByPeriod(transactions: Transaction[], startDate: string, endDate: string): Transaction[] {
  return transactions.filter((item) => Boolean(item.date && item.date >= startDate && item.date <= endDate));
}

export function updateTransactionStatus(transactions: Transaction[], id: number, status: string): Transaction[] {
  return updateTransaction(transactions, id, { status });
}

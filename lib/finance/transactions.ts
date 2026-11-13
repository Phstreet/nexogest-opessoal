
import type { Transaction } from "./types";
import {
  getTransactions,
  saveTransactions,
} from "./storage";

export function getAllTransactions(): Transaction[] {
  return getTransactions();
}

export function getTransactionById(
  id: number
): Transaction | undefined {
  return getTransactions().find((item) => item.id === id);
}

export function createTransaction(
  data: Omit<Transaction, "id"> & { id?: number }
): Transaction {
  const transactions = getTransactions();

  const transaction: Transaction = {
    ...data,
    id: data.id ?? Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  transactions.push(transaction);

  if (!saveTransactions(transactions)) {
    throw new Error("Não foi possível salvar a movimentação.");
  }

  return transaction;
}

export function updateTransaction(
  id: number,
  changes: Partial<Omit<Transaction, "id">>
): Transaction {
  const transactions = getTransactions();
  const index = transactions.findIndex((item) => item.id === id);

  if (index === -1) {
    throw new Error("Movimentação não encontrada.");
  }

  const updated: Transaction = {
    ...transactions[index],
    ...changes,
    id,
    updatedAt: new Date().toISOString(),
  };

  transactions[index] = updated;

  if (!saveTransactions(transactions)) {
    throw new Error("Não foi possível atualizar a movimentação.");
  }

  return updated;
}

export function deleteTransaction(id: number): boolean {
  const transactions = getTransactions();
  const updated = transactions.filter((item) => item.id !== id);

  if (updated.length === transactions.length) {
    return false;
  }

  if (!saveTransactions(updated)) {
    throw new Error("Não foi possível excluir a movimentação.");
  }

  return true;
}

export function getTransactionsByType(
  type: Transaction["type"]
): Transaction[] {
  return getTransactions().filter((item) => item.type === type);
}

export function getTransactionsByAccount(
  accountName: string
): Transaction[] {
  return getTransactions().filter(
    (item) =>
      item.account === accountName ||
      item.destinationAccount === accountName
  );
}

export function getTransactionsByPeriod(
  startDate: string,
  endDate: string
): Transaction[] {
  return getTransactions().filter((item) => {
    if (!item.date) return false;

    return item.date >= startDate && item.date <= endDate;
  });
}

export function updateTransactionStatus(
  id: number,
  status: string
): Transaction {
  return updateTransaction(id, { status });
}

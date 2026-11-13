
import type { Account, Transaction } from "./types";
import {
  getAccounts,
  getTransactions,
  saveAccounts,
} from "./storage";

export function getAllAccounts(): Account[] {
  return getAccounts();
}

export function getActiveAccounts(): Account[] {
  return getAccounts().filter((account) => account.active);
}

export function getAccountById(id: number): Account | undefined {
  return getAccounts().find((account) => account.id === id);
}

export function createAccount(
  data: Omit<Account, "id" | "createdAt">
): Account {
  const accounts = getAccounts();

  const account: Account = {
    ...data,
    id: Date.now(),
    createdAt: new Date().toISOString(),
  };

  accounts.push(account);

  if (!saveAccounts(accounts)) {
    throw new Error("Não foi possível salvar a conta.");
  }

  return account;
}

export function updateAccount(
  id: number,
  changes: Partial<Omit<Account, "id">>
): Account {
  const accounts = getAccounts();
  const index = accounts.findIndex((item) => item.id === id);

  if (index === -1) {
    throw new Error("Conta não encontrada.");
  }

  const updated: Account = {
    ...accounts[index],
    ...changes,
    id,
  };

  accounts[index] = updated;

  if (!saveAccounts(accounts)) {
    throw new Error("Não foi possível atualizar a conta.");
  }

  return updated;
}

export function setAccountActive(
  id: number,
  active: boolean
): Account {
  return updateAccount(id, { active });
}

export function deleteAccount(id: number): boolean {
  const accounts = getAccounts();
  const account = accounts.find((item) => item.id === id);

  if (!account) return false;

  const transactions = getTransactions();

  const hasMovements = transactions.some(
    (item) =>
      item.account === account.name ||
      item.destinationAccount === account.name
  );

  if (hasMovements) {
    throw new Error(
      "Esta conta possui movimentações vinculadas. Inative-a em vez de excluí-la."
    );
  }

  const updated = accounts.filter((item) => item.id !== id);

  if (!saveAccounts(updated)) {
    throw new Error("Não foi possível excluir a conta.");
  }

  return true;
}

function isEffective(transaction: Transaction): boolean {
  const status = (transaction.status ?? "").toLowerCase();

  return (
    status === "pago" ||
    status === "paga" ||
    status === "recebida" ||
    status === "recebido" ||
    status === "aplicado"
  );
}

export function getAccountBalance(account: Account): number {
  const transactions = getTransactions();

  let balance = account.initialBalance;

  for (const transaction of transactions) {
    if (!isEffective(transaction)) continue;

    const amount = Number(transaction.amount) || 0;

    if (transaction.account === account.name) {
      if (
        transaction.type === "Receita"
      ) {
        balance += amount;
      }

      if (
        transaction.type === "Despesa" ||
        transaction.type === "Investimento" ||
        transaction.type === "Aplicação" ||
        transaction.type === "Reserva"
      ) {
        balance -= amount;
      }

      if (transaction.type === "Transferência") {
        balance -= amount;
      }
    }

    if (
      transaction.type === "Transferência" &&
      transaction.destinationAccount === account.name
    ) {
      balance += amount;
    }
  }

  return balance;
}

export function getTotalAccountsBalance(): number {
  return getActiveAccounts().reduce(
    (total, account) => total + getAccountBalance(account),
    0
  );
}

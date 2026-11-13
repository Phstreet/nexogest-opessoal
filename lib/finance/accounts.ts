
import type { Account, Transaction } from "./types";

import {
  getAccounts,
  getTransactions,
  saveAccounts,
} from "./storage";

// =====================================================
// CONSULTAS DE CONTAS
// =====================================================

export function getAllAccounts(): Account[] {
  return getAccounts();
}

export function getActiveAccounts(): Account[] {
  return getAccounts().filter((account) => account.active);
}

export function getAccountById(
  id: number
): Account | undefined {
  return getAccounts().find((account) => account.id === id);
}

// =====================================================
// GERAÇÃO DE ID
// =====================================================

function generateAccountId(accounts: Account[]): number {
  const existingIds = new Set(
    accounts.map((account) => account.id)
  );

  let id = Date.now();

  while (existingIds.has(id)) {
    id += 1;
  }

  return id;
}

// =====================================================
// CADASTRO
// =====================================================

export function createAccount(
  data: Omit<Account, "id" | "createdAt">
): Account {
  const accounts = getAccounts();

  const normalizedName = data.name.trim().toLowerCase();

  if (!normalizedName) {
    throw new Error("Informe o nome da conta.");
  }

  const duplicate = accounts.some(
    (account) =>
      account.name.trim().toLowerCase() === normalizedName
  );

  if (duplicate) {
    throw new Error("Já existe uma conta com esse nome.");
  }

  if (
    !Number.isFinite(data.initialBalance) ||
    data.initialBalance < 0
  ) {
    throw new Error("Informe um saldo inicial válido.");
  }

  const account: Account = {
    ...data,
    name: data.name.trim(),
    institution: data.institution.trim(),
    id: generateAccountId(accounts),
    createdAt: new Date().toISOString(),
  };

  const updatedAccounts = [...accounts, account];

  if (!saveAccounts(updatedAccounts)) {
    throw new Error("Não foi possível salvar a conta.");
  }

  return account;
}

// =====================================================
// ATUALIZAÇÃO
// =====================================================

export function updateAccount(
  id: number,
  changes: Partial<Omit<Account, "id">>
): Account {
  const accounts = getAccounts();

  const index = accounts.findIndex(
    (account) => account.id === id
  );

  if (index === -1) {
    throw new Error("Conta não encontrada.");
  }

  const currentAccount = accounts[index];

  const updatedName =
    changes.name !== undefined
      ? changes.name.trim()
      : currentAccount.name;

  if (!updatedName) {
    throw new Error("O nome da conta não pode ficar vazio.");
  }

  const duplicate = accounts.some(
    (account) =>
      account.id !== id &&
      account.name.trim().toLowerCase() ===
        updatedName.toLowerCase()
  );

  if (duplicate) {
    throw new Error("Já existe outra conta com esse nome.");
  }

  if (
    changes.initialBalance !== undefined &&
    (
      !Number.isFinite(changes.initialBalance) ||
      changes.initialBalance < 0
    )
  ) {
    throw new Error("Informe um saldo inicial válido.");
  }

  const updated: Account = {
    ...currentAccount,
    ...changes,
    id,
    name: updatedName,
    institution:
      changes.institution !== undefined
        ? changes.institution.trim()
        : currentAccount.institution,
    updatedAt: new Date().toISOString(),
  };

  accounts[index] = updated;

  if (!saveAccounts(accounts)) {
    throw new Error("Não foi possível atualizar a conta.");
  }

  return updated;
}

// =====================================================
// ATIVAÇÃO E INATIVAÇÃO
// =====================================================

export function setAccountActive(
  id: number,
  active: boolean
): Account {
  return updateAccount(id, { active });
}

// =====================================================
// EXCLUSÃO
// =====================================================

export function deleteAccount(id: number): boolean {
  const accounts = getAccounts();

  const account = accounts.find(
    (item) => item.id === id
  );

  if (!account) {
    return false;
  }

  const transactions = getTransactions();

  const hasMovements = transactions.some(
    (transaction) =>
      transaction.account === account.name ||
      transaction.destinationAccount === account.name
  );

  if (hasMovements) {
    throw new Error(
      "Esta conta possui movimentações vinculadas. Inative-a em vez de excluí-la."
    );
  }

  const updatedAccounts = accounts.filter(
    (item) => item.id !== id
  );

  if (!saveAccounts(updatedAccounts)) {
    throw new Error("Não foi possível excluir a conta.");
  }

  return true;
}

// =====================================================
// IDENTIFICAÇÃO DE MOVIMENTAÇÕES EFETIVADAS
// =====================================================

function isEffectiveIncome(
  transaction: Transaction
): boolean {
  const status = (transaction.status ?? "")
    .trim()
    .toLowerCase();

  return (
    transaction.type === "Receita" &&
    (
      status === "recebida" ||
      status === "recebido"
    )
  );
}

function isEffectiveExpense(
  transaction: Transaction
): boolean {
  const status = (transaction.status ?? "")
    .trim()
    .toLowerCase();

  return (
    transaction.type === "Despesa" &&
    (
      status === "pago" ||
      status === "paga"
    )
  );
}

function isEffectiveTransfer(
  transaction: Transaction
): boolean {
  const status = (transaction.status ?? "")
    .trim()
    .toLowerCase();

  return (
    transaction.type === "Transferência" &&
    (
      status === "pago" ||
      status === "paga" ||
      status === "realizada" ||
      status === "concluída" ||
      status === "concluida"
    )
  );
}

// =====================================================
// SALDO INDIVIDUAL DA CONTA
// =====================================================

export function getAccountBalance(
  account: Account
): number {
  const transactions = getTransactions();

  let balance = account.initialBalance;

  for (const transaction of transactions) {
    const amount = Number(transaction.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    const isSourceAccount =
      transaction.account === account.name;

    const isDestinationAccount =
      transaction.destinationAccount === account.name;

    // Receitas efetivamente recebidas.
    if (
      isSourceAccount &&
      isEffectiveIncome(transaction)
    ) {
      balance += amount;
      continue;
    }

    // Despesas efetivamente pagas.
    if (
      isSourceAccount &&
      isEffectiveExpense(transaction)
    ) {
      balance -= amount;
      continue;
    }

    // Transferências efetivamente realizadas.
    if (isEffectiveTransfer(transaction)) {
      if (isSourceAccount) {
        balance -= amount;
      }

      if (isDestinationAccount) {
        balance += amount;
      }
    }
  }

  return balance;
}

// =====================================================
// SALDO TOTAL DAS CONTAS ATIVAS
// =====================================================

export function getTotalAccountsBalance(): number {
  return getActiveAccounts().reduce(
    (total, account) => {
      return total + getAccountBalance(account);
    },
    0
  );
}

// =====================================================
// CONSULTAS AUXILIARES
// =====================================================

export function getAccountTransactions(
  accountName: string
): Transaction[] {
  return getTransactions().filter(
    (transaction) =>
      transaction.account === accountName ||
      transaction.destinationAccount === accountName
  );
}

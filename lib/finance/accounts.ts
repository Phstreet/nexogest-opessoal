
import type { Account, Transaction } from "./types";

import {
  getAccounts,
  getTransactions,
  getReserves,
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
  const existingIds = new Set(accounts.map((account) => account.id));

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

  if (
    data.initialBalanceDate &&
    !isValidDate(data.initialBalanceDate)
  ) {
    throw new Error("Informe uma data válida para o saldo inicial.");
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

  if (
    changes.initialBalanceDate !== undefined &&
    changes.initialBalanceDate !== "" &&
    !isValidDate(changes.initialBalanceDate)
  ) {
    throw new Error("Informe uma data válida para o saldo inicial.");
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
  const reserves = getReserves();

  const hasMovements = transactions.some(
    (transaction) =>
      transaction.account === account.name ||
      transaction.destinationAccount === account.name
  ) || reserves.some((reserve) => reserve.accountId === id);

  if (hasMovements) {
    throw new Error(
      "Esta conta possui movimentações ou reservas vinculadas. Inative-a em vez de excluí-la."
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
// TRATAMENTO DE DATAS
// =====================================================

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

// =====================================================
// NORMALIZAÇÃO DE STATUS
// =====================================================

function normalizeStatus(transaction: Transaction): string {
  return (transaction.status ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isCancelled(transaction: Transaction): boolean {
  const status = normalizeStatus(transaction);

  return (
    status === "cancelada" ||
    status === "cancelado"
  );
}

// =====================================================
// VALOR EFETIVAMENTE MOVIMENTADO
// =====================================================

function getEffectiveAmount(
  transaction: Transaction
): number {
  if (isCancelled(transaction)) {
    return 0;
  }

  const amount = Number(transaction.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  const status = normalizeStatus(transaction);

  // Compatibilidade com lançamentos antigos sem status.
  if (!status) {
    if (
      transaction.type === "Receita" ||
      transaction.type === "Despesa"
    ) {
      return amount;
    }

    return 0;
  }

  if (transaction.type === "Receita") {
    if (
      status === "recebida" ||
      status === "recebido"
    ) {
      return amount;
    }

    if (status === "recebida parcialmente") {
      const settled = Number(transaction.settledAmount || 0);

      return Number.isFinite(settled)
        ? Math.min(Math.max(settled, 0), amount)
        : 0;
    }

    return 0;
  }

  if (transaction.type === "Despesa") {
    if (
      status === "pago" ||
      status === "paga"
    ) {
      return amount;
    }

    if (status === "paga parcialmente") {
      const settled = Number(transaction.settledAmount || 0);

      return Number.isFinite(settled)
        ? Math.min(Math.max(settled, 0), amount)
        : 0;
    }

    return 0;
  }

  // Investimentos só reduzem o saldo da conta
  // quando possuem status explícito de aplicação.
  if (
    transaction.type === "Investimento" ||
    transaction.type === "Aplicação"
  ) {
    return (
      status === "aplicado" ||
      status === "aplicada"
    )
      ? amount
      : 0;
  }

  return 0;
}

// =====================================================
// IDENTIFICAÇÃO DE TRANSFERÊNCIAS
// =====================================================

function isEffectiveTransfer(
  transaction: Transaction
): boolean {
  const status = normalizeStatus(transaction);

  return (
    transaction.type === "Transferência" &&
    !isCancelled(transaction) &&
    (
      status === "pago" ||
      status === "paga" ||
      status === "realizada" ||
      status === "concluida"
    )
  );
}

// =====================================================
// DATA DE REFERÊNCIA DO SALDO INICIAL
// =====================================================

function isBeforeInitialBalanceDate(
  transaction: Transaction,
  account: Account
): boolean {
  const initialDate = account.initialBalanceDate;

  if (!initialDate || !transaction.date) {
    return false;
  }

  return transaction.date.slice(0, 10) < initialDate;
}

// =====================================================
// SALDO INDIVIDUAL DA CONTA
// =====================================================

export function getAccountBalance(
  account: Account
): number {
  const transactions = getTransactions();

  let balance = Number(account.initialBalance) || 0;

  for (const transaction of transactions) {
    if (isCancelled(transaction)) {
      continue;
    }

    if (isBeforeInitialBalanceDate(transaction, account)) {
      continue;
    }

    const isSourceAccount =
      transaction.account === account.name;

    const isDestinationAccount =
      transaction.destinationAccount === account.name;

    // Receitas efetivamente recebidas,
    // incluindo recebimentos parciais.
    if (
      isSourceAccount &&
      transaction.type === "Receita"
    ) {
      balance += getEffectiveAmount(transaction);
      continue;
    }

    // Despesas efetivamente pagas,
    // incluindo pagamentos parciais.
    if (
      isSourceAccount &&
      transaction.type === "Despesa"
    ) {
      balance -= getEffectiveAmount(transaction);
      continue;
    }

    // Investimentos efetivamente aplicados.
    if (
      isSourceAccount &&
      (
        transaction.type === "Investimento" ||
        transaction.type === "Aplicação"
      )
    ) {
      balance -= getEffectiveAmount(transaction);
      continue;
    }

    // Transferências efetivamente realizadas.
    if (isEffectiveTransfer(transaction)) {
      const amount = Number(transaction.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        continue;
      }

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

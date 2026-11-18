import type { Account, Transaction } from "./types";

function normalizeStatus(transaction: Transaction): string {
  return (transaction.status ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isCancelled(transaction: Transaction): boolean {
  const status = normalizeStatus(transaction);
  return status === "cancelada" || status === "cancelado";
}

function getEffectiveAmount(transaction: Transaction): number {
  if (isCancelled(transaction)) return 0;
  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const status = normalizeStatus(transaction);

  if (!status) {
    return transaction.type === "Receita" || transaction.type === "Despesa" ? amount : 0;
  }
  if (transaction.type === "Receita") {
    if (status === "recebida" || status === "recebido") return amount;
    if (status === "recebida parcialmente") {
      const settled = Number(transaction.settledAmount || 0);
      return Number.isFinite(settled) ? Math.min(Math.max(settled, 0), amount) : 0;
    }
    return 0;
  }
  if (transaction.type === "Despesa") {
    if (status === "pago" || status === "paga") return amount;
    if (status === "paga parcialmente") {
      const settled = Number(transaction.settledAmount || 0);
      return Number.isFinite(settled) ? Math.min(Math.max(settled, 0), amount) : 0;
    }
    return 0;
  }
  if (transaction.type === "Investimento" || transaction.type === "Aplicação") {
    return status === "aplicado" || status === "aplicada" ? amount : 0;
  }
  return 0;
}

function isEffectiveTransfer(transaction: Transaction): boolean {
  const status = normalizeStatus(transaction);
  return transaction.type === "Transferência" && !isCancelled(transaction) &&
    (status === "pago" || status === "paga" || status === "realizada" || status === "concluida");
}

function isBeforeInitialBalanceDate(transaction: Transaction, account: Account): boolean {
  const initialDate = account.initialBalanceDate;
  return Boolean(initialDate && transaction.date && transaction.date.slice(0, 10) < initialDate);
}

/** Calcula o saldo usando exclusivamente os lançamentos recebidos do Supabase. */
export function getAccountBalanceFrom(account: Account, transactions: Transaction[]): number {
  let balance = Number(account.initialBalance) || 0;
  for (const transaction of transactions) {
    if (isCancelled(transaction) || isBeforeInitialBalanceDate(transaction, account)) continue;
    const isSourceAccount = transaction.account === account.name;
    const isDestinationAccount = transaction.destinationAccount === account.name;

    if (isSourceAccount && transaction.type === "Receita") {
      balance += getEffectiveAmount(transaction);
      continue;
    }
    if (isSourceAccount && transaction.type === "Despesa") {
      balance -= getEffectiveAmount(transaction);
      continue;
    }
    if (isSourceAccount && (transaction.type === "Investimento" || transaction.type === "Aplicação")) {
      balance -= getEffectiveAmount(transaction);
      continue;
    }
    if (isEffectiveTransfer(transaction)) {
      const amount = Number(transaction.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      if (isSourceAccount) balance -= amount;
      if (isDestinationAccount) balance += amount;
    }
  }
  return balance;
}

export function getAccountBalance(account: Account, transactions: Transaction[]): number {
  return getAccountBalanceFrom(account, transactions);
}

export function getTotalAccountsBalance(accounts: Account[], transactions: Transaction[]): number {
  return accounts.filter((account) => account.active)
    .reduce((total, account) => total + getAccountBalanceFrom(account, transactions), 0);
}

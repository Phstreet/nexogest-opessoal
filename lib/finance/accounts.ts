import type { Account, Transaction } from "./types";

export function normalizeTransactionStatus(transaction: Transaction): string {
  return (transaction.status ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function isCancelledTransaction(transaction: Transaction): boolean {
  const status = normalizeTransactionStatus(transaction);
  return status === "cancelada" || status === "cancelado";
}

/** Regra única de liquidação para resumos e saldos de contas. */
export function getSettledTransactionAmount(transaction: Transaction): number {
  if (isCancelledTransaction(transaction)) return 0;
  const total = Number(transaction.amount);
  if (!Number.isFinite(total) || total <= 0) return 0;

  const status = normalizeTransactionStatus(transaction);
  if (!status) {
    return transaction.type === "Receita" || transaction.type === "Despesa" ? total : 0;
  }

  if (transaction.type === "Receita") {
    if (["recebida", "recebido", "pago", "paga"].includes(status)) return total;
    if (["recebida parcialmente", "paga parcialmente", "parcial"].includes(status)) {
      const settled = Number(transaction.settledAmount ?? 0);
      return Number.isFinite(settled) ? Math.min(Math.max(settled, 0), total) : 0;
    }
    return 0;
  }

  if (transaction.type === "Despesa") {
    if (["pago", "paga"].includes(status)) return total;
    if (["paga parcialmente", "parcial"].includes(status)) {
      const settled = Number(transaction.settledAmount ?? 0);
      return Number.isFinite(settled) ? Math.min(Math.max(settled, 0), total) : 0;
    }
    return 0;
  }

  if (transaction.type === "Investimento" || transaction.type === "Aplicação") {
    return ["aplicado", "aplicada"].includes(status) ? total : 0;
  }
  return 0;
}

function isEffectiveTransfer(transaction: Transaction): boolean {
  const status = normalizeTransactionStatus(transaction);
  return transaction.type === "Transferência" && !isCancelledTransaction(transaction) &&
    ["pago", "paga", "realizada", "concluida"].includes(status);
}

function isBeforeInitialBalanceDate(transaction: Transaction, account: Account): boolean {
  const initialDate = account.initialBalanceDate;
  return Boolean(initialDate && transaction.date && transaction.date.slice(0, 10) < initialDate);
}

/** Calcula o saldo usando exclusivamente os lançamentos recebidos do Supabase. */
export function getAccountBalanceFrom(account: Account, transactions: Transaction[]): number {
  let balance = Number(account.initialBalance) || 0;
  for (const transaction of transactions) {
    if (isCancelledTransaction(transaction) || isBeforeInitialBalanceDate(transaction, account)) continue;
    const isSourceAccount = transaction.account === account.name;
    const isDestinationAccount = transaction.destinationAccount === account.name;

    if (isSourceAccount && transaction.type === "Receita") {
      balance += getSettledTransactionAmount(transaction);
      continue;
    }
    if (isSourceAccount && transaction.type === "Despesa") {
      balance -= getSettledTransactionAmount(transaction);
      continue;
    }
    if (isSourceAccount && (transaction.type === "Investimento" || transaction.type === "Aplicação")) {
      balance -= getSettledTransactionAmount(transaction);
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

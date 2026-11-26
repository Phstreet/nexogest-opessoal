import type { Account, Transaction } from "./types";
import { fromCents, toCents } from "@/lib/utils/currency";

export function normalizeTransactionStatus(transaction: Transaction): string {
  return (transaction.status ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function isCancelledTransaction(transaction: Transaction): boolean {
  const status = normalizeTransactionStatus(transaction);
  return status === "cancelada" || status === "cancelado";
}

function toSafeCents(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  try {
    return toCents(amount);
  } catch {
    return 0;
  }
}

/** Regra única de liquidação para resumos e saldos de contas. */
export function getSettledTransactionAmount(transaction: Transaction): number {
  if (isCancelledTransaction(transaction)) return 0;
  const totalCents = toSafeCents(transaction.amount);
  if (totalCents <= 0) return 0;

  const status = normalizeTransactionStatus(transaction);
  if (!status) {
    return transaction.type === "Receita" || transaction.type === "Despesa"
      ? fromCents(totalCents)
      : 0;
  }

  if (transaction.type === "Receita") {
    if (["recebida", "recebido", "pago", "paga"].includes(status)) {
      return fromCents(totalCents);
    }
    if (["recebida parcialmente", "paga parcialmente", "parcial"].includes(status)) {
      const settledCents = Math.max(0, toSafeCents(transaction.settledAmount));
      return fromCents(Math.min(settledCents, totalCents));
    }
    return 0;
  }

  if (transaction.type === "Despesa") {
    if (["pago", "paga"].includes(status)) return fromCents(totalCents);
    if (["paga parcialmente", "parcial"].includes(status)) {
      const settledCents = Math.max(0, toSafeCents(transaction.settledAmount));
      return fromCents(Math.min(settledCents, totalCents));
    }
    return 0;
  }

  if (transaction.type === "Investimento" || transaction.type === "Aplicação") {
    return ["aplicado", "aplicada"].includes(status) ? fromCents(totalCents) : 0;
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

/** Calcula o saldo em centavos usando exclusivamente os lançamentos recebidos do Supabase. */
export function getAccountBalanceFrom(account: Account, transactions: Transaction[]): number {
  let balanceCents = toSafeCents(account.initialBalance);

  for (const transaction of transactions) {
    if (isCancelledTransaction(transaction) || isBeforeInitialBalanceDate(transaction, account)) continue;
    const isSourceAccount = transaction.account === account.name;
    const isDestinationAccount = transaction.destinationAccount === account.name;

    if (isSourceAccount && transaction.type === "Receita") {
      balanceCents += toSafeCents(getSettledTransactionAmount(transaction));
      continue;
    }
    if (isSourceAccount && transaction.type === "Despesa") {
      balanceCents -= toSafeCents(getSettledTransactionAmount(transaction));
      continue;
    }
    if (isSourceAccount && (transaction.type === "Investimento" || transaction.type === "Aplicação")) {
      balanceCents -= toSafeCents(getSettledTransactionAmount(transaction));
      continue;
    }
    if (isEffectiveTransfer(transaction)) {
      const amountCents = toSafeCents(transaction.amount);
      if (amountCents <= 0) continue;
      if (isSourceAccount) balanceCents -= amountCents;
      if (isDestinationAccount) balanceCents += amountCents;
    }
  }

  return fromCents(balanceCents);
}

export function getAccountBalance(account: Account, transactions: Transaction[]): number {
  return getAccountBalanceFrom(account, transactions);
}

export function getTotalAccountsBalance(accounts: Account[], transactions: Transaction[]): number {
  const totalCents = accounts
    .filter((account) => account.active)
    .reduce(
      (total, account) => total + toSafeCents(getAccountBalanceFrom(account, transactions)),
      0
    );
  return fromCents(totalCents);
}

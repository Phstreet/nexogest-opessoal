import type { Account, FinancialSummary, Reserve, ReserveMovement, Transaction } from "./types";
import { getTotalAccountsBalance, getSettledTransactionAmount, isCancelledTransaction } from "./accounts";
import { addMoney, fromCents, subtractMoney, sumMoney, toCents } from "./money";

function amount(item: Transaction): number {
  const value = Number(item.amount);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function settled(item: Transaction): number {
  return getSettledTransactionAmount(item);
}

function outstanding(item: Transaction): number {
  return item.type === "Receita" || item.type === "Despesa" ? fromCents(Math.max(0, toCents(amount(item)) - toCents(settled(item)))) : 0;
}

export function getTotalReserveBalance(reserves: Reserve[], movements: ReserveMovement[]): number {
  const totalCents = reserves.reduce((total, reserve) => {
    const reserveCents = movements.reduce((balance, item) => {
      if (item.reserveId !== reserve.id) return balance;
      const movementCents = toCents(item.amount);
      if (item.type === "Aporte" || item.type === "Rendimento" || item.type === "Ajuste") return balance + movementCents;
      if (item.type === "Resgate") return balance - movementCents;
      return balance;
    }, toCents(reserve.initialBalance));
    return total + reserveCents;
  }, 0);
  return fromCents(totalCents);
}

export function getFinancialSummary(transactions: Transaction[], accounts: Account[], reserves: Reserve[], movements: ReserveMovement[]): FinancialSummary {
  const active = transactions.filter((item) => !isCancelledTransaction(item));
  const incomes = active.filter((item) => item.type === "Receita");
  const expenses = active.filter((item) => item.type === "Despesa");
  const investments = active.filter((item) => (item.type === "Investimento" || item.type === "Aplicação") && settled(item) > 0);
  const totalIncome = sumMoney(incomes.map(settled));
  const totalExpenses = sumMoney(expenses.map(settled));
  const totalInvestments = sumMoney(investments.map(settled));
  const totalReserves = getTotalReserveBalance(reserves, movements);
  const payable = sumMoney(expenses.map(outstanding));
  const receivable = sumMoney(incomes.map(outstanding));
  const accountsBalance = getTotalAccountsBalance(accounts, transactions);
  const realizedBalance = subtractMoney(totalIncome, totalExpenses);
  return { totalIncome, totalExpenses, totalInvestments, totalReserves, realizedBalance, projectedBalance: addMoney(subtractMoney(realizedBalance, payable), receivable), accountsBalance, payable, receivable };
}

function parseDate(date?: string): Date | null {
  if (!date) return null;
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const y = Number(match[1]), m = Number(match[2]) - 1, d = Number(match[3]);
    const parsed = new Date(y, m, d);
    return parsed.getFullYear() === y && parsed.getMonth() === m && parsed.getDate() === d ? parsed : null;
  }
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getMonthlySummary(transactions: Transaction[], year: number, month: number) {
  const items = transactions.filter((item) => {
    if (isCancelledTransaction(item)) return false;
    const date = parseDate(item.date);
    return date && date.getFullYear() === year && date.getMonth() === month;
  });
  const income = items.filter((item) => item.type === "Receita");
  const expenses = items.filter((item) => item.type === "Despesa");
  const totalIncome = sumMoney(income.map((item) => amount(item)));
  const totalExpenses = sumMoney(expenses.map((item) => amount(item)));
  const received = sumMoney(income.map(settled));
  const paid = sumMoney(expenses.map(settled));
  return { income: totalIncome, expenses: totalExpenses, balance: subtractMoney(totalIncome, totalExpenses), received, paid, pendingIncome: sumMoney(income.map(outstanding)), pendingExpenses: sumMoney(expenses.map(outstanding)) };
}

export function getExpensesByCategory(transactions: Transaction[]) {
  const result: Record<string, number> = {};
  for (const item of transactions.filter((row) => row.type === "Despesa" && !isCancelledTransaction(row))) {
    const category = item.category?.trim() || "Sem categoria";
    result[category] = addMoney(result[category] || 0, amount(item));
  }
  return Object.entries(result).map(([category, value]) => ({ category, amount: value }));
}

export function getIncomeByCategory(transactions: Transaction[]) {
  const result: Record<string, number> = {};
  for (const item of transactions.filter((row) => row.type === "Receita" && !isCancelledTransaction(row))) {
    const category = item.category?.trim() || "Sem categoria";
    result[category] = (result[category] || 0) + amount(item);
  }
  return Object.entries(result).map(([category, value]) => ({ category, amount: value }));
}

export function getAccountsInitialBalance(accounts: Account[]): number {
  return sumMoney(accounts.filter((account) => account.active).map((account) => Number(account.initialBalance) || 0));
}

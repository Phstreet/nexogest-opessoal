import type { Account, FinancialSummary, Reserve, ReserveMovement, Transaction } from "./types";
import { getTotalAccountsBalance } from "./accounts";

function normalizeStatus(item: Transaction): string {
  return (item.status ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isCancelled(item: Transaction): boolean {
  const status = normalizeStatus(item);
  return status === "cancelada" || status === "cancelado";
}

function amount(item: Transaction): number {
  const value = Number(item.amount);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function settled(item: Transaction): number {
  if (isCancelled(item)) return 0;
  const total = amount(item);
  const status = normalizeStatus(item);
  if (item.settledAmount !== undefined) return Math.min(total, Math.max(0, Number(item.settledAmount) || 0));
  if (!status) return item.type === "Receita" || item.type === "Despesa" ? total : 0;
  if (["recebida", "recebido", "pago", "paga"].includes(status)) return total;
  if (status === "recebida parcialmente" || status === "paga parcialmente") return Math.min(total, Math.max(0, Number(item.settledAmount) || 0));
  if (["aplicado", "aplicada"].includes(status) && (item.type === "Investimento" || item.type === "Aplicação")) return total;
  return 0;
}

function outstanding(item: Transaction): number {
  return item.type === "Receita" || item.type === "Despesa" ? Math.max(0, amount(item) - settled(item)) : 0;
}

export function getTotalReserveBalance(reserves: Reserve[], movements: ReserveMovement[]): number {
  return getTotalReserveBalancePure(reserves, movements);
}
function getTotalReserveBalancePure(reserves: Reserve[], movements: ReserveMovement[]): number {
  return getTotalReserveBalanceFromCollections(reserves, movements);
}
function getTotalReserveBalanceFromCollections(reserves: Reserve[], movements: ReserveMovement[]): number {
  return reserves.reduce((total, reserve) => total + movements.filter((item) => item.reserveId === reserve.id).reduce((balance, item) => {
    if (item.type === "Aporte" || item.type === "Rendimento" || item.type === "Ajuste") return balance + item.amount;
    if (item.type === "Resgate") return balance - item.amount;
    return balance;
  }, reserve.initialBalance), 0);
}

export function getFinancialSummary(transactions: Transaction[], accounts: Account[], reserves: Reserve[], movements: ReserveMovement[]): FinancialSummary {
  const active = transactions.filter((item) => !isCancelled(item));
  const incomes = active.filter((item) => item.type === "Receita");
  const expenses = active.filter((item) => item.type === "Despesa");
  const investments = active.filter((item) => (item.type === "Investimento" || item.type === "Aplicação") && settled(item) > 0);
  const totalIncome = incomes.reduce((sum, item) => sum + settled(item), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + settled(item), 0);
  const totalInvestments = investments.reduce((sum, item) => sum + settled(item), 0);
  const totalReserves = getTotalReserveBalancePure(reserves, movements);
  const payable = expenses.reduce((sum, item) => sum + outstanding(item), 0);
  const receivable = incomes.reduce((sum, item) => sum + outstanding(item), 0);
  const accountsBalance = getTotalAccountsBalance(accounts, transactions);
  const realizedBalance = totalIncome - totalExpenses;
  return { totalIncome, totalExpenses, totalInvestments, totalReserves, realizedBalance, projectedBalance: realizedBalance + receivable - payable, accountsBalance, payable, receivable };
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
    if (isCancelled(item)) return false;
    const date = parseDate(item.date);
    return date && date.getFullYear() === year && date.getMonth() === month;
  });
  const income = items.filter((item) => item.type === "Receita");
  const expenses = items.filter((item) => item.type === "Despesa");
  const totalIncome = income.reduce((sum, item) => sum + amount(item), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + amount(item), 0);
  const received = income.reduce((sum, item) => sum + settled(item), 0);
  const paid = expenses.reduce((sum, item) => sum + settled(item), 0);
  return { income: totalIncome, expenses: totalExpenses, balance: totalIncome - totalExpenses, received, paid, pendingIncome: income.reduce((sum, item) => sum + outstanding(item), 0), pendingExpenses: expenses.reduce((sum, item) => sum + outstanding(item), 0) };
}

export function getExpensesByCategory(transactions: Transaction[]) {
  const result: Record<string, number> = {};
  for (const item of transactions.filter((row) => row.type === "Despesa" && !isCancelled(row))) {
    const category = item.category?.trim() || "Sem categoria";
    result[category] = (result[category] || 0) + amount(item);
  }
  return Object.entries(result).map(([category, value]) => ({ category, amount: value }));
}

export function getIncomeByCategory(transactions: Transaction[]) {
  const result: Record<string, number> = {};
  for (const item of transactions.filter((row) => row.type === "Receita" && !isCancelled(row))) {
    const category = item.category?.trim() || "Sem categoria";
    result[category] = (result[category] || 0) + amount(item);
  }
  return Object.entries(result).map(([category, value]) => ({ category, amount: value }));
}

export function getAccountsInitialBalance(accounts: Account[]): number {
  return accounts.filter((account) => account.active).reduce((sum, account) => sum + (Number(account.initialBalance) || 0), 0);
}

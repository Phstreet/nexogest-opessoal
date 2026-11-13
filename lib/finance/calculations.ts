
import type {
    FinancialSummary,
    Transaction,
  } from "./types";
  
  import {
    getTransactions,
    getAccounts,
    getReserves,
  } from "./storage";
  
  import { getTotalAccountsBalance } from "./accounts";
  
  function isCancelled(item: Transaction): boolean {
    return (item.status ?? "").toLowerCase() === "cancelada";
  }
  
  function isPaid(item: Transaction): boolean {
    const status = (item.status ?? "").toLowerCase();
  
    return status === "pago" || status === "paga";
  }
  
  function isReceived(item: Transaction): boolean {
    const status = (item.status ?? "").toLowerCase();
  
    return status === "recebida" || status === "recebido";
  }
  
  function isApplied(item: Transaction): boolean {
    return (item.status ?? "").toLowerCase() === "aplicado";
  }
  
  function sum(items: Transaction[]): number {
    return items.reduce(
      (total, item) => total + (Number(item.amount) || 0),
      0
    );
  }
  
  export function getFinancialSummary(): FinancialSummary {
    const transactions = getTransactions().filter(
      (item) => !isCancelled(item)
    );
  
    const reserves = getReserves();
  
    const incomes = transactions.filter(
      (item) => item.type === "Receita"
    );
  
    const expenses = transactions.filter(
      (item) => item.type === "Despesa"
    );
  
    const investments = transactions.filter(
      (item) =>
        (item.type === "Investimento" ||
          item.type === "Aplicação") &&
        isApplied(item)
    );
  
    const totalIncome = sum(incomes.filter(isReceived));
    const totalExpenses = sum(expenses.filter(isPaid));
    const totalInvestments = sum(investments);
  
    const totalReserves = reserves.reduce(
      (total, reserve) => total + reserve.initialBalance,
      0
    );
  
    const payable = sum(
      expenses.filter((item) => !isPaid(item))
    );
  
    const receivable = sum(
      incomes.filter((item) => !isReceived(item))
    );
  
    const accountsBalance = getTotalAccountsBalance();
  
    const realizedBalance = totalIncome - totalExpenses;
  
    const projectedBalance =
      realizedBalance + receivable - payable;
  
    return {
      totalIncome,
      totalExpenses,
      totalInvestments,
      totalReserves,
      realizedBalance,
      projectedBalance,
      accountsBalance,
      payable,
      receivable,
    };
  }
  
  export function getMonthlySummary(
    year: number,
    month: number
  ) {
    const transactions = getTransactions().filter((item) => {
      if (!item.date || isCancelled(item)) return false;
  
      const date = new Date(`${item.date}T12:00:00`);
  
      return (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === year &&
        date.getMonth() === month
      );
    });
  
    const income = transactions.filter(
      (item) => item.type === "Receita"
    );
  
    const expenses = transactions.filter(
      (item) => item.type === "Despesa"
    );
  
    return {
      income: sum(income),
      expenses: sum(expenses),
      balance: sum(income) - sum(expenses),
      received: sum(income.filter(isReceived)),
      paid: sum(expenses.filter(isPaid)),
      pendingIncome: sum(income.filter((item) => !isReceived(item))),
      pendingExpenses: sum(expenses.filter((item) => !isPaid(item))),
    };
  }
  
  export function getExpensesByCategory() {
    const transactions = getTransactions().filter(
      (item) =>
        item.type === "Despesa" &&
        !isCancelled(item)
    );
  
    const result: Record<string, number> = {};
  
    for (const item of transactions) {
      const category = item.category || "Sem categoria";
  
      result[category] =
        (result[category] || 0) + (Number(item.amount) || 0);
    }
  
    return Object.entries(result).map(([category, amount]) => ({
      category,
      amount,
    }));
  }
  
  export function getIncomeByCategory() {
    const transactions = getTransactions().filter(
      (item) =>
        item.type === "Receita" &&
        !isCancelled(item)
    );
  
    const result: Record<string, number> = {};
  
    for (const item of transactions) {
      const category = item.category || "Sem categoria";
  
      result[category] =
        (result[category] || 0) + (Number(item.amount) || 0);
    }
  
    return Object.entries(result).map(([category, amount]) => ({
      category,
      amount,
    }));
  }
  
  export function getAccountsInitialBalance(): number {
    return getAccounts()
      .filter((account) => account.active)
      .reduce(
        (total, account) => total + account.initialBalance,
        0
      );
  }
  
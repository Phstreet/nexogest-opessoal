
import type {
  FinancialSummary,
  Transaction,
} from "./types";

import {
  getTransactions,
  getAccounts,
  getReserves,
  getReserveMovements,
} from "./storage";

import { getTotalAccountsBalance } from "./accounts";

// =====================================================
// NORMALIZAÇÃO E VALIDAÇÃO
// =====================================================

function normalizeStatus(item: Transaction): string {
  return (item.status ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isCancelled(item: Transaction): boolean {
  const status = normalizeStatus(item);

  return (
    status === "cancelada" ||
    status === "cancelado"
  );
}

function isPaid(item: Transaction): boolean {
  const status = normalizeStatus(item);

  return (
    item.type === "Despesa" &&
    (
      status === "pago" ||
      status === "paga"
    )
  );
}

function isReceived(item: Transaction): boolean {
  const status = normalizeStatus(item);

  return (
    item.type === "Receita" &&
    (
      status === "recebida" ||
      status === "recebido"
    )
  );
}

function isApplied(item: Transaction): boolean {
  const status = normalizeStatus(item);

  return (
    status === "aplicado" ||
    status === "aplicada"
  );
}

function isValidAmount(amount: unknown): amount is number {
  return (
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount >= 0
  );
}

function getAmount(item: Transaction): number {
  const amount = Number(item.amount);

  return Number.isFinite(amount) && amount > 0
    ? amount
    : 0;
}

function sum(items: Transaction[]): number {
  return items.reduce(
    (total, item) => total + getAmount(item),
    0
  );
}

// =====================================================
// CÁLCULO DO SALDO DAS RESERVAS
// =====================================================

export function getTotalReserveBalance(): number {
  const reserves = getReserves();
  const movements = getReserveMovements();

  return reserves.reduce((total, reserve) => {
    let balance = isValidAmount(reserve.initialBalance)
      ? reserve.initialBalance
      : 0;

    const reserveMovements = movements.filter(
      (movement) => movement.reserveId === reserve.id
    );

    for (const movement of reserveMovements) {
      if (!isValidAmount(movement.amount)) {
        continue;
      }

      switch (movement.type) {
        case "Aporte":
        case "Rendimento":
        case "Ajuste":
          balance += movement.amount;
          break;

        case "Resgate":
          balance -= movement.amount;
          break;
      }
    }

    return total + Math.max(0, balance);
  }, 0);
}

// =====================================================
// RESUMO FINANCEIRO GERAL
// =====================================================

export function getFinancialSummary(): FinancialSummary {
  const transactions = getTransactions().filter(
    (item) => !isCancelled(item)
  );

  const incomes = transactions.filter(
    (item) => item.type === "Receita"
  );

  const expenses = transactions.filter(
    (item) => item.type === "Despesa"
  );

  const investments = transactions.filter(
    (item) =>
      (
        item.type === "Investimento" ||
        item.type === "Aplicação"
      ) &&
      isApplied(item)
  );

  // Receitas efetivamente recebidas.
  const totalIncome = sum(
    incomes.filter(isReceived)
  );

  // Despesas efetivamente pagas.
  const totalExpenses = sum(
    expenses.filter(isPaid)
  );

  // Aplicações efetivamente realizadas.
  // Este valor representa aplicações acumuladas,
  // não o patrimônio atualizado dos investimentos.
  const totalInvestments = sum(investments);

  // Saldo atual calculado das reservas.
  const totalReserves = getTotalReserveBalance();

  // Valores ainda não recebidos.
  const payable = sum(
    expenses.filter((item) => !isPaid(item))
  );

  // Valores ainda não recebidos.
  const receivable = sum(
    incomes.filter((item) => !isReceived(item))
  );

  // Saldo das contas bancárias e carteiras ativas.
  const accountsBalance = getTotalAccountsBalance();

  // Resultado das movimentações efetivadas.
  const realizedBalance =
    totalIncome - totalExpenses;

  // Resultado considerando recebimentos e pagamentos pendentes.
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

// =====================================================
// TRATAMENTO DE DATAS
// =====================================================

function parseTransactionDate(
  date: string | undefined
): Date | null {
  if (!date) {
    return null;
  }

  // Trata datas no padrão YYYY-MM-DD sem deslocamento
  // de fuso horário.
  const dateOnlyMatch = date.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);

    const parsed = new Date(year, month, day);

    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month ||
      parsed.getDate() !== day
    ) {
      return null;
    }

    return parsed;
  }

  const parsed = new Date(date);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

// =====================================================
// RESUMO MENSAL
// =====================================================

export function getMonthlySummary(
  year: number,
  month: number
) {
  const transactions = getTransactions().filter((item) => {
    if (isCancelled(item)) {
      return false;
    }

    const date = parseTransactionDate(item.date);

    if (!date) {
      return false;
    }

    return (
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

  const totalIncome = sum(income);
  const totalExpenses = sum(expenses);

  const received = sum(
    income.filter(isReceived)
  );

  const paid = sum(
    expenses.filter(isPaid)
  );

  const pendingIncome = sum(
    income.filter((item) => !isReceived(item))
  );

  const pendingExpenses = sum(
    expenses.filter((item) => !isPaid(item))
  );

  return {
    income: totalIncome,
    expenses: totalExpenses,
    balance: totalIncome - totalExpenses,

    received,
    paid,

    pendingIncome,
    pendingExpenses,
  };
}

// =====================================================
// DESPESAS POR CATEGORIA
// =====================================================

export function getExpensesByCategory() {
  const transactions = getTransactions().filter(
    (item) =>
      item.type === "Despesa" &&
      !isCancelled(item)
  );

  const result: Record<string, number> = {};

  for (const item of transactions) {
    const category =
      item.category?.trim() || "Sem categoria";

    result[category] =
      (result[category] || 0) + getAmount(item);
  }

  return Object.entries(result).map(
    ([category, amount]) => ({
      category,
      amount,
    })
  );
}

// =====================================================
// RECEITAS POR CATEGORIA
// =====================================================

export function getIncomeByCategory() {
  const transactions = getTransactions().filter(
    (item) =>
      item.type === "Receita" &&
      !isCancelled(item)
  );

  const result: Record<string, number> = {};

  for (const item of transactions) {
    const category =
      item.category?.trim() || "Sem categoria";

    result[category] =
      (result[category] || 0) + getAmount(item);
  }

  return Object.entries(result).map(
    ([category, amount]) => ({
      category,
      amount,
    })
  );
}

// =====================================================
// SALDO INICIAL DAS CONTAS ATIVAS
// =====================================================

export function getAccountsInitialBalance(): number {
  return getAccounts()
    .filter((account) => account.active)
    .reduce(
      (total, account) => {
        const initialBalance = Number(
          account.initialBalance
        );

        return (
          total +
          (
            Number.isFinite(initialBalance)
              ? initialBalance
              : 0
          )
        );
      },
      0
    );
}

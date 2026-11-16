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

/**
 * Retorna o valor efetivamente recebido ou pago.
 *
 * Compatibilidade:
 * lançamentos antigos sem status continuam sendo
 * considerados integralmente efetivados.
 */
function getSettledAmount(item: Transaction): number {
  if (isCancelled(item)) {
    return 0;
  }

  const amount = getAmount(item);

  if (amount <= 0) {
    return 0;
  }

  const status = normalizeStatus(item);

  // Compatibilidade com lançamentos antigos.
  if (!status) {
    if (
      item.type === "Receita" ||
      item.type === "Despesa"
    ) {
      return amount;
    }

    if (
      item.type === "Investimento" ||
      item.type === "Aplicação"
    ) {
      return amount;
    }

    return 0;
  }

  if (item.type === "Receita") {
    if (
      status === "recebida" ||
      status === "recebido"
    ) {
      return amount;
    }

    if (status === "recebida parcialmente") {
      const settled = Number(item.settledAmount || 0);

      return Number.isFinite(settled)
        ? Math.min(Math.max(settled, 0), amount)
        : 0;
    }

    return 0;
  }

  if (item.type === "Despesa") {
    if (
      status === "pago" ||
      status === "paga"
    ) {
      return amount;
    }

    if (status === "paga parcialmente") {
      const settled = Number(item.settledAmount || 0);

      return Number.isFinite(settled)
        ? Math.min(Math.max(settled, 0), amount)
        : 0;
    }

    return 0;
  }

  if (
    item.type === "Investimento" ||
    item.type === "Aplicação"
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

/**
 * Calcula o valor que ainda falta receber ou pagar.
 */
function getOutstandingAmount(item: Transaction): number {
  if (isCancelled(item)) {
    return 0;
  }

  if (
    item.type !== "Receita" &&
    item.type !== "Despesa"
  ) {
    return 0;
  }

  return Math.max(
    0,
    getAmount(item) - getSettledAmount(item)
  );
}

function sum(items: Transaction[]): number {
  return items.reduce(
    (total, item) => total + getAmount(item),
    0
  );
}

function sumSettled(items: Transaction[]): number {
  return items.reduce(
    (total, item) => total + getSettledAmount(item),
    0
  );
}

function sumOutstanding(items: Transaction[]): number {
  return items.reduce(
    (total, item) => total + getOutstandingAmount(item),
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
      getSettledAmount(item) > 0
  );

  // Valores efetivamente recebidos.
  const totalIncome = sumSettled(incomes);

  // Valores efetivamente pagos.
  const totalExpenses = sumSettled(expenses);

  // Aplicações efetivamente realizadas.
  // Representa aplicações acumuladas, não o
  // patrimônio atualizado dos investimentos.
  const totalInvestments = sum(investments);

  // Saldo atual calculado das reservas.
  const totalReserves = getTotalReserveBalance();

  // Somente o valor que ainda falta pagar.
  const payable = sumOutstanding(expenses);

  // Somente o valor que ainda falta receber.
  const receivable = sumOutstanding(incomes);

  // Saldo das contas bancárias e carteiras ativas.
  const accountsBalance = getTotalAccountsBalance();

  // Resultado das movimentações efetivadas.
  const realizedBalance =
    totalIncome - totalExpenses;

  // Resultado considerando valores ainda pendentes.
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

  // Valores totais lançados no período.
  const totalIncome = sum(income);
  const totalExpenses = sum(expenses);

  // Valores efetivamente recebidos e pagos.
  const received = sumSettled(income);
  const paid = sumSettled(expenses);

  // Saldo que ainda falta receber e pagar.
  const pendingIncome = sumOutstanding(income);
  const pendingExpenses = sumOutstanding(expenses);

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
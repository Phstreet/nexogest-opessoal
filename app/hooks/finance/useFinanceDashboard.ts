
"use client";

import { useMemo, useState } from "react";

import type { Transaction } from "@/lib/finance/types";

import { useCloudFinanceCollections } from "@/hooks/useCloudFinanceCollections";
import { getAccountBalanceFrom } from "@/lib/finance/accounts";
import { calculateReserveBalance } from "@/lib/finance/reserves";

// =====================================================
// TIPOS
// =====================================================

export type MonthData = {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  investments: number;
  reserves: number;
  balance: number;
  confirmedExpenses: number;
  pendingExpenses: number;
  projected: boolean;
};

export type ForecastMonth = MonthData & {
  estimated: boolean;
};

export type Recommendation = {
  title: string;
  description: string;
  type: "warning" | "success" | "info";
};

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function parseAmount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(status?: string): string {
  return (status ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function getMonthLabel(
  date: Date,
  short = false
): string {
  return date.toLocaleDateString("pt-BR", {
    month: short ? "short" : "long",
    year: "numeric",
  });
}

function getDateFromKey(key?: string): Date | null {
  if (!key) return null;

  const match = key.match(
    /^(\d{4})-(\d{2})(?:-(\d{2}))?$/
  );

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] ? Number(match[3]) : 1;

  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return new Date(year, month - 1, 1);
}

function getMonthStart(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function isCancelled(
  transaction: Transaction
): boolean {
  const status = normalizeStatus(transaction.status);

  return (
    status === "cancelada" ||
    status === "cancelado"
  );
}

/**
 * Retorna o valor efetivamente recebido ou pago.
 *
 * Regras:
 * - settledAmount informado prevalece.
 * - Pago/Paga/Recebida/Recebido sem settledAmount
 *   representam quitação integral.
 * - Status parcial sem settledAmount não presume
 *   quitação integral.
 * - O valor nunca ultrapassa o lançamento.
 */
function getSettledAmount(
  transaction: Transaction
): number {
  const amount = Math.max(
    0,
    parseAmount(transaction.amount)
  );

  if (
    transaction.settledAmount !== undefined &&
    transaction.settledAmount !== null
  ) {
    return Math.min(
      amount,
      Math.max(
        0,
        parseAmount(transaction.settledAmount)
      )
    );
  }

  const status = normalizeStatus(transaction.status);

  if (
    status === "pago" ||
    status === "paga" ||
    status === "recebida" ||
    status === "recebido" ||
    status === "aplicado" ||
    status === "aplicada" ||
    status === "realizada" ||
    status === "concluida"
  ) {
    return amount;
  }

  return 0;
}

function sumTransactions(
  transactions: Transaction[]
): number {
  return transactions.reduce(
    (total, transaction) =>
      total + parseAmount(transaction.amount),
    0
  );
}

function sumSettledTransactions(
  transactions: Transaction[]
): number {
  return transactions.reduce(
    (total, transaction) =>
      total + getSettledAmount(transaction),
    0
  );
}

// =====================================================
// HOOK PRINCIPAL
// =====================================================

export function useFinanceDashboard() {
  const { transactions, accounts, reserves, reserveMovements, loaded } = useCloudFinanceCollections();
  const [period, setPeriod] = useState<"3" | "6">("6");

  const today = useMemo(() => new Date(), []);

  const currentMonthKey = getMonthKey(today);

  // =====================================================
  // LANÇAMENTOS VÁLIDOS
  // =====================================================

  const validTransactions = useMemo(() => {
    return transactions.filter(
      (transaction) =>
        !isCancelled(transaction) &&
        Boolean(transaction.date) &&
        Boolean(getDateFromKey(transaction.date))
    );
  }, [transactions]);

  const currentMonthTransactions = useMemo(() => {
    return validTransactions.filter(
      (transaction) =>
        transaction.date?.slice(0, 7) === currentMonthKey
    );
  }, [validTransactions, currentMonthKey]);

  const previousMonthKey = useMemo(() => {
    return getMonthKey(
      new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1
      )
    );
  }, [today]);

  const previousMonthTransactions = useMemo(() => {
    return validTransactions.filter(
      (transaction) =>
        transaction.date?.slice(0, 7) === previousMonthKey
    );
  }, [validTransactions, previousMonthKey]);

  // =====================================================
  // INDICADORES DO MÊS ATUAL
  // =====================================================

  const currentRevenue = useMemo(() => {
    return sumTransactions(
      currentMonthTransactions.filter(
        (transaction) => transaction.type === "Receita"
      )
    );
  }, [currentMonthTransactions]);

  const currentExpenses = useMemo(() => {
    return sumTransactions(
      currentMonthTransactions.filter(
        (transaction) => transaction.type === "Despesa"
      )
    );
  }, [currentMonthTransactions]);

  const currentInvestments = useMemo(() => {
    return sumSettledTransactions(
      currentMonthTransactions.filter(
        (transaction) =>
          transaction.type === "Investimento" ||
          transaction.type === "Aplicação"
      )
    );
  }, [currentMonthTransactions]);

  const currentReserves = useMemo(() => {
    return sumSettledTransactions(
      currentMonthTransactions.filter(
        (transaction) => transaction.type === "Reserva"
      )
    );
  }, [currentMonthTransactions]);

  // Valores efetivamente pagos e recebidos.

  const currentConfirmedExpenses = useMemo(() => {
    return sumSettledTransactions(
      currentMonthTransactions.filter(
        (transaction) => transaction.type === "Despesa"
      )
    );
  }, [currentMonthTransactions]);

  const currentConfirmedRevenue = useMemo(() => {
    return sumSettledTransactions(
      currentMonthTransactions.filter(
        (transaction) => transaction.type === "Receita"
      )
    );
  }, [currentMonthTransactions]);

  // Despesas pendentes representam a diferença
  // entre o valor cadastrado e o valor efetivamente pago.

  const currentPendingExpenses = useMemo(() => {
    return Math.max(
      0,
      currentExpenses - currentConfirmedExpenses
    );
  }, [
    currentExpenses,
    currentConfirmedExpenses,
  ]);

  // Resultado realizado: considera somente valores efetivamente
  // recebidos/pagos, sem tratar compromissos pendentes como caixa.
  const currentBalance =
    currentConfirmedRevenue -
    currentConfirmedExpenses -
    currentInvestments -
    currentReserves;

  // =====================================================
  // COMPARAÇÃO COM O MÊS ANTERIOR
  // =====================================================

  const previousRevenue = useMemo(() => {
    return sumTransactions(
      previousMonthTransactions.filter(
        (transaction) => transaction.type === "Receita"
      )
    );
  }, [previousMonthTransactions]);

  const previousExpenses = useMemo(() => {
    return sumTransactions(
      previousMonthTransactions.filter(
        (transaction) => transaction.type === "Despesa"
      )
    );
  }, [previousMonthTransactions]);

  const expenseVariation = useMemo(() => {
    if (previousExpenses === 0) {
      return currentExpenses > 0 ? 100 : 0;
    }

    return (
      ((currentExpenses - previousExpenses) /
        previousExpenses) *
      100
    );
  }, [
    currentExpenses,
    previousExpenses,
  ]);

  // =====================================================
  // SALDOS INICIAIS DAS CONTAS
  // =====================================================

  const accountBalance = useMemo(() => {
    return accounts
      .filter((account) => account.active)
      .reduce((total, account) => total + getAccountBalanceFrom(account, transactions), 0);
  }, [accounts, transactions]);

  const reserveBalance = useMemo(
    () =>
      reserves
        .filter((reserve) => reserve.status === "Ativa")
        .reduce(
          (total, reserve) =>
            total + calculateReserveBalance(reserve, reserveMovements),
          0
        ),
    [reserves, reserveMovements]
  );

  // =====================================================
  // HISTÓRICO MENSAL
  // =====================================================

  const monthlyData = useMemo<MonthData[]>(() => {
    const result: MonthData[] = [];

    // Dois meses anteriores, mês atual
    // e seis meses futuros.

    for (let offset = -2; offset <= 6; offset++) {
      const date = new Date(
        today.getFullYear(),
        today.getMonth() + offset,
        1
      );

      const key = getMonthKey(date);
      const isFuture = offset > 0;

      const monthTransactions = validTransactions.filter(
        (transaction) =>
          transaction.date?.slice(0, 7) === key
      );

      const revenue = sumTransactions(
        monthTransactions.filter(
          (transaction) => transaction.type === "Receita"
        )
      );

      const expenses = sumTransactions(
        monthTransactions.filter(
          (transaction) => transaction.type === "Despesa"
        )
      );

      const investments = sumSettledTransactions(
        monthTransactions.filter(
          (transaction) =>
            transaction.type === "Investimento" ||
            transaction.type === "Aplicação"
        )
      );

      const reserves = sumSettledTransactions(
        monthTransactions.filter(
          (transaction) => transaction.type === "Reserva"
        )
      );

      const confirmedExpenses = sumSettledTransactions(
        monthTransactions.filter(
          (transaction) => transaction.type === "Despesa"
        )
      );

      const confirmedRevenue = sumSettledTransactions(
        monthTransactions.filter(
          (transaction) => transaction.type === "Receita"
        )
      );

      const pendingExpenses = Math.max(
        0,
        expenses - confirmedExpenses
      );

      result.push({
        key,
        label: getMonthLabel(date, true),
        revenue,
        expenses,
        investments,
        reserves,
        balance:
          confirmedRevenue -
          confirmedExpenses -
          investments -
          reserves,
        confirmedExpenses,
        pendingExpenses,
        projected: isFuture,
      });
    }

    return result;
  }, [validTransactions, today]);

  const futureMonths = useMemo(() => {
    return monthlyData.filter((month) => {
      const date = getDateFromKey(month.key);

      return (
        date !== null &&
        date > getMonthStart(today)
      );
    });
  }, [monthlyData, today]);

  const historicalMonths = useMemo(() => {
    return monthlyData.filter((month) => {
      const date = getDateFromKey(month.key);

      return (
        date !== null &&
        date < getMonthStart(today)
      );
    });
  }, [monthlyData, today]);

  // =====================================================
  // MÉDIAS HISTÓRICAS
  // =====================================================

  // A projeção usa os três últimos meses completos.
  // Meses sem movimentação daquela natureza não entram na média,
  // evitando distorcer o histórico quando o cadastro começou há pouco.
  const projectionHistory = useMemo(() => {
    return [1, 2, 3].map((monthsAgo) => {
      const date = new Date(
        today.getFullYear(),
        today.getMonth() - monthsAgo,
        1
      );
      const key = getMonthKey(date);
      const monthTransactions = validTransactions.filter(
        (transaction) => transaction.date?.slice(0, 7) === key
      );

      return {
        revenue: sumTransactions(
          monthTransactions.filter(
            (transaction) => transaction.type === "Receita"
          )
        ),
        expenses: sumTransactions(
          monthTransactions.filter(
            (transaction) => transaction.type === "Despesa"
          )
        ),
      };
    });
  }, [validTransactions, today]);

  const averageRevenue = useMemo(() => {
    const monthsWithRevenue = projectionHistory.filter(
      (month) => month.revenue > 0
    );

    if (!monthsWithRevenue.length) {
      return currentRevenue;
    }

    return (
      monthsWithRevenue.reduce(
        (total, month) => total + month.revenue,
        0
      ) / monthsWithRevenue.length
    );
  }, [projectionHistory, currentRevenue]);

  const averageExpenses = useMemo(() => {
    const monthsWithExpenses = projectionHistory.filter(
      (month) => month.expenses > 0
    );

    if (!monthsWithExpenses.length) {
      return currentExpenses;
    }

    return (
      monthsWithExpenses.reduce(
        (total, month) => total + month.expenses,
        0
      ) / monthsWithExpenses.length
    );
  }, [projectionHistory, currentExpenses]);

  // =====================================================
  // PROJEÇÕES
  // =====================================================

  const forecastData = useMemo<ForecastMonth[]>(() => {
    return futureMonths.map((month) => {
      const monthTransactions = validTransactions.filter(
        (transaction) => transaction.date?.slice(0, 7) === month.key
      );

      const registeredRevenue = monthTransactions.filter(
        (transaction) => transaction.type === "Receita"
      );
      const registeredExpenses = monthTransactions.filter(
        (transaction) => transaction.type === "Despesa"
      );

      // Cada natureza é projetada de forma independente:
      // um lançamento de despesa não elimina a estimativa de receita,
      // e um lançamento de receita não elimina a estimativa de despesas.
      const hasRegisteredRevenue = registeredRevenue.length > 0;
      const hasRegisteredExpenses = registeredExpenses.length > 0;

      const revenue = hasRegisteredRevenue
        ? sumTransactions(registeredRevenue)
        : averageRevenue;

      const expenses = hasRegisteredExpenses
        ? sumTransactions(registeredExpenses)
        : averageExpenses;

      // Compromissos futuros de investimento e reserva também entram
      // na projeção, mesmo quando ainda estão pendentes.
      const investments = sumTransactions(
        monthTransactions.filter(
          (transaction) =>
            transaction.type === "Investimento" ||
            transaction.type === "Aplicação"
        )
      );

      const reserves = sumTransactions(
        monthTransactions.filter(
          (transaction) => transaction.type === "Reserva"
        )
      );

      return {
        ...month,
        revenue,
        expenses,
        investments,
        reserves,
        balance: revenue - expenses - investments - reserves,
        projected: true,
        // Indica estimativa quando falta previsão de receita ou despesa.
        estimated: !hasRegisteredRevenue || !hasRegisteredExpenses,
      };
    });
  }, [
    futureMonths,
    validTransactions,
    averageRevenue,
    averageExpenses,
  ]);

  const visibleForecast = useMemo(() => {
    return forecastData.slice(0, Number(period));
  }, [
    forecastData,
    period,
  ]);

  const averageFutureBalance = useMemo(() => {
    if (!visibleForecast.length) return 0;

    return (
      visibleForecast.reduce(
        (total, month) => total + month.balance,
        0
      ) / visibleForecast.length
    );
  }, [visibleForecast]);

  const totalFutureExpenses = useMemo(() => {
    return visibleForecast.reduce(
      (total, month) => total + month.expenses,
      0
    );
  }, [visibleForecast]);

  const totalFutureRevenue = useMemo(() => {
    return visibleForecast.reduce(
      (total, month) => total + month.revenue,
      0
    );
  }, [visibleForecast]);

  // =====================================================
  // CATEGORIAS DE DESPESAS
  // =====================================================

  const categoryExpenses = useMemo(() => {
    const totals: Record<string, number> = {};

    currentMonthTransactions
      .filter(
        (transaction) => transaction.type === "Despesa"
      )
      .forEach((transaction) => {
        const category =
          transaction.category || "Sem categoria";

        totals[category] =
          (totals[category] || 0) +
          parseAmount(transaction.amount);
      });

    return Object.entries(totals)
      .map(([category, amount]) => ({
        category,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [currentMonthTransactions]);

  const totalCategoryExpenses = useMemo(() => {
    return categoryExpenses.reduce(
      (total, item) => total + item.amount,
      0
    );
  }, [categoryExpenses]);

  const highestCategory = categoryExpenses[0];

  const maxCategoryValue = Math.max(
    ...categoryExpenses.map((item) => item.amount),
    1
  );

  // =====================================================
  // INDICADORES DOS GRÁFICOS
  // =====================================================

  const maxChartValue = Math.max(
    ...monthlyData.map((month) =>
      Math.max(
        month.revenue,
        month.expenses,
        1
      )
    ),
    1
  );

  // =====================================================
  // METAS E ECONOMIA
  // =====================================================

  const monthlySavingsTarget = useMemo(() => {
    if (averageRevenue <= 0) return 0;

    return averageRevenue * 0.1;
  }, [averageRevenue]);

  const recommendedSpendingLimit = useMemo(() => {
    const projectedRevenue =
      averageRevenue || currentRevenue;

    return Math.max(
      0,
      projectedRevenue - monthlySavingsTarget
    );
  }, [
    averageRevenue,
    currentRevenue,
    monthlySavingsTarget,
  ]);

  const availableToSpend = Math.max(
    0,
    recommendedSpendingLimit - currentExpenses
  );

  // A taxa de economia usa somente entradas e saídas efetivadas,
  // mantendo coerência com o resultado realizado do mês.
  const savingsRate =
    currentConfirmedRevenue > 0
      ? (
          (currentConfirmedRevenue -
            currentConfirmedExpenses -
            currentInvestments -
            currentReserves) /
          currentConfirmedRevenue
        ) * 100
      : 0;

  // =====================================================
  // SITUAÇÃO FINANCEIRA
  // =====================================================

  const redMonths = forecastData.filter(
    (month) => month.balance < 0
  ).length;

  const currentMonthName = today.toLocaleDateString(
    "pt-BR",
    {
      month: "long",
      year: "numeric",
    }
  );

  const financialSituation:
    | "negative"
    | "neutral"
    | "positive" =
    currentBalance < 0
      ? "negative"
      : currentBalance === 0
        ? "neutral"
        : "positive";

  // =====================================================
  // RECOMENDAÇÕES
  // =====================================================

  const recommendations = useMemo<Recommendation[]>(() => {
    const items: Recommendation[] = [];

    if (currentBalance < 0) {
      items.push({
        title: "Seu mês está no vermelho",
        description: `As despesas e compromissos superam as receitas em ${money(
          Math.abs(currentBalance)
        )}. Priorize reduzir gastos variáveis e evitar novas parcelas.`,
        type: "warning",
      });
    } else if (currentBalance > 0) {
      items.push({
        title: "Você está com saldo positivo",
        description: `Seu resultado registrado está positivo em ${money(
          currentBalance
        )}. Considere direcionar parte desse valor para sua reserva financeira.`,
        type: "success",
      });
    }

    if (expenseVariation > 10) {
      items.push({
        title: "Atenção ao aumento das despesas",
        description: `Seus lançamentos de despesas estão ${expenseVariation.toFixed(
          1
        )}% acima do mês anterior.`,
        type: "warning",
      });
    } else if (
      previousExpenses > 0 &&
      expenseVariation < 0
    ) {
      items.push({
        title: "Você reduziu seus gastos",
        description: `As despesas registradas caíram ${Math.abs(
          expenseVariation
        ).toFixed(
          1
        )}% em relação ao mês anterior.`,
        type: "success",
      });
    }

    if (
      highestCategory &&
      totalCategoryExpenses > 0
    ) {
      const percentage =
        (highestCategory.amount /
          totalCategoryExpenses) *
        100;

      items.push({
        title: `Revise seus gastos com ${highestCategory.category}`,
        description: `Essa categoria representa ${percentage.toFixed(
          1
        )}% das suas despesas registradas neste mês.`,
        type:
          percentage >= 40
            ? "warning"
            : "info",
      });
    }

    if (
      currentRevenue > 0 &&
      savingsRate < 10
    ) {
      items.push({
        title: "Aumente sua margem de economia",
        description:
          "Seu resultado está abaixo da meta de economia de 10%. Comece reduzindo despesas não essenciais.",
        type: "info",
      });
    }

    if (redMonths > 0) {
      items.push({
        title: "Prepare-se para os próximos meses",
        description: `A projeção indica ${redMonths} ${
          redMonths === 1 ? "mês" : "meses"
        } com resultado negativo. Revise os compromissos futuros antes de assumir novas despesas.`,
        type: "warning",
      });
    }

    if (!items.length) {
      items.push({
        title: "Continue acompanhando seu orçamento",
        description:
          "Mantenha seus lançamentos atualizados para melhorar a precisão das projeções financeiras.",
        type: "info",
      });
    }

    return items;
  }, [
    currentBalance,
    expenseVariation,
    previousExpenses,
    highestCategory,
    totalCategoryExpenses,
    currentRevenue,
    savingsRate,
    redMonths,
  ]);

  // =====================================================
  // RETORNO PARA A PÁGINA E COMPONENTES
  // =====================================================

  return {
    loaded,

    transactions,
    accounts,

    period,
    setPeriod,

    today,
    currentMonthKey,
    currentMonthName,

    currentMonthTransactions,
    previousMonthTransactions,

    currentRevenue,
    currentExpenses,
    currentInvestments,
    currentReserves,

    currentConfirmedExpenses,
    currentConfirmedRevenue,
    currentPendingExpenses,
    currentBalance,

    previousRevenue,
    previousExpenses,
    expenseVariation,

    accountBalance,
    reserveBalance,

    monthlyData,
    futureMonths,
    historicalMonths,

    averageRevenue,
    averageExpenses,

    forecastData,
    visibleForecast,
    averageFutureBalance,
    totalFutureExpenses,
    totalFutureRevenue,

    categoryExpenses,
    totalCategoryExpenses,
    highestCategory,
    maxCategoryValue,
    maxChartValue,

    monthlySavingsTarget,
    recommendedSpendingLimit,
    availableToSpend,
    savingsRate,

    redMonths,
    financialSituation,
    recommendations,

    money,
  };
}

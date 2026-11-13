
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MovementType =
  | "Receita"
  | "Despesa"
  | "Transferência"
  | "Investimento"
  | "Aplicação"
  | "Reserva";

type Transaction = {
  id: number;
  description: string;
  type: MovementType;
  amount: number;
  date?: string;
  category?: string;
  subcategory?: string;
  account?: string;
  destinationAccount?: string;
  paymentMethod?: string;
  status?: string;
  recurrence?: string;
  reserveType?: string;
  investment?: string;
  institution?: string;
};

type Account = {
  id: number;
  name: string;
  institution: string;
  type: string;
  initialBalance: number;
  createdAt: string;
  active: boolean;
};

type MonthData = {
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

const TRANSACTIONS_KEY = "nexo_transactions";
const ACCOUNTS_KEY = "nexo_accounts";

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function parseAmount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date: Date, short = false) {
  return date.toLocaleDateString("pt-BR", {
    month: short ? "short" : "long",
    year: "numeric",
  });
}

function getDateFromKey(key?: string) {
  if (!key) return null;

  const parts = key.split("-").map(Number);

  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return null;
  }

  return new Date(parts[0], parts[1] - 1, 1);
}

function isCancelled(transaction: Transaction) {
  return transaction.status?.toLowerCase() === "cancelada";
}

function isConfirmedExpense(transaction: Transaction) {
  return transaction.status?.toLowerCase() === "pago";
}

function isConfirmedRevenue(transaction: Transaction) {
  return transaction.status?.toLowerCase() === "recebida";
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function FinancialDashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [period, setPeriod] = useState<"3" | "6">("6");

  const today = useMemo(() => new Date(), []);
  const currentMonthKey = getMonthKey(today);

  useEffect(() => {
    try {
      const storedTransactions = localStorage.getItem(TRANSACTIONS_KEY);
      const storedAccounts = localStorage.getItem(ACCOUNTS_KEY);

      if (storedTransactions) {
        const parsed = JSON.parse(storedTransactions);

        if (Array.isArray(parsed)) {
          setTransactions(parsed);
        }
      }

      if (storedAccounts) {
        const parsed = JSON.parse(storedAccounts);

        if (Array.isArray(parsed)) {
          setAccounts(parsed);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados financeiros:", error);
    } finally {
      setLoaded(true);
    }
  }, []);

  const validTransactions = useMemo(() => {
    return transactions.filter(
      (transaction) =>
        !isCancelled(transaction) &&
        transaction.date &&
        getDateFromKey(transaction.date)
    );
  }, [transactions]);

  const currentMonthTransactions = useMemo(() => {
    return validTransactions.filter(
      (transaction) => transaction.date?.slice(0, 7) === currentMonthKey
    );
  }, [validTransactions, currentMonthKey]);

  const previousMonthKey = useMemo(() => {
    const date = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return getMonthKey(date);
  }, [today]);

  const previousMonthTransactions = useMemo(() => {
    return validTransactions.filter(
      (transaction) => transaction.date?.slice(0, 7) === previousMonthKey
    );
  }, [validTransactions, previousMonthKey]);

  const currentRevenue = useMemo(() => {
    return currentMonthTransactions
      .filter((transaction) => transaction.type === "Receita")
      .reduce((total, transaction) => total + parseAmount(transaction.amount), 0);
  }, [currentMonthTransactions]);

  const currentExpenses = useMemo(() => {
    return currentMonthTransactions
      .filter((transaction) => transaction.type === "Despesa")
      .reduce((total, transaction) => total + parseAmount(transaction.amount), 0);
  }, [currentMonthTransactions]);

  const currentInvestments = useMemo(() => {
    return currentMonthTransactions
      .filter(
        (transaction) =>
          transaction.type === "Investimento" ||
          transaction.type === "Aplicação"
      )
      .reduce((total, transaction) => total + parseAmount(transaction.amount), 0);
  }, [currentMonthTransactions]);

  const currentReserves = useMemo(() => {
    return currentMonthTransactions
      .filter((transaction) => transaction.type === "Reserva")
      .reduce((total, transaction) => total + parseAmount(transaction.amount), 0);
  }, [currentMonthTransactions]);

  const currentConfirmedExpenses = useMemo(() => {
    return currentMonthTransactions
      .filter(
        (transaction) =>
          transaction.type === "Despesa" && isConfirmedExpense(transaction)
      )
      .reduce((total, transaction) => total + parseAmount(transaction.amount), 0);
  }, [currentMonthTransactions]);

  const currentConfirmedRevenue = useMemo(() => {
    return currentMonthTransactions
      .filter(
        (transaction) =>
          transaction.type === "Receita" && isConfirmedRevenue(transaction)
      )
      .reduce((total, transaction) => total + parseAmount(transaction.amount), 0);
  }, [currentMonthTransactions]);

  const currentPendingExpenses = useMemo(() => {
    return Math.max(0, currentExpenses - currentConfirmedExpenses);
  }, [currentExpenses, currentConfirmedExpenses]);

  const currentBalance =
    currentRevenue - currentExpenses - currentInvestments - currentReserves;

  const previousRevenue = useMemo(() => {
    return previousMonthTransactions
      .filter((transaction) => transaction.type === "Receita")
      .reduce((total, transaction) => total + parseAmount(transaction.amount), 0);
  }, [previousMonthTransactions]);

  const previousExpenses = useMemo(() => {
    return previousMonthTransactions
      .filter((transaction) => transaction.type === "Despesa")
      .reduce((total, transaction) => total + parseAmount(transaction.amount), 0);
  }, [previousMonthTransactions]);

  const expenseVariation = useMemo(() => {
    if (previousExpenses === 0) {
      return currentExpenses > 0 ? 100 : 0;
    }

    return ((currentExpenses - previousExpenses) / previousExpenses) * 100;
  }, [currentExpenses, previousExpenses]);

  const accountBalance = useMemo(() => {
    return accounts
      .filter((account) => account.active)
      .reduce(
        (total, account) => total + parseAmount(account.initialBalance),
        0
      );
  }, [accounts]);

  const monthlyData = useMemo<MonthData[]>(() => {
    const result: MonthData[] = [];

    for (let offset = -2; offset <= 5; offset++) {
      const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      const key = getMonthKey(date);
      const isFuture = offset > 0;

      const monthTransactions = validTransactions.filter(
        (transaction) => transaction.date?.slice(0, 7) === key
      );

      const revenue = monthTransactions
        .filter((transaction) => transaction.type === "Receita")
        .reduce((total, transaction) => total + parseAmount(transaction.amount), 0);

      const expenses = monthTransactions
        .filter((transaction) => transaction.type === "Despesa")
        .reduce((total, transaction) => total + parseAmount(transaction.amount), 0);

      const investments = monthTransactions
        .filter(
          (transaction) =>
            transaction.type === "Investimento" ||
            transaction.type === "Aplicação"
        )
        .reduce((total, transaction) => total + parseAmount(transaction.amount), 0);

      const reserves = monthTransactions
        .filter((transaction) => transaction.type === "Reserva")
        .reduce((total, transaction) => total + parseAmount(transaction.amount), 0);

      const confirmedExpenses = monthTransactions
        .filter(
          (transaction) =>
            transaction.type === "Despesa" && isConfirmedExpense(transaction)
        )
        .reduce((total, transaction) => total + parseAmount(transaction.amount), 0);

      const pendingExpenses = Math.max(0, expenses - confirmedExpenses);

      result.push({
        key,
        label: getMonthLabel(date, true),
        revenue,
        expenses,
        investments,
        reserves,
        balance: revenue - expenses - investments - reserves,
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
      return date && date > getMonthStart(today);
    });
  }, [monthlyData, today]);

  const historicalMonths = useMemo(() => {
    return monthlyData.filter((month) => {
      const date = getDateFromKey(month.key);
      return date && date < getMonthStart(today);
    });
  }, [monthlyData, today]);

  const averageRevenue = useMemo(() => {
    const monthsWithRevenue = historicalMonths.filter((month) => month.revenue > 0);

    if (!monthsWithRevenue.length) return currentRevenue;

    return (
      monthsWithRevenue.reduce((total, month) => total + month.revenue, 0) /
      monthsWithRevenue.length
    );
  }, [historicalMonths, currentRevenue]);

  const averageExpenses = useMemo(() => {
    const monthsWithExpenses = historicalMonths.filter((month) => month.expenses > 0);

    if (!monthsWithExpenses.length) return currentExpenses;

    return (
      monthsWithExpenses.reduce((total, month) => total + month.expenses, 0) /
      monthsWithExpenses.length
    );
  }, [historicalMonths, currentExpenses]);

  const forecastData = useMemo(() => {
    return futureMonths.map((month) => {
      const hasRegisteredData =
        month.revenue > 0 ||
        month.expenses > 0 ||
        month.investments > 0 ||
        month.reserves > 0;

      const revenue = hasRegisteredData ? month.revenue : averageRevenue;
      const expenses = hasRegisteredData ? month.expenses : averageExpenses;

      return {
        ...month,
        revenue,
        expenses,
        balance: revenue - expenses - month.investments - month.reserves,
        projected: true,
        estimated: !hasRegisteredData,
      };
    });
  }, [futureMonths, averageRevenue, averageExpenses]);

  const categoryExpenses = useMemo(() => {
    const totals: Record<string, number> = {};

    currentMonthTransactions
      .filter((transaction) => transaction.type === "Despesa")
      .forEach((transaction) => {
        const category = transaction.category || "Sem categoria";
        totals[category] =
          (totals[category] || 0) + parseAmount(transaction.amount);
      });

    return Object.entries(totals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [currentMonthTransactions]);

  const totalCategoryExpenses = categoryExpenses.reduce(
    (total, item) => total + item.amount,
    0
  );

  const highestCategory = categoryExpenses[0];

  const maxCategoryValue = Math.max(
    ...categoryExpenses.map((item) => item.amount),
    1
  );

  const maxChartValue = Math.max(
    ...monthlyData.map((month) =>
      Math.max(month.revenue, month.expenses, 1)
    ),
    1
  );

  const visibleForecast = forecastData.slice(0, Number(period));

  const averageFutureBalance = useMemo(() => {
    if (!visibleForecast.length) return 0;

    return (
      visibleForecast.reduce((total, month) => total + month.balance, 0) /
      visibleForecast.length
    );
  }, [visibleForecast]);

  const totalFutureExpenses = visibleForecast.reduce(
    (total, month) => total + month.expenses,
    0
  );

  const totalFutureRevenue = visibleForecast.reduce(
    (total, month) => total + month.revenue,
    0
  );

  const monthlySavingsTarget = useMemo(() => {
    if (averageRevenue <= 0) return 0;
    return averageRevenue * 0.1;
  }, [averageRevenue]);

  const recommendedSpendingLimit = useMemo(() => {
    const projectedRevenue = averageRevenue || currentRevenue;

    return Math.max(0, projectedRevenue - monthlySavingsTarget);
  }, [averageRevenue, currentRevenue, monthlySavingsTarget]);

  const availableToSpend = Math.max(
    0,
    recommendedSpendingLimit - currentExpenses
  );

  const savingsRate =
    currentRevenue > 0
      ? ((currentRevenue - currentExpenses - currentInvestments - currentReserves) /
          currentRevenue) *
        100
      : 0;

  const redMonths = forecastData.filter((month) => month.balance < 0).length;

  const currentMonthName = today.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const financialSituation =
    currentBalance < 0
      ? "negative"
      : currentBalance === 0
        ? "neutral"
        : "positive";

  const recommendations = useMemo(() => {
    const items: {
      title: string;
      description: string;
      type: "warning" | "success" | "info";
    }[] = [];

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
    } else if (previousExpenses > 0 && expenseVariation < 0) {
      items.push({
        title: "Você reduziu seus gastos",
        description: `As despesas registradas caíram ${Math.abs(
          expenseVariation
        ).toFixed(1)}% em relação ao mês anterior.`,
        type: "success",
      });
    }

    if (highestCategory && totalCategoryExpenses > 0) {
      const percentage =
        (highestCategory.amount / totalCategoryExpenses) * 100;

      items.push({
        title: `Revise seus gastos com ${highestCategory.category}`,
        description: `Essa categoria representa ${percentage.toFixed(
          1
        )}% das suas despesas registradas neste mês.`,
        type: percentage >= 40 ? "warning" : "info",
      });
    }

    if (currentRevenue > 0 && savingsRate < 10) {
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

  if (!loaded) {
    return (
      <div className="content dashboard-content">
        <div className="dashboard-loading">
          <div className="loading-indicator" />
          <p>Carregando dashboard financeiro...</p>
        </div>

        <style jsx global>{`
          .dashboard-loading {
            min-height: 60vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 14px;
            color: #a1a1aa;
            font-size: 13px;
          }

          .loading-indicator {
            width: 28px;
            height: 28px;
            border: 3px solid #34343a;
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="content dashboard-content">
      <section className="welcome-section">
        <div>
          <span className="section-eyebrow">ANÁLISE FINANCEIRA</span>
          <h2>
            Seu panorama de <strong>{currentMonthName}</strong>
          </h2>
          <p>
            Uma visão geral para ajudar você a tomar decisões melhores com
            seu dinheiro.
          </p>
        </div>

        <div className={`situation-badge ${financialSituation}`}>
          <span className="situation-dot" />
          {financialSituation === "negative"
            ? "Resultado negativo"
            : financialSituation === "positive"
              ? "Resultado positivo"
              : "Resultado equilibrado"}
        </div>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <div className="card-top">
            <span className="card-label">Receitas do mês</span>
            <span className="card-icon income">↑</span>
          </div>
          <strong className="card-value income-text">
            {money(currentRevenue)}
          </strong>
          <span className="card-description">
            {money(currentConfirmedRevenue)} com status recebido
          </span>
        </article>

        <article className="summary-card">
          <div className="card-top">
            <span className="card-label">Despesas do mês</span>
            <span className="card-icon expense">↓</span>
          </div>
          <strong className="card-value">
            {money(currentExpenses)}
          </strong>
          <span className="card-description">
            {money(currentConfirmedExpenses)} com status pago
          </span>
        </article>

        <article className="summary-card">
          <div className="card-top">
            <span className="card-label">Resultado do mês</span>
            <span className="card-icon result">∑</span>
          </div>
          <strong
            className={`card-value ${
              currentBalance < 0 ? "negative-text" : "positive-text"
            }`}
          >
            {money(currentBalance)}
          </strong>
          <span className="card-description">
            Receitas menos despesas, investimentos e reservas
          </span>
        </article>

        <article className="summary-card">
          <div className="card-top">
            <span className="card-label">Limite recomendado</span>
            <span className="card-icon limit">◎</span>
          </div>
          <strong className="card-value">
            {money(availableToSpend)}
          </strong>
          <span className="card-description">
            Estimativa disponível para novas despesas neste mês
          </span>
        </article>
      </section>

      <section className="main-grid">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <span className="section-eyebrow">DESEMPENHO</span>
              <h3>Receitas x despesas</h3>
              <p>Comparativo dos últimos meses e do período atual.</p>
            </div>
            <div className="chart-legend">
              <span><i className="legend-income" /> Receitas</span>
              <span><i className="legend-expense" /> Despesas</span>
            </div>
          </div>

          <div className="bar-chart">
            {monthlyData.map((month) => (
              <div className="bar-group" key={month.key}>
                <div className="bars">
                  <div
                    className="bar income-bar"
                    style={{
                      height: `${Math.max(
                        3,
                        (month.revenue / maxChartValue) * 150
                      )}px`,
                    }}
                    title={`Receitas: ${money(month.revenue)}`}
                  />
                  <div
                    className="bar expense-bar"
                    style={{
                      height: `${Math.max(
                        3,
                        (month.expenses / maxChartValue) * 150
                      )}px`,
                    }}
                    title={`Despesas: ${money(month.expenses)}`}
                  />
                </div>
                <span className="bar-label">{month.label}</span>
              </div>
            ))}
          </div>

          <div className="chart-footer">
            <span>
              <strong>{money(currentRevenue)}</strong> em receitas
            </span>
            <span>
              <strong>{money(currentExpenses)}</strong> em despesas
            </span>
          </div>
        </article>

        <article className="panel result-panel">
          <div className="panel-header">
            <div>
              <span className="section-eyebrow">SEU RESULTADO</span>
              <h3>Distribuição do dinheiro</h3>
              <p>Composição dos lançamentos do mês atual.</p>
            </div>
          </div>

          <div className="result-main">
            <span>Saldo do mês</span>
            <strong
              className={
                currentBalance < 0 ? "negative-text" : "positive-text"
              }
            >
              {money(currentBalance)}
            </strong>
          </div>

          <div className="result-line">
            <span>Receitas registradas</span>
            <strong className="income-text">{money(currentRevenue)}</strong>
          </div>

          <div className="result-line">
            <span>Despesas registradas</span>
            <strong>{money(currentExpenses)}</strong>
          </div>

          <div className="result-line">
            <span>Investimentos e aplicações</span>
            <strong>{money(currentInvestments)}</strong>
          </div>

          <div className="result-line">
            <span>Reservas</span>
            <strong>{money(currentReserves)}</strong>
          </div>

          <div className="result-line total-line">
            <span>Margem sobre receitas</span>
            <strong className={savingsRate < 0 ? "negative-text" : ""}>
              {savingsRate.toFixed(1)}%
            </strong>
          </div>
        </article>
      </section>

      <section className="main-grid category-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="section-eyebrow">CONTROLE DE GASTOS</span>
              <h3>Onde você está gastando</h3>
              <p>Despesas agrupadas por categoria neste mês.</p>
            </div>
          </div>

          {categoryExpenses.length > 0 ? (
            <div className="category-list">
              {categoryExpenses.slice(0, 7).map((item) => {
                const percentage =
                  totalCategoryExpenses > 0
                    ? (item.amount / totalCategoryExpenses) * 100
                    : 0;

                return (
                  <div className="category-item" key={item.category}>
                    <div className="category-info">
                      <span>{item.category}</span>
                      <strong>{money(item.amount)}</strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${(item.amount / maxCategoryValue) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="category-percentage">
                      {percentage.toFixed(1)}% das despesas
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <span>◈</span>
              <strong>Nenhuma despesa registrada</strong>
              <p>Quando você cadastrar despesas, elas aparecerão aqui.</p>
            </div>
          )}
        </article>

        <article className="panel economy-panel">
          <div className="panel-header">
            <div>
              <span className="section-eyebrow">META DE ECONOMIA</span>
              <h3>Quanto guardar</h3>
              <p>Referência de economia mensal de 10% da receita média.</p>
            </div>
          </div>

          <div className="economy-highlight">
            <span>Meta mensal sugerida</span>
            <strong>{money(monthlySavingsTarget)}</strong>
            <small>Baseada na receita média disponível no histórico.</small>
          </div>

          <div className="economy-row">
            <span>Investimentos e aplicações</span>
            <strong>{money(currentInvestments)}</strong>
          </div>

          <div className="economy-row">
            <span>Valores destinados a reservas</span>
            <strong>{money(currentReserves)}</strong>
          </div>

          <div className="economy-row">
            <span>Margem atual do mês</span>
            <strong
              className={currentBalance < 0 ? "negative-text" : "positive-text"}
            >
              {money(currentBalance)}
            </strong>
          </div>

          <div className="economy-note">
            <span>!</span>
            A meta de 10% é uma referência inicial. Ajuste sua economia de
            acordo com suas despesas essenciais e compromissos.
          </div>
        </article>
      </section>

      <section className="panel forecast-panel">
        <div className="panel-header forecast-header">
          <div>
            <span className="section-eyebrow">VISÃO DE FUTURO</span>
            <h3>Projeção dos próximos meses</h3>
            <p>
              Acompanhe o que está previsto e identifique períodos que exigem
              atenção.
            </p>
          </div>

          <select
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value as "3" | "6")
            }
            className="period-select"
          >
            <option value="3">Próximos 3 meses</option>
            <option value="6">Próximos 6 meses</option>
          </select>
        </div>

        <div className="forecast-table-wrapper">
          <table className="forecast-table">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Receitas estimadas</th>
                <th>Despesas estimadas</th>
                <th>Resultado projetado</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {visibleForecast.map((month) => (
                <tr key={month.key}>
                  <td>
                    <strong>{month.label}</strong>
                    {"estimated" in month && month.estimated && (
                      <small className="estimate-label">Estimativa</small>
                    )}
                  </td>
                  <td className="income-text">{money(month.revenue)}</td>
                  <td>{money(month.expenses)}</td>
                  <td
                    className={
                      month.balance < 0 ? "negative-text" : "positive-text"
                    }
                  >
                    {money(month.balance)}
                  </td>
                  <td>
                    <span
                      className={`forecast-status ${
                        month.balance < 0 ? "danger" : "safe"
                      }`}
                    >
                      {month.balance < 0 ? "Atenção" : "Positivo"}
                    </span>
                  </td>
                </tr>
              ))}

              {visibleForecast.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-table">
                    Não há dados suficientes para a projeção.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="forecast-summary">
          <div>
            <span>Receitas do período</span>
            <strong className="income-text">{money(totalFutureRevenue)}</strong>
          </div>
          <div>
            <span>Despesas do período</span>
            <strong>{money(totalFutureExpenses)}</strong>
          </div>
          <div>
            <span>Resultado médio mensal</span>
            <strong
              className={
                averageFutureBalance < 0 ? "negative-text" : "positive-text"
              }
            >
              {money(averageFutureBalance)}
            </strong>
          </div>
        </div>

        <p className="forecast-disclaimer">
          As projeções utilizam lançamentos futuros cadastrados. Quando não
          existem lançamentos para determinado mês, o painel utiliza a média
          dos meses anteriores como estimativa. Não representa garantia de
          receita ou despesa futura.
        </p>
      </section>

      <section className="main-grid bottom-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="section-eyebrow">PLANO DE AÇÃO</span>
              <h3>Como melhorar sua situação financeira</h3>
              <p>Recomendações automáticas com base nos seus lançamentos.</p>
            </div>
          </div>

          <div className="recommendation-list">
            {recommendations.map((item, index) => (
              <div
                className={`recommendation-item ${item.type}`}
                key={`${item.title}-${index}`}
              >
                <span className="recommendation-icon">
                  {item.type === "warning"
                    ? "!"
                    : item.type === "success"
                      ? "✓"
                      : "i"}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel account-panel">
          <div className="panel-header">
            <div>
              <span className="section-eyebrow">CONTAS FINANCEIRAS</span>
              <h3>Contas cadastradas</h3>
              <p>Resumo dos saldos iniciais informados.</p>
            </div>
            <Link href="/financeiro/contas" className="panel-link">
              Ver contas →
            </Link>
          </div>

          <div className="account-total">
            <span>Total de saldos iniciais</span>
            <strong>{money(accountBalance)}</strong>
          </div>

          {accounts.filter((account) => account.active).length > 0 ? (
            <div className="account-list">
              {accounts
                .filter((account) => account.active)
                .slice(0, 5)
                .map((account) => (
                  <div className="account-item" key={account.id}>
                    <div className="account-symbol">▣</div>
                    <div className="account-info">
                      <strong>{account.name}</strong>
                      <span>{account.institution || account.type}</span>
                    </div>
                    <strong className="account-value">
                      {money(parseAmount(account.initialBalance))}
                    </strong>
                  </div>
                ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <strong>Nenhuma conta cadastrada</strong>
              <p>Cadastre suas contas para visualizar os saldos iniciais.</p>
            </div>
          )}
        </article>
      </section>

      <section className="disclaimer">
        <span>ⓘ</span>
        <p>
          <strong>Sobre os indicadores:</strong> os valores são calculados
          com base nos lançamentos cadastrados no NEXO. O valor total do
          lançamento é utilizado nos cálculos, pois o cadastro atual não
          armazena o valor efetivamente liquidado em pagamentos parciais.
          O saldo inicial das contas é exibido separadamente e não representa
          o saldo bancário atualizado.
        </p>
      </section>

      <footer className="routine-footer">
        NEXO · Planeje. Organize. Conquiste.
      </footer>

      <style jsx global>{`
        .dashboard-content {
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
        }

        .dashboard-content .welcome-section {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 0;
        }

        .dashboard-content .section-eyebrow {
          display: block;
          color: #85858f;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        .dashboard-content .welcome-section h2 {
          margin: 8px 0 6px;
          font-size: 21px;
          font-weight: 600;
        }

        .dashboard-content .welcome-section h2 strong {
          color: #fff;
          text-transform: capitalize;
        }

        .dashboard-content .welcome-section p {
          margin: 0;
          color: #92929c;
          font-size: 13px;
          line-height: 1.6;
        }

        .dashboard-content .situation-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          padding: 9px 13px;
          border: 1px solid #38383e;
          border-radius: 20px;
          background: #1a1a1e;
          color: #c9c9d0;
          font-size: 11px;
        }

        .dashboard-content .situation-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #aaa;
        }

        .dashboard-content .situation-badge.positive .situation-dot {
          background: #70bd91;
        }

        .dashboard-content .situation-badge.negative .situation-dot {
          background: #e17a7a;
        }

        .dashboard-content .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .dashboard-content .summary-card,
        .dashboard-content .panel {
          min-width: 0;
          padding: 20px;
          border: 1px solid #29292e;
          border-radius: 9px;
          background: #171719;
        }

        .dashboard-content .card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 17px;
        }

        .dashboard-content .card-label {
          color: #a4a4ad;
          font-size: 12px;
        }

        .dashboard-content .card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 29px;
          height: 29px;
          border: 1px solid #34343a;
          border-radius: 7px;
          color: #d0d0d6;
          background: #222226;
          font-size: 16px;
        }

        .dashboard-content .card-icon.income {
          color: #80c69c;
        }

        .dashboard-content .card-icon.expense {
          color: #e18a8a;
        }

        .dashboard-content .card-value {
          display: block;
          overflow-wrap: anywhere;
          font-size: clamp(19px, 2vw, 25px);
          font-weight: 700;
          letter-spacing: -0.7px;
        }

        .dashboard-content .card-description {
          display: block;
          margin-top: 9px;
          color: #85858f;
          font-size: 10px;
          line-height: 1.5;
        }

        .dashboard-content .income-text {
          color: #83c99e !important;
        }

        .dashboard-content .negative-text {
          color: #e58a8a !important;
        }

        .dashboard-content .positive-text {
          color: #83c99e !important;
        }

        .dashboard-content .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(300px, 1fr);
          gap: 18px;
          min-width: 0;
        }

        .dashboard-content .panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
        }

        .dashboard-content .panel-header h3 {
          margin: 7px 0 5px;
          font-size: 16px;
          font-weight: 650;
        }

        .dashboard-content .panel-header p {
          margin: 0;
          color: #85858f;
          font-size: 11px;
          line-height: 1.5;
        }

        .dashboard-content .chart-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          color: #a2a2ab;
          font-size: 10px;
        }

        .dashboard-content .chart-legend span {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        .dashboard-content .chart-legend i {
          width: 8px;
          height: 8px;
          border-radius: 2px;
        }

        .dashboard-content .legend-income {
          background: #82bd98;
        }

        .dashboard-content .legend-expense {
          background: #a0a0aa;
        }

        .dashboard-content .bar-chart {
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          gap: 12px;
          min-height: 190px;
          padding: 10px 0 0;
          border-bottom: 1px solid #303036;
        }

        .dashboard-content .bar-group {
          display: flex;
          flex: 1;
          min-width: 0;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .dashboard-content .bars {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 4px;
          height: 160px;
          width: 100%;
        }

        .dashboard-content .bar {
          width: min(25px, 40%);
          min-height: 3px;
          border-radius: 4px 4px 0 0;
          transition: height 0.3s;
        }

        .dashboard-content .income-bar {
          background: #82bd98;
        }

        .dashboard-content .expense-bar {
          background: #777781;
        }

        .dashboard-content .bar-label {
          max-width: 100%;
          color: #898993;
          font-size: 9px;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .dashboard-content .chart-footer {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 15px;
          color: #93939d;
          font-size: 10px;
        }

        .dashboard-content .chart-footer strong {
          color: #e5e5e9;
        }

        .dashboard-content .result-main {
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding: 16px;
          margin-bottom: 16px;
          border: 1px solid #303036;
          border-radius: 7px;
          background: #202024;
        }

        .dashboard-content .result-main span {
          color: #9a9aa4;
          font-size: 11px;
        }

        .dashboard-content .result-main strong {
          font-size: 25px;
          letter-spacing: -0.7px;
        }

        .dashboard-content .result-line {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 0;
          border-bottom: 1px solid #29292e;
          color: #a3a3ad;
          font-size: 11px;
        }

        .dashboard-content .result-line strong {
          color: #e5e5e9;
          text-align: right;
        }

        .dashboard-content .total-line {
          margin-top: 3px;
          border-bottom: 0;
          color: #ddd;
        }

        .dashboard-content .category-grid {
          grid-template-columns: minmax(0, 1.3fr) minmax(300px, 1fr);
        }

        .dashboard-content .category-list {
          display: flex;
          flex-direction: column;
          gap: 19px;
        }

        .dashboard-content .category-info {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
          color: #d4d4da;
          font-size: 11px;
        }

        .dashboard-content .category-info strong {
          color: #f0f0f2;
        }

        .dashboard-content .progress-track {
          width: 100%;
          height: 6px;
          overflow: hidden;
          border-radius: 10px;
          background: #303036;
        }

        .dashboard-content .progress-fill {
          height: 100%;
          border-radius: 10px;
          background: #96969f;
        }

        .dashboard-content .category-percentage {
          display: block;
          margin-top: 6px;
          color: #85858f;
          font-size: 9px;
        }

        .dashboard-content .economy-highlight {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 17px;
          margin-bottom: 12px;
          border: 1px solid #34343a;
          border-radius: 7px;
          background: #202024;
        }

        .dashboard-content .economy-highlight span {
          color: #a1a1aa;
          font-size: 11px;
        }

        .dashboard-content .economy-highlight strong {
          font-size: 25px;
        }

        .dashboard-content .economy-highlight small {
          color: #85858f;
          font-size: 10px;
          line-height: 1.5;
        }

        .dashboard-content .economy-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 0;
          border-bottom: 1px solid #29292e;
          color: #a5a5ae;
          font-size: 10px;
        }

        .dashboard-content .economy-row strong {
          color: #e5e5e9;
          text-align: right;
        }

        .dashboard-content .economy-note {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 12px;
          margin-top: 15px;
          border: 1px solid #34343a;
          border-radius: 6px;
          color: #a1a1aa;
          background: #202024;
          font-size: 10px;
          line-height: 1.5;
        }

        .dashboard-content .economy-note span {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: #414149;
          color: white;
          font-weight: 700;
        }

        .dashboard-content .forecast-panel {
          margin-bottom: 0;
        }

        .dashboard-content .forecast-header {
          align-items: center;
        }

        .dashboard-content .period-select {
          min-height: 36px;
          padding: 0 12px;
          border: 1px solid #38383e;
          border-radius: 6px;
          outline: none;
          background: #222226;
          color: #e5e5e9;
          font-size: 11px;
        }

        .dashboard-content .forecast-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .dashboard-content .forecast-table {
          width: 100%;
          border-collapse: collapse;
          white-space: nowrap;
        }

        .dashboard-content .forecast-table th {
          padding: 12px 10px;
          border-bottom: 1px solid #34343a;
          color: #85858f;
          font-size: 10px;
          font-weight: 600;
          text-align: left;
        }

        .dashboard-content .forecast-table td {
          padding: 14px 10px;
          border-bottom: 1px solid #29292e;
          color: #d5d5da;
          font-size: 11px;
        }

        .dashboard-content .forecast-table td strong {
          font-weight: 600;
        }

        .dashboard-content .estimate-label {
          display: block;
          margin-top: 4px;
          color: #85858f;
          font-size: 9px;
        }

        .dashboard-content .forecast-status {
          display: inline-flex;
          align-items: center;
          padding: 5px 8px;
          border: 1px solid #38383e;
          border-radius: 20px;
          font-size: 9px;
        }

        .dashboard-content .forecast-status.safe {
          color: #9bc9a9;
          background: #1b2920;
          border-color: #304a38;
        }

        .dashboard-content .forecast-status.danger {
          color: #e59a9a;
          background: #2b1d1d;
          border-color: #533333;
        }

        .dashboard-content .forecast-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          padding: 16px 0 4px;
        }

        .dashboard-content .forecast-summary div {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .dashboard-content .forecast-summary span {
          color: #85858f;
          font-size: 10px;
        }

        .dashboard-content .forecast-summary strong {
          font-size: 15px;
        }

        .dashboard-content .forecast-disclaimer {
          margin: 15px 0 0;
          color: #777781;
          font-size: 10px;
          line-height: 1.6;
        }

        .dashboard-content .bottom-grid {
          grid-template-columns: minmax(0, 1.3fr) minmax(300px, 1fr);
        }

        .dashboard-content .recommendation-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .dashboard-content .recommendation-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 13px;
          border: 1px solid #303036;
          border-radius: 7px;
          background: #202024;
        }

        .dashboard-content .recommendation-icon {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          width: 23px;
          height: 23px;
          border-radius: 6px;
          background: #34343a;
          color: #ddd;
          font-size: 12px;
          font-weight: 700;
        }

        .dashboard-content .recommendation-item.warning .recommendation-icon {
          color: #e8a1a1;
        }

        .dashboard-content .recommendation-item.success .recommendation-icon {
          color: #9bc9a9;
        }

        .dashboard-content .recommendation-item strong {
          display: block;
          margin-bottom: 5px;
          color: #e7e7eb;
          font-size: 11px;
        }

        .dashboard-content .recommendation-item p {
          margin: 0;
          color: #9999a3;
          font-size: 10px;
          line-height: 1.6;
        }

        .dashboard-content .panel-link {
          flex-shrink: 0;
          color: #c3c3cb;
          font-size: 10px;
          text-decoration: none;
        }

        .dashboard-content .account-total {
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding: 15px;
          margin-bottom: 12px;
          border: 1px solid #34343a;
          border-radius: 7px;
          background: #202024;
        }

        .dashboard-content .account-total span {
          color: #9999a3;
          font-size: 10px;
        }

        .dashboard-content .account-total strong {
          font-size: 22px;
        }

        .dashboard-content .account-list {
          display: flex;
          flex-direction: column;
        }

        .dashboard-content .account-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 0;
          border-bottom: 1px solid #29292e;
        }

        .dashboard-content .account-symbol {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          width: 31px;
          height: 31px;
          border: 1px solid #38383e;
          border-radius: 7px;
          background: #252529;
          color: #c5c5cd;
        }

        .dashboard-content .account-info {
          display: flex;
          min-width: 0;
          flex: 1;
          flex-direction: column;
          gap: 4px;
        }

        .dashboard-content .account-info strong {
          overflow: hidden;
          color: #e5e5e9;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dashboard-content .account-info span {
          color: #85858f;
          font-size: 9px;
        }

        .dashboard-content .account-value {
          color: #e1e1e6;
          font-size: 10px;
          white-space: nowrap;
        }

        .dashboard-content .empty-state {
          display: flex;
          min-height: 150px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #85858f;
          text-align: center;
        }

        .dashboard-content .empty-state > span {
          font-size: 25px;
        }

        .dashboard-content .empty-state strong {
          color: #d5d5da;
          font-size: 12px;
        }

        .dashboard-content .empty-state p {
          max-width: 260px;
          margin: 0;
          font-size: 10px;
          line-height: 1.5;
        }

        .dashboard-content .empty-state.compact {
          min-height: 100px;
        }

        .dashboard-content .empty-table {
          padding: 25px !important;
          color: #85858f !important;
          text-align: center;
        }

        .dashboard-content .disclaimer {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px;
          border: 1px solid #34343a;
          border-radius: 7px;
          background: #19191c;
        }

        .dashboard-content .disclaimer > span {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          width: 21px;
          height: 21px;
          border-radius: 50%;
          background: #34343a;
          color: #e0e0e5;
          font-size: 12px;
        }

        .dashboard-content .disclaimer p {
          margin: 0;
          color: #9696a0;
          font-size: 10px;
          line-height: 1.7;
        }

        .dashboard-content .disclaimer strong {
          color: #d7d7dc;
        }

        @media (max-width: 1100px) {
          .dashboard-content .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .dashboard-content .main-grid,
          .dashboard-content .category-grid,
          .dashboard-content .bottom-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .dashboard-content .welcome-section {
            align-items: flex-start;
            flex-direction: column;
          }

          .dashboard-content .welcome-section h2 {
            font-size: 18px;
          }

          .dashboard-content .summary-grid {
            gap: 9px;
          }

          .dashboard-content .summary-card {
            padding: 14px;
          }

          .dashboard-content .card-value {
            font-size: 19px;
          }

          .dashboard-content .card-description {
            font-size: 9px;
          }

          .dashboard-content .panel {
            padding: 15px;
          }

          .dashboard-content .panel-header {
            flex-direction: column;
          }

          .dashboard-content .chart-legend {
            margin-top: -10px;
          }

          .dashboard-content .bar-chart {
            gap: 4px;
          }

          .dashboard-content .bar-label {
            font-size: 8px;
          }

          .dashboard-content .chart-footer {
            flex-direction: column;
          }

          .dashboard-content .forecast-header {
            align-items: flex-start;
          }

          .dashboard-content .forecast-summary {
            grid-template-columns: 1fr;
          }

          .dashboard-content .forecast-summary div {
            padding: 9px 0;
            border-bottom: 1px solid #29292e;
          }

          .dashboard-content .forecast-table {
            min-width: 650px;
          }
        }

        @media (max-width: 380px) {
          .dashboard-content .summary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

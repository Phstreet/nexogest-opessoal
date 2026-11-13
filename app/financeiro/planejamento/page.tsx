
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MainNavigation from "../../../components/navigation/MainNavigation";

type TransactionType =
  | "Receita"
  | "Despesa"
  | "Transferência"
  | "Aplicação"
  | "Reserva";

type Transaction = {
  id: number;
  description: string;
  type: TransactionType;
  amount: number;
  date?: string;
  category?: string;
  subcategory?: string;
  account?: string;
  status?: string;
  recurrence?: string;
};

type Budget = {
  id: number;
  category: string;
  limit: number;
  month: string;
};

type FinancialGoal = {
  id: number;
  name: string;
  target: number;
  current: number;
  deadline: string;
  category: string;
  createdAt: string;
};

type BudgetForm = {
  category: string;
  limit: string;
};

type GoalForm = {
  name: string;
  target: string;
  current: string;
  deadline: string;
  category: string;
};

const TRANSACTIONS_KEY = "nexo_transactions";
const BUDGETS_KEY = "nexo_planning_budgets";
const GOALS_KEY = "nexo_planning_goals";

const goalCategories = [
  "Reserva de emergência",
  "Viagem",
  "Aquisição de bem",
  "Quitação de dívidas",
  "Investimentos",
  "Objetivo pessoal",
  "Outros",
];

const emptyBudgetForm: BudgetForm = {
  category: "",
  limit: "",
};

const emptyGoalForm: GoalForm = {
  name: "",
  target: "",
  current: "0",
  deadline: "",
  category: "Objetivo pessoal",
};

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCurrentMonth() {
  return getLocalDateString().slice(0, 7);
}

function formatLongDate(date = new Date()) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value?: string) {
  if (!value) return "Não informado";

  const parts = value.split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
}

function parseAmount(value: string) {
  const normalized = value
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(normalized);
}

function getMonthName(month: string) {
  if (!month) return "";

  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(year, monthNumber - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function isPaidTransaction(transaction: Transaction) {
  const status = (transaction.status || "").toLowerCase().trim();

  if (transaction.type === "Receita") {
    return status === "recebida";
  }

  if (transaction.type === "Despesa") {
    return status === "pago";
  }

  return false;
}

function isCanceled(transaction: Transaction) {
  const status = (transaction.status || "").toLowerCase().trim();
  return status.includes("cancel");
}

export default function PlanejamentoFinanceiroPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [loading, setLoading] = useState(true);

  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);

  const [budgetForm, setBudgetForm] = useState<BudgetForm>(emptyBudgetForm);
  const [goalForm, setGoalForm] = useState<GoalForm>(emptyGoalForm);

  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);

  const [budgetError, setBudgetError] = useState("");
  const [goalError, setGoalError] = useState("");

  useEffect(() => {
    try {
      const savedTransactions = localStorage.getItem(TRANSACTIONS_KEY);
      const savedBudgets = localStorage.getItem(BUDGETS_KEY);
      const savedGoals = localStorage.getItem(GOALS_KEY);

      if (savedTransactions) {
        const parsed = JSON.parse(savedTransactions);

        if (Array.isArray(parsed)) {
          setTransactions(parsed);
        }
      }

      if (savedBudgets) {
        const parsed = JSON.parse(savedBudgets);

        if (Array.isArray(parsed)) {
          setBudgets(parsed);
        }
      }

      if (savedGoals) {
        const parsed = JSON.parse(savedGoals);

        if (Array.isArray(parsed)) {
          setGoals(parsed);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar planejamento financeiro:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
    }
  }, [budgets, loading]);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
    }
  }, [goals, loading]);

  const monthTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      if (!transaction.date) return false;

      if (!["Receita", "Despesa"].includes(transaction.type)) {
        return false;
      }

      if (isCanceled(transaction)) return false;

      return transaction.date.slice(0, 7) === selectedMonth;
    });
  }, [transactions, selectedMonth]);

  const monthlySummary = useMemo(() => {
    let plannedIncome = 0;
    let plannedExpenses = 0;
    let realizedIncome = 0;
    let realizedExpenses = 0;

    monthTransactions.forEach((transaction) => {
      const amount = Number(transaction.amount) || 0;

      if (transaction.type === "Receita") {
        plannedIncome += amount;

        if (isPaidTransaction(transaction)) {
          realizedIncome += amount;
        }
      }

      if (transaction.type === "Despesa") {
        plannedExpenses += amount;

        if (isPaidTransaction(transaction)) {
          realizedExpenses += amount;
        }
      }
    });

    return {
      plannedIncome,
      plannedExpenses,
      realizedIncome,
      realizedExpenses,
      plannedBalance: plannedIncome - plannedExpenses,
      realizedBalance: realizedIncome - realizedExpenses,
      pendingIncome: plannedIncome - realizedIncome,
      pendingExpenses: plannedExpenses - realizedExpenses,
    };
  }, [monthTransactions]);

  const monthlyBudgets = useMemo(() => {
    return budgets.filter((budget) => budget.month === selectedMonth);
  }, [budgets, selectedMonth]);

  const categoryExpenses = useMemo(() => {
    const result: Record<string, number> = {};

    monthTransactions.forEach((transaction) => {
      if (transaction.type !== "Despesa") return;

      const category = transaction.category || "Sem categoria";

      result[category] =
        (result[category] || 0) + (Number(transaction.amount) || 0);
    });

    return result;
  }, [monthTransactions]);

  const totalBudget = useMemo(() => {
    return monthlyBudgets.reduce((total, budget) => total + budget.limit, 0);
  }, [monthlyBudgets]);

  const totalBudgetUsed = useMemo(() => {
    return monthlyBudgets.reduce((total, budget) => {
      return total + (categoryExpenses[budget.category] || 0);
    }, 0);
  }, [monthlyBudgets, categoryExpenses]);

  const budgetUsage =
    totalBudget > 0 ? (totalBudgetUsed / totalBudget) * 100 : 0;

  const activeGoals = useMemo(() => {
    return goals.filter((goal) => goal.current < goal.target);
  }, [goals]);

  const completedGoals = useMemo(() => {
    return goals.filter((goal) => goal.current >= goal.target);
  }, [goals]);

  const totalGoalsTarget = useMemo(() => {
    return goals.reduce((total, goal) => total + goal.target, 0);
  }, [goals]);

  const totalGoalsCurrent = useMemo(() => {
    return goals.reduce((total, goal) => total + goal.current, 0);
  }, [goals]);

  const goalProgress =
    totalGoalsTarget > 0
      ? Math.min((totalGoalsCurrent / totalGoalsTarget) * 100, 100)
      : 0;

  const expenseCategories = useMemo(() => {
    const categories = new Set<string>();

    transactions.forEach((transaction) => {
      if (transaction.type === "Despesa" && transaction.category) {
        categories.add(transaction.category);
      }
    });

    monthlyBudgets.forEach((budget) => categories.add(budget.category));

    return Array.from(categories).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [transactions, monthlyBudgets]);

  const latestTransactions = useMemo(() => {
    return [...monthTransactions]
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 6);
  }, [monthTransactions]);

  function changeMonth(direction: number) {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1 + direction, 1);

    const newMonth = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
    ].join("-");

    setSelectedMonth(newMonth);
  }

  function openNewBudgetForm() {
    setEditingBudgetId(null);
    setBudgetForm(emptyBudgetForm);
    setBudgetError("");
    setShowBudgetForm(true);
  }

  function openEditBudgetForm(budget: Budget) {
    setEditingBudgetId(budget.id);
    setBudgetForm({
      category: budget.category,
      limit: String(budget.limit),
    });
    setBudgetError("");
    setShowBudgetForm(true);
  }

  function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBudgetError("");

    const category = budgetForm.category.trim();
    const limit = parseAmount(budgetForm.limit);

    if (!category) {
      setBudgetError("Informe a categoria do orçamento.");
      return;
    }

    if (!Number.isFinite(limit) || limit <= 0) {
      setBudgetError("Informe um limite maior que zero.");
      return;
    }

    const duplicate = budgets.some((budget) => {
      return (
        budget.month === selectedMonth &&
        budget.category.toLowerCase() === category.toLowerCase() &&
        budget.id !== editingBudgetId
      );
    });

    if (duplicate) {
      setBudgetError(
        "Já existe um orçamento para essa categoria neste mês."
      );
      return;
    }

    if (editingBudgetId !== null) {
      setBudgets((current) =>
        current.map((budget) =>
          budget.id === editingBudgetId
            ? { ...budget, category, limit, month: selectedMonth }
            : budget
        )
      );
    } else {
      const newBudget: Budget = {
        id: Date.now(),
        category,
        limit,
        month: selectedMonth,
      };

      setBudgets((current) => [...current, newBudget]);
    }

    setBudgetForm(emptyBudgetForm);
    setShowBudgetForm(false);
    setEditingBudgetId(null);
  }

  function deleteBudget(id: number) {
    const confirmed = window.confirm(
      "Deseja realmente excluir este orçamento?"
    );

    if (!confirmed) return;

    setBudgets((current) => current.filter((budget) => budget.id !== id));
  }

  function openNewGoalForm() {
    setEditingGoalId(null);
    setGoalForm({
      ...emptyGoalForm,
      current: "0",
    });
    setGoalError("");
    setShowGoalForm(true);
  }

  function openEditGoalForm(goal: FinancialGoal) {
    setEditingGoalId(goal.id);
    setGoalForm({
      name: goal.name,
      target: String(goal.target),
      current: String(goal.current),
      deadline: goal.deadline,
      category: goal.category,
    });
    setGoalError("");
    setShowGoalForm(true);
  }

  function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGoalError("");

    const name = goalForm.name.trim();
    const target = parseAmount(goalForm.target);
    const current = parseAmount(goalForm.current);

    if (!name) {
      setGoalError("Informe o nome da meta.");
      return;
    }

    if (!Number.isFinite(target) || target <= 0) {
      setGoalError("Informe um valor válido para a meta.");
      return;
    }

    if (!Number.isFinite(current) || current < 0) {
      setGoalError("Informe um valor acumulado válido.");
      return;
    }

    if (editingGoalId !== null) {
      setGoals((previous) =>
        previous.map((goal) =>
          goal.id === editingGoalId
            ? {
                ...goal,
                name,
                target,
                current,
                deadline: goalForm.deadline,
                category: goalForm.category,
              }
            : goal
        )
      );
    } else {
      const newGoal: FinancialGoal = {
        id: Date.now(),
        name,
        target,
        current,
        deadline: goalForm.deadline,
        category: goalForm.category,
        createdAt: getLocalDateString(),
      };

      setGoals((previous) => [...previous, newGoal]);
    }

    setGoalForm(emptyGoalForm);
    setShowGoalForm(false);
    setEditingGoalId(null);
  }

  function deleteGoal(id: number) {
    const confirmed = window.confirm(
      "Deseja realmente excluir esta meta financeira?"
    );

    if (!confirmed) return;

    setGoals((current) => current.filter((goal) => goal.id !== id));
  }

  function updateGoalAmount(goal: FinancialGoal, value: string) {
    const amount = Number(value);

    if (!Number.isFinite(amount) || amount < 0) return;

    setGoals((current) =>
      current.map((item) =>
        item.id === goal.id ? { ...item, current: amount } : item
      )
    );
  }

  function getBudgetStatus(used: number, limit: number) {
    if (limit <= 0) return "neutral";
    if (used > limit) return "danger";
    if (used / limit >= 0.8) return "warning";

    return "success";
  }

  function getBudgetPercentage(used: number, limit: number) {
    if (limit <= 0) return 0;

    return Math.min((used / limit) * 100, 100);
  }

  function getGoalPercentage(goal: FinancialGoal) {
    if (goal.target <= 0) return 0;

    return Math.min((goal.current / goal.target) * 100, 100);
  }

  function getRemainingDays(deadline: string) {
    if (!deadline) return null;

    const today = new Date(getLocalDateString() + "T00:00:00");
    const targetDate = new Date(deadline + "T00:00:00");

    return Math.ceil(
      (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  return (
    <main className="app-shell">
      <MainNavigation />

      <section className="main-area">
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              NEXO / FINANCEIRO / PLANEJAMENTO
            </div>
            <h1>Planejamento financeiro</h1>
          </div>

          <div className="topbar-right">
            <div className="date-display">
              <span className="date-icon">◷</span>
              {formatLongDate()}
            </div>
            <div className="profile-avatar">N</div>
          </div>
        </header>

        <div className="content planning-content">
          {loading ? (
            <div className="loading-state">
              Carregando planejamento financeiro...
            </div>
          ) : (
            <>
              <section className="planning-intro">
                <p>
                  Organize seu orçamento, acompanhe suas metas e planeje seus
                  próximos passos financeiros.
                </p>
              </section>

              <section className="month-toolbar">
                <div>
                  <span className="section-eyebrow">PERÍODO DE ANÁLISE</span>
                  <h2>{getMonthName(selectedMonth)}</h2>
                </div>

                <div className="month-controls">
                  <button
                    type="button"
                    className="month-arrow"
                    onClick={() => changeMonth(-1)}
                    aria-label="Mês anterior"
                  >
                    ←
                  </button>

                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    aria-label="Selecionar mês"
                  />

                  <button
                    type="button"
                    className="month-arrow"
                    onClick={() => changeMonth(1)}
                    aria-label="Próximo mês"
                  >
                    →
                  </button>

                  <button
                    type="button"
                    className="today-button"
                    onClick={() => setSelectedMonth(getCurrentMonth())}
                  >
                    Mês atual
                  </button>
                </div>
              </section>

              <section className="summary-grid">
                <article className="summary-card">
                  <div className="summary-top">
                    <span>Receitas previstas</span>
                    <span className="summary-icon income">↑</span>
                  </div>
                  <strong className="income-text">
                    {formatCurrency(monthlySummary.plannedIncome)}
                  </strong>
                  <small>
                    Realizadas: {formatCurrency(monthlySummary.realizedIncome)}
                  </small>
                </article>

                <article className="summary-card">
                  <div className="summary-top">
                    <span>Despesas previstas</span>
                    <span className="summary-icon expense">↓</span>
                  </div>
                  <strong className="expense-text">
                    {formatCurrency(monthlySummary.plannedExpenses)}
                  </strong>
                  <small>
                    Realizadas:{" "}
                    {formatCurrency(monthlySummary.realizedExpenses)}
                  </small>
                </article>

                <article className="summary-card">
                  <div className="summary-top">
                    <span>Saldo planejado</span>
                    <span className="summary-icon balance">◈</span>
                  </div>
                  <strong
                    className={
                      monthlySummary.plannedBalance >= 0
                        ? "income-text"
                        : "expense-text"
                    }
                  >
                    {formatCurrency(monthlySummary.plannedBalance)}
                  </strong>
                  <small>Receitas menos despesas previstas</small>
                </article>

                <article className="summary-card">
                  <div className="summary-top">
                    <span>Saldo realizado</span>
                    <span className="summary-icon realized">✓</span>
                  </div>
                  <strong
                    className={
                      monthlySummary.realizedBalance >= 0
                        ? "income-text"
                        : "expense-text"
                    }
                  >
                    {formatCurrency(monthlySummary.realizedBalance)}
                  </strong>
                  <small>Considera somente lançamentos concluídos</small>
                </article>
              </section>

              <section className="content-grid">
                <article className="panel">
                  <div className="panel-header">
                    <div>
                      <span className="section-eyebrow">ACOMPANHAMENTO</span>
                      <h2>Previsto x realizado</h2>
                      <p>
                        Comparativo das movimentações do mês selecionado.
                      </p>
                    </div>
                  </div>

                  <div className="comparison-list">
                    <div className="comparison-item">
                      <div className="comparison-heading">
                        <span>Receitas</span>
                        <strong className="income-text">
                          {formatCurrency(monthlySummary.realizedIncome)}
                        </strong>
                      </div>

                      <div className="comparison-track">
                        <div
                          className="comparison-fill income-fill"
                          style={{
                            width: `${
                              monthlySummary.plannedIncome > 0
                                ? Math.min(
                                    (monthlySummary.realizedIncome /
                                      monthlySummary.plannedIncome) *
                                      100,
                                    100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>

                      <div className="comparison-footer">
                        <span>Realizado</span>
                        <span>
                          Previsto:{" "}
                          {formatCurrency(monthlySummary.plannedIncome)}
                        </span>
                      </div>
                    </div>

                    <div className="comparison-item">
                      <div className="comparison-heading">
                        <span>Despesas</span>
                        <strong className="expense-text">
                          {formatCurrency(monthlySummary.realizedExpenses)}
                        </strong>
                      </div>

                      <div className="comparison-track">
                        <div
                          className="comparison-fill expense-fill"
                          style={{
                            width: `${
                              monthlySummary.plannedExpenses > 0
                                ? Math.min(
                                    (monthlySummary.realizedExpenses /
                                      monthlySummary.plannedExpenses) *
                                      100,
                                    100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>

                      <div className="comparison-footer">
                        <span>Realizado</span>
                        <span>
                          Previsto:{" "}
                          {formatCurrency(monthlySummary.plannedExpenses)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pending-grid">
                    <div>
                      <span>Receitas pendentes</span>
                      <strong className="income-text">
                        {formatCurrency(monthlySummary.pendingIncome)}
                      </strong>
                    </div>

                    <div>
                      <span>Despesas pendentes</span>
                      <strong className="expense-text">
                        {formatCurrency(monthlySummary.pendingExpenses)}
                      </strong>
                    </div>
                  </div>
                </article>

                <article className="panel budget-overview">
                  <div className="panel-header">
                    <div>
                      <span className="section-eyebrow">
                        CONTROLE DE GASTOS
                      </span>
                      <h2>Orçamento mensal</h2>
                      <p>Limites definidos para suas categorias.</p>
                    </div>

                    <span className="panel-icon">▤</span>
                  </div>

                  <div className="budget-total">
                    <strong>{formatCurrency(totalBudget)}</strong>
                    <span>Limite total definido</span>
                  </div>

                  <div className="budget-main-track">
                    <div
                      className={`budget-main-fill ${
                        budgetUsage > 100 ? "danger-fill" : ""
                      }`}
                      style={{ width: `${Math.min(budgetUsage, 100)}%` }}
                    />
                  </div>

                  <div className="budget-total-footer">
                    <span>
                      Utilizado:{" "}
                      <strong>{formatCurrency(totalBudgetUsed)}</strong>
                    </span>
                    <span>{budgetUsage.toFixed(1)}%</span>
                  </div>

                  <div className="budget-remaining">
                    <span>Disponível no orçamento</span>
                    <strong
                      className={
                        totalBudget - totalBudgetUsed >= 0
                          ? "income-text"
                          : "expense-text"
                      }
                    >
                      {formatCurrency(totalBudget - totalBudgetUsed)}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="secondary-button full-button"
                    onClick={openNewBudgetForm}
                  >
                    + Adicionar categoria ao orçamento
                  </button>
                </article>
              </section>

              <section className="panel budget-panel">
                <div className="panel-header section-panel-header">
                  <div>
                    <span className="section-eyebrow">
                      ORÇAMENTO POR CATEGORIA
                    </span>
                    <h2>Limites de despesas</h2>
                    <p>
                      Compare os gastos registrados com o limite planejado
                      para cada categoria.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={openNewBudgetForm}
                  >
                    + Novo orçamento
                  </button>
                </div>

                {showBudgetForm && (
                  <form className="form-card" onSubmit={saveBudget}>
                    <div className="form-heading">
                      <h3>
                        {editingBudgetId !== null
                          ? "Editar orçamento"
                          : "Cadastrar orçamento"}
                      </h3>

                      <button
                        type="button"
                        className="close-button"
                        onClick={() => {
                          setShowBudgetForm(false);
                          setEditingBudgetId(null);
                          setBudgetError("");
                        }}
                      >
                        ×
                      </button>
                    </div>

                    <div className="form-grid">
                      <label className="field">
                        <span>Categoria</span>
                        <input
                          type="text"
                          list="expense-categories"
                          value={budgetForm.category}
                          onChange={(event) =>
                            setBudgetForm((current) => ({
                              ...current,
                              category: event.target.value,
                            }))
                          }
                          placeholder="Ex.: Alimentação"
                          required
                        />
                        <datalist id="expense-categories">
                          {expenseCategories.map((category) => (
                            <option key={category} value={category} />
                          ))}
                        </datalist>
                      </label>

                      <label className="field">
                        <span>Limite mensal (R$)</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={budgetForm.limit}
                          onChange={(event) =>
                            setBudgetForm((current) => ({
                              ...current,
                              limit: event.target.value,
                            }))
                          }
                          placeholder="0,00"
                          required
                        />
                      </label>
                    </div>

                    {budgetError && (
                      <p className="form-error">{budgetError}</p>
                    )}

                    <div className="form-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setShowBudgetForm(false);
                          setEditingBudgetId(null);
                          setBudgetError("");
                        }}
                      >
                        Cancelar
                      </button>

                      <button type="submit" className="primary-button">
                        Salvar orçamento
                      </button>
                    </div>
                  </form>
                )}

                {monthlyBudgets.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">▤</span>
                    <h3>Nenhum orçamento cadastrado</h3>
                    <p>
                      Defina limites mensais para suas categorias e acompanhe
                      seus gastos.
                    </p>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={openNewBudgetForm}
                    >
                      Criar primeiro orçamento
                    </button>
                  </div>
                ) : (
                  <div className="budget-list">
                    {monthlyBudgets.map((budget) => {
                      const used = categoryExpenses[budget.category] || 0;
                      const percentage = getBudgetPercentage(
                        used,
                        budget.limit
                      );
                      const status = getBudgetStatus(used, budget.limit);
                      const remaining = budget.limit - used;

                      return (
                        <div className="budget-row" key={budget.id}>
                          <div className="budget-row-main">
                            <div className="budget-category">
                              <strong>{budget.category}</strong>
                              <span>
                                {formatCurrency(used)} de{" "}
                                {formatCurrency(budget.limit)}
                              </span>
                            </div>

                            <div className="budget-row-actions">
                              <span className={`status-pill ${status}`}>
                                {status === "danger"
                                  ? "Limite excedido"
                                  : status === "warning"
                                    ? "Atenção"
                                    : "Dentro do limite"}
                              </span>

                              <button
                                type="button"
                                className="icon-button"
                                onClick={() => openEditBudgetForm(budget)}
                                title="Editar orçamento"
                              >
                                ✎
                              </button>

                              <button
                                type="button"
                                className="icon-button delete"
                                onClick={() => deleteBudget(budget.id)}
                                title="Excluir orçamento"
                              >
                                ×
                              </button>
                            </div>
                          </div>

                          <div className="budget-row-track">
                            <div
                              className={`budget-row-fill ${status}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>

                          <div className="budget-row-footer">
                            <span>{percentage.toFixed(1)}% utilizado</span>
                            <span
                              className={
                                remaining >= 0 ? "income-text" : "expense-text"
                              }
                            >
                              {remaining >= 0 ? "Restante: " : "Excedente: "}
                              {formatCurrency(Math.abs(remaining))}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="panel goals-panel">
                <div className="panel-header section-panel-header">
                  <div>
                    <span className="section-eyebrow">
                      OBJETIVOS FINANCEIROS
                    </span>
                    <h2>Minhas metas</h2>
                    <p>
                      Acompanhe quanto já acumulou e quanto falta para alcançar
                      seus objetivos.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={openNewGoalForm}
                  >
                    + Nova meta
                  </button>
                </div>

                <div className="goals-summary">
                  <div>
                    <span>Total acumulado</span>
                    <strong className="income-text">
                      {formatCurrency(totalGoalsCurrent)}
                    </strong>
                  </div>

                  <div>
                    <span>Objetivo total</span>
                    <strong>{formatCurrency(totalGoalsTarget)}</strong>
                  </div>

                  <div>
                    <span>Metas em andamento</span>
                    <strong>{activeGoals.length}</strong>
                  </div>

                  <div>
                    <span>Metas concluídas</span>
                    <strong className="income-text">
                      {completedGoals.length}
                    </strong>
                  </div>
                </div>

                <div className="goals-total-progress">
                  <div className="goals-total-heading">
                    <span>Progresso geral das metas</span>
                    <strong>{goalProgress.toFixed(1)}%</strong>
                  </div>

                  <div className="goal-track">
                    <div
                      className="goal-fill"
                      style={{ width: `${goalProgress}%` }}
                    />
                  </div>
                </div>

                {showGoalForm && (
                  <form className="form-card" onSubmit={saveGoal}>
                    <div className="form-heading">
                      <h3>
                        {editingGoalId !== null
                          ? "Editar meta financeira"
                          : "Cadastrar nova meta"}
                      </h3>

                      <button
                        type="button"
                        className="close-button"
                        onClick={() => {
                          setShowGoalForm(false);
                          setEditingGoalId(null);
                          setGoalError("");
                        }}
                      >
                        ×
                      </button>
                    </div>

                    <div className="form-grid">
                      <label className="field field-wide">
                        <span>Nome da meta</span>
                        <input
                          type="text"
                          value={goalForm.name}
                          onChange={(event) =>
                            setGoalForm((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          placeholder="Ex.: Comprar meu carro"
                          required
                        />
                      </label>

                      <label className="field">
                        <span>Categoria</span>
                        <select
                          value={goalForm.category}
                          onChange={(event) =>
                            setGoalForm((current) => ({
                              ...current,
                              category: event.target.value,
                            }))
                          }
                        >
                          {goalCategories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Valor desejado (R$)</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={goalForm.target}
                          onChange={(event) =>
                            setGoalForm((current) => ({
                              ...current,
                              target: event.target.value,
                            }))
                          }
                          placeholder="0,00"
                          required
                        />
                      </label>

                      <label className="field">
                        <span>Valor já acumulado (R$)</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={goalForm.current}
                          onChange={(event) =>
                            setGoalForm((current) => ({
                              ...current,
                              current: event.target.value,
                            }))
                          }
                          placeholder="0,00"
                        />
                      </label>

                      <label className="field">
                        <span>Prazo para alcançar</span>
                        <input
                          type="date"
                          value={goalForm.deadline}
                          min={getLocalDateString()}
                          onChange={(event) =>
                            setGoalForm((current) => ({
                              ...current,
                              deadline: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>

                    {goalError && <p className="form-error">{goalError}</p>}

                    <div className="form-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setShowGoalForm(false);
                          setEditingGoalId(null);
                          setGoalError("");
                        }}
                      >
                        Cancelar
                      </button>

                      <button type="submit" className="primary-button">
                        Salvar meta
                      </button>
                    </div>
                  </form>
                )}

                {goals.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">◎</span>
                    <h3>Você ainda não possui metas</h3>
                    <p>
                      Cadastre seus objetivos e acompanhe a evolução do seu
                      patrimônio.
                    </p>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={openNewGoalForm}
                    >
                      Criar primeira meta
                    </button>
                  </div>
                ) : (
                  <div className="goals-grid">
                    {goals.map((goal) => {
                      const percentage = getGoalPercentage(goal);
                      const remaining = Math.max(
                        goal.target - goal.current,
                        0
                      );
                      const days = getRemainingDays(goal.deadline);
                      const completed = goal.current >= goal.target;

                      return (
                        <article className="goal-card" key={goal.id}>
                          <div className="goal-card-header">
                            <div>
                              <span className="goal-category">
                                {goal.category}
                              </span>
                              <h3>{goal.name}</h3>
                            </div>

                            <span
                              className={`goal-status ${
                                completed ? "completed" : "in-progress"
                              }`}
                            >
                              {completed ? "Concluída" : "Em andamento"}
                            </span>
                          </div>

                          <div className="goal-values">
                            <strong>{formatCurrency(goal.current)}</strong>
                            <span>de {formatCurrency(goal.target)}</span>
                          </div>

                          <div className="goal-track">
                            <div
                              className="goal-fill"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>

                          <div className="goal-progress-label">
                            <strong>{percentage.toFixed(1)}%</strong>
                            <span>
                              {completed
                                ? "Objetivo alcançado"
                                : `Faltam ${formatCurrency(remaining)}`}
                            </span>
                          </div>

                          <label className="goal-update-field">
                            <span>Atualizar valor acumulado</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={goal.current}
                              onChange={(event) =>
                                updateGoalAmount(goal, event.target.value)
                              }
                            />
                          </label>

                          <div className="goal-card-footer">
                            <span>
                              Prazo:{" "}
                              {goal.deadline
                                ? formatDate(goal.deadline)
                                : "Não definido"}
                            </span>

                            {days !== null && !completed && (
                              <span className={days < 0 ? "expense-text" : ""}>
                                {days < 0
                                  ? "Prazo vencido"
                                  : days === 0
                                    ? "Vence hoje"
                                    : `${days} dias restantes`}
                              </span>
                            )}
                          </div>

                          <div className="goal-actions">
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => openEditGoalForm(goal)}
                            >
                              Editar meta
                            </button>

                            <button
                              type="button"
                              className="text-button delete-text"
                              onClick={() => deleteGoal(goal.id)}
                            >
                              Excluir
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="panel transactions-panel">
                <div className="panel-header">
                  <div>
                    <span className="section-eyebrow">
                      MOVIMENTAÇÕES DO PERÍODO
                    </span>
                    <h2>Lançamentos do mês</h2>
                    <p>
                      Últimas receitas e despesas registradas no módulo
                      financeiro.
                    </p>
                  </div>

                  <Link href="/financeiro/historico" className="text-link">
                    Ver histórico completo →
                  </Link>
                </div>

                {latestTransactions.length === 0 ? (
                  <div className="empty-state compact">
                    <h3>Nenhum lançamento neste período</h3>
                    <p>
                      Os lançamentos de receitas e despesas aparecerão aqui
                      automaticamente.
                    </p>
                  </div>
                ) : (
                  <div className="transaction-list">
                    {latestTransactions.map((transaction) => {
                      const isIncome = transaction.type === "Receita";

                      return (
                        <div
                          className="transaction-row"
                          key={transaction.id}
                        >
                          <div
                            className={`transaction-symbol ${
                              isIncome ? "income-symbol" : "expense-symbol"
                            }`}
                          >
                            {isIncome ? "↑" : "↓"}
                          </div>

                          <div className="transaction-description">
                            <strong>{transaction.description}</strong>
                            <span>
                              {transaction.category || "Sem categoria"} ·{" "}
                              {formatDate(transaction.date)}
                            </span>
                          </div>

                          <div className="transaction-value">
                            <strong
                              className={
                                isIncome ? "income-text" : "expense-text"
                              }
                            >
                              {isIncome ? "+" : "-"}
                              {formatCurrency(
                                Number(transaction.amount) || 0
                              )}
                            </strong>
                            <span>{transaction.status || "Sem status"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="planning-notice">
                <span className="notice-icon">i</span>
                <div>
                  <strong>Como funciona a integração</strong>
                  <p>
                    Receitas e despesas são consultadas diretamente dos
                    lançamentos financeiros do NEXO. Somente movimentações com
                    status &quot;Recebida&quot; ou &quot;Pago&quot; entram como
                    realizadas. Movimentações parciais permanecem no total
                    previsto, pois o lançamento atual não possui um campo
                    separado para o valor efetivamente pago ou recebido.
                    Orçamentos e metas são armazenados separadamente e não
                    alteram suas contas ou movimentações.
                  </p>
                </div>
              </section>
            </>
          )}

          <footer className="routine-footer">
            <span>© 2026 NEXO — GESTÃO PESSOAL</span>
            <span>PLANEJE. ORGANIZE. CONQUISTE.</span>
          </footer>
        </div>
      </section>

      <style jsx global>{`
        .planning-content {
          display: flex;
          flex-direction: column;
          gap: 18px;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .planning-intro {
          margin-bottom: 0;
        }

        .planning-intro p {
          max-width: 720px;
          margin: 0;
          color: #96969f;
          font-size: 13px;
          line-height: 1.6;
        }

        .section-eyebrow {
          display: block;
          margin-bottom: 9px;
          color: #85858e;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        .month-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 17px 19px;
          border: 1px solid #29292e;
          border-radius: 9px;
          background: #18181b;
          box-sizing: border-box;
        }

        .month-toolbar .section-eyebrow {
          margin-bottom: 5px;
        }

        .month-toolbar h2 {
          margin: 0;
          color: #f2f2f4;
          font-size: 19px;
          font-weight: 650;
          text-transform: capitalize;
        }

        .month-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .month-controls input {
          width: 145px;
          height: 36px;
          padding: 0 9px;
          color: #e8e8eb;
          background: #222226;
          border: 1px solid #39393f;
          border-radius: 6px;
          color-scheme: dark;
          font-size: 12px;
        }

        .month-arrow,
        .today-button {
          height: 36px;
          padding: 0 12px;
          color: #c9c9ce;
          background: #242428;
          border: 1px solid #39393f;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
        }

        .month-arrow {
          width: 36px;
          padding: 0;
          font-size: 17px;
        }

        .month-arrow:hover,
        .today-button:hover {
          color: #fff;
          border-color: #77777f;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .summary-card {
          min-width: 0;
          padding: 18px;
          border: 1px solid #2c2c32;
          border-radius: 9px;
          background: #19191c;
          box-sizing: border-box;
        }

        .summary-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 18px;
        }

        .summary-top > span:first-child {
          color: #a4a4ad;
          font-size: 12px;
        }

        .summary-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 7px;
          background: #29292e;
          font-size: 16px;
        }

        .summary-icon.income {
          color: #72c69b;
        }

        .summary-icon.expense {
          color: #df8585;
        }

        .summary-icon.balance {
          color: #b6b6d7;
        }

        .summary-icon.realized {
          color: #9ab8a4;
        }

        .summary-card > strong {
          display: block;
          overflow: hidden;
          font-size: clamp(19px, 2vw, 25px);
          font-weight: 700;
          letter-spacing: -0.5px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .summary-card small {
          display: block;
          margin-top: 9px;
          color: #85858e;
          font-size: 10px;
        }

        .income-text {
          color: #72c69b !important;
        }

        .expense-text {
          color: #df8585 !important;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 16px;
        }

        .panel {
          min-width: 0;
          padding: 21px;
          border: 1px solid #2c2c32;
          border-radius: 9px;
          background: #19191c;
          box-sizing: border-box;
        }

        .panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 21px;
        }

        .panel-header h2 {
          margin: 0;
          color: #f0f0f2;
          font-size: 17px;
          font-weight: 650;
        }

        .panel-header p {
          margin: 7px 0 0;
          color: #898991;
          font-size: 11px;
          line-height: 1.5;
        }

        .panel-header .section-eyebrow {
          margin-bottom: 7px;
        }

        .comparison-list {
          display: flex;
          flex-direction: column;
          gap: 23px;
        }

        .comparison-heading,
        .comparison-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .comparison-heading {
          margin-bottom: 10px;
        }

        .comparison-heading span {
          color: #dedee2;
          font-size: 12px;
          font-weight: 600;
        }

        .comparison-heading strong {
          font-size: 13px;
        }

        .comparison-track,
        .budget-main-track,
        .budget-row-track,
        .goal-track {
          width: 100%;
          height: 8px;
          overflow: hidden;
          border-radius: 20px;
          background: #303035;
        }

        .comparison-fill,
        .budget-main-fill,
        .budget-row-fill,
        .goal-fill {
          height: 100%;
          border-radius: inherit;
          transition: width 0.25s ease;
        }

        .income-fill {
          background: #5caa81;
        }

        .expense-fill {
          background: #bd6969;
        }

        .comparison-footer {
          margin-top: 8px;
          color: #85858e;
          font-size: 10px;
        }

        .pending-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 23px;
          padding-top: 18px;
          border-top: 1px solid #303035;
        }

        .pending-grid > div {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .pending-grid span {
          color: #898991;
          font-size: 10px;
        }

        .pending-grid strong {
          font-size: 14px;
        }

        .panel-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          color: #b8b8c4;
          border-radius: 7px;
          background: #29292e;
          font-size: 18px;
        }

        .budget-total {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-bottom: 16px;
        }

        .budget-total strong {
          color: #f0f0f2;
          font-size: 25px;
          letter-spacing: -0.5px;
        }

        .budget-total span,
        .budget-total-footer {
          color: #8e8e97;
          font-size: 10px;
        }

        .budget-main-fill {
          background: #8a8aa0;
        }

        .budget-main-fill.danger-fill {
          background: #bd6969;
        }

        .budget-total-footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 9px;
        }

        .budget-total-footer strong {
          color: #dedee2;
        }

        .budget-remaining {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 19px;
          padding-top: 15px;
          border-top: 1px solid #303035;
        }

        .budget-remaining span {
          color: #9999a1;
          font-size: 11px;
        }

        .budget-remaining strong {
          font-size: 14px;
        }

        .primary-button,
        .secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          padding: 0 14px;
          border: 1px solid #44444c;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
        }

        .primary-button {
          color: #fff;
          background: #414149;
          border-color: #55555e;
        }

        .primary-button:hover {
          background: #55555e;
          border-color: #77777f;
        }

        .secondary-button {
          color: #c8c8ce;
          background: #252529;
          border-color: #3b3b42;
        }

        .secondary-button:hover {
          color: #fff;
          background: #333339;
          border-color: #65656e;
        }

        .full-button {
          width: 100%;
          margin-top: 18px;
        }

        .section-panel-header {
          align-items: center;
        }

        .form-card {
          margin-bottom: 20px;
          padding: 18px;
          border: 1px solid #393940;
          border-radius: 8px;
          background: #202024;
        }

        .form-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 17px;
        }

        .form-heading h3 {
          margin: 0;
          color: #ededf0;
          font-size: 14px;
        }

        .close-button {
          width: 28px;
          height: 28px;
          color: #bcbcc4;
          background: #303035;
          border: 1px solid #44444b;
          border-radius: 5px;
          font-size: 19px;
          cursor: pointer;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }

        .field-wide {
          grid-column: 1 / -1;
        }

        .field span {
          color: #b6b6bf;
          font-size: 11px;
          font-weight: 600;
        }

        .field input,
        .field select {
          width: 100%;
          height: 39px;
          padding: 0 11px;
          color: #ededf0;
          background: #17171a;
          border: 1px solid #3b3b42;
          border-radius: 6px;
          outline: none;
          font-size: 12px;
          box-sizing: border-box;
          color-scheme: dark;
        }

        .field input:focus,
        .field select:focus {
          border-color: #77777f;
        }

        .field input::placeholder {
          color: #686871;
        }

        .form-error {
          margin: 13px 0 0;
          color: #e28a8a;
          font-size: 11px;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 18px;
        }

        .budget-list {
          display: flex;
          flex-direction: column;
        }

        .budget-row {
          padding: 17px 0;
          border-top: 1px solid #303035;
        }

        .budget-row:first-child {
          border-top: 0;
        }

        .budget-row-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .budget-category {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }

        .budget-category strong {
          color: #e6e6e9;
          font-size: 12px;
        }

        .budget-category span {
          color: #888891;
          font-size: 10px;
        }

        .budget-row-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .status-pill,
        .goal-status {
          display: inline-flex;
          align-items: center;
          min-height: 23px;
          padding: 0 8px;
          border: 1px solid #3b3b42;
          border-radius: 20px;
          font-size: 9px;
          white-space: nowrap;
        }

        .status-pill.success {
          color: #83c49d;
          background: #1e2c24;
          border-color: #31533d;
        }

        .status-pill.warning {
          color: #d5b477;
          background: #30291d;
          border-color: #5b4b2c;
        }

        .status-pill.danger {
          color: #df8989;
          background: #321f1f;
          border-color: #633838;
        }

        .status-pill.neutral {
          color: #aaaab3;
        }

        .icon-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 27px;
          height: 27px;
          color: #bcbcc4;
          background: #29292e;
          border: 1px solid #3d3d44;
          border-radius: 5px;
          cursor: pointer;
          font-size: 13px;
        }

        .icon-button:hover {
          color: #fff;
          border-color: #77777f;
        }

        .icon-button.delete:hover {
          color: #e28a8a;
          border-color: #874949;
        }

        .budget-row-track {
          height: 6px;
        }

        .budget-row-fill.success {
          background: #5caa81;
        }

        .budget-row-fill.warning {
          background: #c4a05c;
        }

        .budget-row-fill.danger {
          background: #bd6969;
        }

        .budget-row-fill.neutral {
          background: #777787;
        }

        .budget-row-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 8px;
          color: #898991;
          font-size: 10px;
        }

        .goals-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 21px;
        }

        .goals-summary > div {
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding: 13px;
          border: 1px solid #303035;
          border-radius: 7px;
          background: #202024;
        }

        .goals-summary span {
          color: #92929b;
          font-size: 10px;
        }

        .goals-summary strong {
          color: #e8e8eb;
          font-size: 16px;
        }

        .goals-total-progress {
          margin-bottom: 22px;
        }

        .goals-total-heading {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 9px;
          color: #b8b8c0;
          font-size: 11px;
        }

        .goals-total-heading strong {
          color: #d5d5dc;
        }

        .goal-track {
          height: 7px;
        }

        .goal-fill {
          background: #7c8f83;
        }

        .goals-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .goal-card {
          min-width: 0;
          padding: 17px;
          border: 1px solid #33333a;
          border-radius: 8px;
          background: #202024;
        }

        .goal-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 17px;
        }

        .goal-category {
          display: block;
          margin-bottom: 6px;
          color: #92929b;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .goal-card h3 {
          margin: 0;
          color: #ededf0;
          font-size: 13px;
          font-weight: 650;
        }

        .goal-status.completed {
          color: #83c49d;
          background: #1e2c24;
          border-color: #31533d;
        }

        .goal-status.in-progress {
          color: #b6b6c4;
          background: #292930;
        }

        .goal-values {
          display: flex;
          align-items: baseline;
          gap: 7px;
          margin-bottom: 10px;
        }

        .goal-values strong {
          color: #e8e8eb;
          font-size: 19px;
        }

        .goal-values span {
          color: #8e8e97;
          font-size: 10px;
        }

        .goal-progress-label {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 8px;
          color: #898991;
          font-size: 10px;
        }

        .goal-progress-label strong {
          color: #aabcae;
        }

        .goal-update-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin-top: 17px;
        }

        .goal-update-field span {
          color: #a4a4ad;
          font-size: 10px;
        }

        .goal-update-field input {
          width: 100%;
          height: 34px;
          padding: 0 9px;
          color: #e8e8eb;
          background: #17171a;
          border: 1px solid #3b3b42;
          border-radius: 5px;
          outline: none;
          font-size: 11px;
          box-sizing: border-box;
        }

        .goal-update-field input:focus {
          border-color: #77777f;
        }

        .goal-card-footer {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid #37373d;
          color: #92929b;
          font-size: 10px;
        }

        .goal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 14px;
          margin-top: 12px;
        }

        .text-button,
        .text-link {
          padding: 0;
          color: #b9b9c3;
          background: none;
          border: 0;
          font-size: 10px;
          text-decoration: none;
          cursor: pointer;
        }

        .text-button:hover,
        .text-link:hover {
          color: #fff;
          text-decoration: underline;
        }

        .delete-text {
          color: #ce8585;
        }

        .transaction-list {
          display: flex;
          flex-direction: column;
        }

        .transaction-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 0;
          border-top: 1px solid #303035;
        }

        .transaction-row:first-child {
          border-top: 0;
        }

        .transaction-symbol {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          border-radius: 7px;
          font-size: 17px;
        }

        .income-symbol {
          color: #72c69b;
          background: #1e2c24;
        }

        .expense-symbol {
          color: #df8585;
          background: #321f1f;
        }

        .transaction-description {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }

        .transaction-description strong {
          overflow: hidden;
          color: #e5e5e8;
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .transaction-description span {
          color: #888891;
          font-size: 10px;
        }

        .transaction-value {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 5px;
          flex-shrink: 0;
        }

        .transaction-value strong {
          font-size: 12px;
        }

        .transaction-value span {
          color: #888891;
          font-size: 9px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 35px 20px;
          border: 1px dashed #393940;
          border-radius: 8px;
          text-align: center;
        }

        .empty-state.compact {
          padding: 25px 15px;
        }

        .empty-icon {
          margin-bottom: 12px;
          color: #777783;
          font-size: 29px;
        }

        .empty-state h3 {
          margin: 0;
          color: #dedee2;
          font-size: 13px;
        }

        .empty-state p {
          max-width: 420px;
          margin: 8px 0 15px;
          color: #898991;
          font-size: 11px;
          line-height: 1.6;
        }

        .planning-notice {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          border: 1px solid #33333a;
          border-radius: 8px;
          background: #19191c;
          box-sizing: border-box;
        }

        .notice-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 22px;
          height: 22px;
          color: #bdbdc5;
          background: #303035;
          border-radius: 50%;
          font-size: 12px;
          font-weight: 700;
        }

        .planning-notice strong {
          color: #d6d6dc;
          font-size: 11px;
        }

        .planning-notice p {
          margin: 6px 0 0;
          color: #92929b;
          font-size: 10px;
          line-height: 1.7;
        }

        .loading-state {
          padding: 50px 20px;
          color: #aaaab3;
          text-align: center;
          font-size: 13px;
        }

        @media (max-width: 1100px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .content-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .month-toolbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .month-controls {
            width: 100%;
          }

          .month-controls input {
            flex: 1;
            min-width: 0;
          }

          .summary-grid {
            gap: 9px;
          }

          .summary-card {
            padding: 13px;
          }

          .summary-top {
            margin-bottom: 13px;
          }

          .summary-card > strong {
            font-size: 18px;
          }

          .panel {
            padding: 16px;
          }

          .section-panel-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .goals-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .goals-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 460px) {
          .summary-grid {
            grid-template-columns: 1fr 1fr;
          }

          .summary-card > strong {
            font-size: 16px;
          }

          .summary-top > span:first-child {
            font-size: 10px;
          }

          .month-controls {
            gap: 5px;
          }

          .month-arrow {
            width: 31px;
          }

          .today-button {
            padding: 0 8px;
            font-size: 10px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .field-wide {
            grid-column: auto;
          }

          .budget-row-main {
            align-items: flex-start;
            flex-direction: column;
          }

          .budget-row-actions {
            width: 100%;
            justify-content: flex-end;
          }

          .status-pill {
            margin-right: auto;
          }

          .goals-summary strong {
            font-size: 14px;
          }

          .pending-grid {
            grid-template-columns: 1fr;
          }

          .transaction-row {
            gap: 8px;
          }

          .transaction-value strong {
            font-size: 10px;
          }

          .planning-notice {
            padding: 13px;
          }
        }
      `}</style>
    </main>
  );
}

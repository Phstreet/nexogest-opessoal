
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Transaction = {
  id: number;
  description: string;
  type:
    | "Receita"
    | "Despesa"
    | "Transferência"
    | "Investimento"
    | "Aplicação"
    | "Reserva";
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

type Task = {
  id: number;
  description: string;
  done: boolean;
};

type Tab = "dashboard" | "rotina";

const TRANSACTIONS_KEY = "nexo_transactions";
const TASKS_KEY = "nexo_tasks";

const financeMenuItems = [
  { label: "Visão geral financeira", href: "/financeiro", main: true },
  { label: "Contas", href: "/financeiro/contas" },
  { label: "Contas a pagar", href: "/financeiro/contas-a-pagar" },
  { label: "Contas a receber", href: "/financeiro/contas-a-receber" },
  { label: "Histórico financeiro", href: "/financeiro/historico" },
  { label: "Investimentos", href: "/financeiro/investimentos" },
  { label: "Reserva financeira", href: "/financeiro/reservas" },
  { label: "Planejamento", href: "/financeiro/planejamento" },
  { label: "Dashboard financeiro", href: "/financeiro/dashboard" },
];

const routineMenuItems = [
  { label: "Agenda diária", href: "/rotina/agenda" },
  { label: "Tarefas", href: "/rotina/tarefas" },
  { label: "Planejamento semanal", href: "/rotina/planejamento" },
  { label: "Hábitos", href: "/rotina/habitos" },
  { label: "Produtividade", href: "/rotina/produtividade" },
];

function Logo() {
  return (
    <div className="brand">
      <svg
        className="brand-symbol"
        viewBox="0 0 52 52"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="silver" x1="5" y1="5" x2="48" y2="48">
            <stop stopColor="#FFFFFF" />
            <stop offset=".45" stopColor="#AEB4BC" />
            <stop offset="1" stopColor="#5D626B" />
          </linearGradient>
        </defs>

        <path
          d="M10 42V10H18L42 37V10H34V42H26L10 24"
          stroke="url(#silver)"
          strokeWidth="4"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>

      <div>
        <div className="brand-name">NEXO</div>
        <div className="brand-subtitle">GESTÃO PESSOAL</div>
      </div>
    </div>
  );
}

function money(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;

  return safeValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function loadLocalData<T>(
  key: string,
  fallback: T,
  validator: (value: unknown) => value is T
): T {
  try {
    const saved = localStorage.getItem(key);

    if (!saved) return fallback;

    const parsed: unknown = JSON.parse(saved);

    return validator(parsed) ? parsed : fallback;
  } catch (error) {
    console.error(`Erro ao carregar ${key}:`, error);
    return fallback;
  }
}

function isValidTransactionArray(
  value: unknown
): value is Transaction[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        typeof item.id === "number" &&
        typeof item.description === "string" &&
        typeof item.type === "string" &&
        typeof item.amount === "number"
    )
  );
}

function isValidTaskArray(value: unknown): value is Task[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        typeof item.id === "number" &&
        typeof item.description === "string" &&
        typeof item.done === "boolean"
    )
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("dashboard");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [loaded, setLoaded] = useState(false);
  const [taskName, setTaskName] = useState("");

  const [financeMenuOpen, setFinanceMenuOpen] = useState(false);
  const [routineMenuOpen, setRoutineMenuOpen] = useState(false);

  // =====================================================
  // CARREGAMENTO DOS DADOS
  // =====================================================

  useEffect(() => {
    function loadData() {
      const savedTransactions = loadLocalData(
        TRANSACTIONS_KEY,
        [],
        isValidTransactionArray
      );

      const savedTasks = loadLocalData(
        TASKS_KEY,
        [],
        isValidTaskArray
      );

      setTransactions(savedTransactions);
      setTasks(savedTasks);
      setLoaded(true);
    }

    loadData();

    function handleStorage(event: StorageEvent) {
      if (
        event.key === TRANSACTIONS_KEY ||
        event.key === TASKS_KEY ||
        event.key === null
      ) {
        loadData();
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // =====================================================
  // SALVAMENTO DAS TAREFAS
  // =====================================================

  useEffect(() => {
    if (!loaded) return;

    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error("Erro ao salvar as tarefas:", error);
    }
  }, [tasks, loaded]);

  // =====================================================
  // RESUMO FINANCEIRO
  // =====================================================

  const activeTransactions = transactions.filter(
    (item) => item.status !== "Cancelada"
  );

  const income = activeTransactions
    .filter((item) => item.type === "Receita")
    .reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );

  const expenses = activeTransactions
    .filter((item) => item.type === "Despesa")
    .reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );

  const balance = income - expenses;

  // =====================================================
  // PRODUTIVIDADE
  // =====================================================

  const completedTasks = tasks.filter(
    (task) => task.done
  ).length;

  const pendingTasks = tasks.filter(
    (task) => !task.done
  );

  const progress = tasks.length
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0;

  // =====================================================
  // FUNÇÕES DAS TAREFAS
  // =====================================================

  function addTask() {
    const description = taskName.trim();

    if (!description) {
      alert("Informe a descrição da atividade.");
      return;
    }

    const newTask: Task = {
      id: Date.now(),
      description,
      done: false,
    };

    setTasks((current) => [...current, newTask]);
    setTaskName("");
  }

  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? { ...task, done: !task.done }
          : task
      )
    );
  }

  function deleteTask(id: number) {
    if (!confirm("Deseja excluir esta atividade?")) {
      return;
    }

    setTasks((current) =>
      current.filter((task) => task.id !== id)
    );
  }

  // =====================================================
  // CABEÇALHO
  // =====================================================

  const pageTitles: Record<Tab, string> = {
    dashboard: "Visão geral",
    rotina: "Minha rotina",
  };

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // =====================================================
  // INTERFACE
  // =====================================================

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Logo />

        <div className="sidebar-section-label">
          MENU PRINCIPAL
        </div>

        <nav className="navigation">
          {/* VISÃO GERAL */}

          <button
            type="button"
            className={`nav-item ${
              tab === "dashboard" ? "active" : ""
            }`}
            onClick={() => setTab("dashboard")}
          >
            <span className="nav-icon">⌂</span>
            <span>Visão geral</span>
          </button>

          {/* MENU FINANCEIRO */}

          <div className="nav-group">
            <button
              type="button"
              className={`nav-item nav-finance-parent ${
                financeMenuOpen ? "active" : ""
              }`}
              onClick={() => {
                setFinanceMenuOpen((current) => !current);
                setRoutineMenuOpen(false);
              }}
              aria-expanded={financeMenuOpen}
              aria-controls="finance-submenu"
            >
              <span className="nav-icon">◈</span>

              <span className="nav-finance-label">
                Financeiro
              </span>

              <span
                className={`nav-chevron ${
                  financeMenuOpen ? "open" : ""
                }`}
              >
                ›
              </span>
            </button>

            {financeMenuOpen && (
              <div
                className="nav-submenu"
                id="finance-submenu"
              >
                {financeMenuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-subitem ${
                      item.main ? "nav-subitem-main" : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* MINHA ROTINA EXPANSÍVEL */}

          <div className="nav-group">
            <button
              type="button"
              className={`nav-item nav-finance-parent ${
                routineMenuOpen || tab === "rotina" ? "active" : ""
              }`}
              onClick={() => {
                setRoutineMenuOpen((current) => !current);
                setFinanceMenuOpen(false);
              }}
              aria-expanded={routineMenuOpen}
              aria-controls="routine-submenu"
            >
              <span className="nav-icon">▤</span>

              <span className="nav-finance-label">
                Minha rotina
              </span>

              <span
                className={`nav-chevron ${
                  routineMenuOpen ? "open" : ""
                }`}
              >
                ›
              </span>
            </button>

            {routineMenuOpen && (
              <div
                className="nav-submenu"
                id="routine-submenu"
              >
                <Link
                  href="/rotina"
                  className="nav-subitem nav-subitem-main"
                >
                  Visão geral da rotina
                </Link>

                {routineMenuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="nav-subitem"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="status-dot" />
            Sistema operacional
          </div>

          <div className="sidebar-version">
            NEXO · VERSÃO 2.0
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              NEXO / {pageTitles[tab].toUpperCase()}
            </div>

            <h1>{pageTitles[tab]}</h1>
          </div>

          <div className="topbar-right">
            <div className="date-display">
              <span className="date-icon">◷</span>
              {today}
            </div>

            <div className="profile-avatar">N</div>
          </div>
        </header>

        <div className="content">
          {/* VISÃO GERAL */}

          {tab === "dashboard" && (
            <>
              <section className="hero-panel">
                <div className="hero-content">
                  <div className="eyebrow">
                    <span className="eyebrow-line" />
                    SEU ESPAÇO DE ORGANIZAÇÃO
                  </div>

                  <h2>
                    Você no controle
                    <br />
                    da sua <span>vida.</span>
                  </h2>

                  <p>
                    Planeje com clareza, organize suas prioridades
                    <br className="desktop-break" />
                    e construa seus resultados todos os dias.
                  </p>

                  <Link
                    href="/financeiro"
                    className="hero-button"
                  >
                    Acessar meu financeiro <span>↗</span>
                  </Link>
                </div>

                <div className="hero-art" aria-hidden="true">
                  <div className="hero-orbit orbit-one" />
                  <div className="hero-orbit orbit-two" />
                  <div className="hero-mountain mountain-back" />
                  <div className="hero-mountain mountain-front" />
                  <div className="hero-glow" />
                </div>

                <div className="hero-index">
                  01 — CONTROLE
                </div>
              </section>

              <div className="section-heading">
                <div>
                  <div className="section-kicker">
                    ACOMPANHAMENTO
                  </div>

                  <h2>Resumo financeiro</h2>
                </div>

                <Link
                  href="/financeiro"
                  className="text-link"
                >
                  Ver movimentações <span>→</span>
                </Link>
              </div>

              <section className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-top">
                    <span>Receitas</span>
                    <span className="metric-icon">↗</span>
                  </div>

                  <div className="metric-value">
                    {money(income)}
                  </div>

                  <div className="metric-caption">
                    Total de entradas cadastradas
                  </div>

                  <div className="metric-line silver-line" />
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span>Despesas</span>
                    <span className="metric-icon">↙</span>
                  </div>

                  <div className="metric-value">
                    {money(expenses)}
                  </div>

                  <div className="metric-caption">
                    Total de saídas cadastradas
                  </div>

                  <div className="metric-line dark-line" />
                </div>

                <div className="metric-card featured-metric">
                  <div className="metric-top">
                    <span>Saldo disponível</span>
                    <span className="metric-icon">◈</span>
                  </div>

                  <div className="metric-value">
                    {money(balance)}
                  </div>

                  <div className="metric-caption">
                    Receitas menos despesas
                  </div>

                  <div className="metric-line silver-line" />
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span>Produtividade</span>
                    <span className="metric-icon">✓</span>
                  </div>

                  <div className="metric-value">
                    {completedTasks}
                    <small> / {tasks.length}</small>
                  </div>

                  <div className="metric-caption">
                    Tarefas concluídas
                  </div>

                  <div className="metric-line light-line" />
                </div>
              </section>

              <section className="dashboard-bottom">
                <div className="panel activity-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="section-kicker">
                        ORGANIZAÇÃO
                      </div>

                      <h3>Próximas atividades</h3>
                    </div>

                    <Link
                      href="/rotina"
                      className="small-outline-button"
                    >
                      Ver todas
                    </Link>
                  </div>

                  {pendingTasks.length > 0 ? (
                    <div className="activity-list">
                      {pendingTasks.slice(0, 5).map((task) => (
                        <div
                          className="activity-item"
                          key={task.id}
                        >
                          <span className="activity-bullet" />

                          <span>{task.description}</span>

                          <button
                            type="button"
                            className="activity-check"
                            onClick={() => toggleTask(task.id)}
                            title="Concluir tarefa"
                            aria-label={`Concluir ${task.description}`}
                          >
                            ✓
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <span>✓</span>

                      <p>Nenhuma tarefa pendente.</p>

                      <Link href="/rotina">
                        Adicionar atividade
                      </Link>
                    </div>
                  )}
                </div>

                <div className="panel summary-panel">
                  <div className="section-kicker">
                    SEU PROGRESSO
                  </div>

                  <h3>
                    Consistência gera resultados.
                  </h3>

                  <p>
                    Cada tarefa concluída e cada decisão financeira
                    consciente aproximam você dos seus objetivos.
                  </p>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>

                  <div className="progress-label">
                    <span>Atividades concluídas</span>
                    <strong>{progress}%</strong>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* MINHA ROTINA */}

          {tab === "rotina" && (
            <>
              <div className="page-intro">
                <div className="section-kicker">
                  PRODUTIVIDADE E ORGANIZAÇÃO
                </div>

                <h2>Minha rotina</h2>

                <p>
                  Organize suas atividades, acompanhe seu progresso
                  e mantenha o foco.
                </p>
              </div>

              <section className="metrics-grid routine-metrics">
                <div className="metric-card">
                  <div className="metric-top">
                    <span>Total de tarefas</span>
                    <span>▤</span>
                  </div>

                  <div className="metric-value">
                    {tasks.length}
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span>Concluídas</span>
                    <span>✓</span>
                  </div>

                  <div className="metric-value">
                    {completedTasks}
                  </div>
                </div>

                <div className="metric-card featured-metric">
                  <div className="metric-top">
                    <span>Pendentes</span>
                    <span>◷</span>
                  </div>

                  <div className="metric-value">
                    {pendingTasks.length}
                  </div>
                </div>
              </section>

              <section className="panel task-form-panel">
                <div className="section-kicker">
                  PLANEJAMENTO
                </div>

                <h3>Nova atividade</h3>

                <div className="task-entry">
                  <input
                    className="form-input"
                    placeholder="O que você precisa fazer?"
                    value={taskName}
                    onChange={(event) =>
                      setTaskName(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        addTask();
                      }
                    }}
                  />

                  <button
                    type="button"
                    className="primary-button"
                    onClick={addTask}
                  >
                    + Adicionar tarefa
                  </button>
                </div>
              </section>

              <section className="panel tasks-panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">
                      SEU PLANEJAMENTO
                    </div>

                    <h3>Lista de atividades</h3>
                  </div>

                  <span className="count-badge">
                    {tasks.length} tarefas
                  </span>
                </div>

                {tasks.length > 0 ? (
                  <div className="task-list">
                    {tasks.map((task) => (
                      <div
                        className="task-item"
                        key={task.id}
                      >
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() => toggleTask(task.id)}
                          className="task-checkbox"
                        />

                        <span
                          className={
                            task.done ? "task-done" : ""
                          }
                        >
                          {task.description}
                        </span>

                        <span
                          className={`task-status ${
                            task.done ? "done" : ""
                          }`}
                        >
                          {task.done ? "Concluída" : "Pendente"}
                        </span>

                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => deleteTask(task.id)}
                          title="Excluir tarefa"
                          aria-label={`Excluir ${task.description}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span>✓</span>

                    <p>Sua lista está vazia.</p>

                    <small>
                      Adicione uma atividade para começar.
                    </small>
                  </div>
                )}
              </section>
            </>
          )}

          <footer className="footer">
            <span>
              © 2026 NEXO — GESTÃO PESSOAL
            </span>

            <span>
              PLANEJE. ORGANIZE. CONQUISTE.
            </span>
          </footer>
        </div>
      </section>
    </main>
  );
}

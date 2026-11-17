
"use client";

import { useState } from "react";
import { useRoutineCollection } from "@/hooks/useRoutineCollection";
import { useFinanceDashboard } from "@/app/hooks/finance/useFinanceDashboard";
import {
  isValidRoutineTask,
  isValidRoutineHabit,
  type RoutineTask,
  type RoutineHabit,
} from "@/lib/routine/types";
import Link from "next/link";
import AppLayout from "../components/layout/AppLayout";

type Tab = "dashboard" | "rotina";

function money(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;

  return safeValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("dashboard");

  const [taskName, setTaskName] = useState("");

  // Usa o armazenamento centralizado para preservar dados inválidos
  // e impedir gravações quando a coleção não puder ser validada.
  const {
    items: tasks,
    setItems: setTasks,
    safeToSave,
    storageError,
  } = useRoutineCollection<RoutineTask>("nexo_tasks", isValidRoutineTask);

  // Mantém o resumo alinhado ao Dashboard Financeiro:
  // somente valores efetivamente recebidos e pagos no mês atual.
  const {
    currentConfirmedRevenue: income,
    currentConfirmedExpenses: expenses,
    currentBalance: balance,
  } = useFinanceDashboard();

  const {
    items: habits,
    setItems: setHabits,
    safeToSave: habitsSafeToSave,
    storageError: habitsStorageError,
  } = useRoutineCollection<RoutineHabit>("nexo_habits", isValidRoutineHabit);

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayTasks = tasks.filter((task) => !task.done && task.date === todayKey);
  const activeHabits = habits.filter((habit) => habit.active);
  const completedHabitsToday = activeHabits.filter((habit) => habit.completedDates.includes(todayKey));

  function toggleHabitToday(id: number) {
    if (!habitsSafeToSave) return;

    setHabits((current) =>
      current.map((habit) => {
        if (habit.id !== id) return habit;
        const completed = habit.completedDates.includes(todayKey);
        return {
          ...habit,
          completedDates: completed
            ? habit.completedDates.filter((date) => date !== todayKey)
            : [...habit.completedDates, todayKey],
        };
      })
    );
  }

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

  function addTask(date?: string) {
    if (!safeToSave) return;

    const description = taskName.trim();

    if (!description) {
      alert("Informe a descrição da atividade.");
      return;
    }

    const newTask: RoutineTask = {
      id: Date.now(),
      description,
      done: false,
      ...(date ? { date } : {}),
    };

    setTasks((current) => [...current, newTask]);
    setTaskName("");
  }

  function toggleTask(id: number) {
    if (!safeToSave) return;

    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? { ...task, done: !task.done }
          : task
      )
    );
  }

  function deleteTask(id: number) {
    if (!safeToSave) return;

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
    dashboard: "Central do Dia",
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
    <AppLayout
      header={
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
      }
    >
      <div className="content daily-home-content">
        {storageError && (
          <div role="alert" className="storage-protection-message">
            <strong>Armazenamento protegido — tarefas:</strong> {storageError}
            {!safeToSave && " As alterações de tarefas foram bloqueadas para proteger seus dados."}
          </div>
        )}
        {habitsStorageError && (
          <div role="alert" className="storage-protection-message">
            <strong>Armazenamento protegido — hábitos:</strong> {habitsStorageError}
            {!habitsSafeToSave && " As alterações de hábitos foram bloqueadas para proteger seus dados."}
          </div>
        )}

        {/* ALTERNÂNCIA ENTRE AS ABAS */}

        <div
          className="section-heading"
          style={{ marginBottom: "24px" }}
        >
          <div>
            <div className="section-kicker">
              ÁREA DE TRABALHO
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "10px",
              }}
            >
              <button
                type="button"
                className={
                  tab === "dashboard"
                    ? "primary-button"
                    : "small-outline-button"
                }
                onClick={() => setTab("dashboard")}
                aria-pressed={tab === "dashboard"}
              >
                Central do Dia
              </button>

              <button
                type="button"
                className={
                  tab === "rotina"
                    ? "primary-button"
                    : "small-outline-button"
                }
                onClick={() => setTab("rotina")}
                aria-pressed={tab === "rotina"}
              >
                Minha rotina
              </button>
            </div>
          </div>
        </div>

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
                  Valor efetivamente recebido neste mês
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
                  Valor efetivamente pago neste mês
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
                  Resultado realizado do mês
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

            <section className="panel task-form-panel daily-quick-entry">
              <div className="section-kicker">CADASTRO RÁPIDO</div>
              <h3>O que você precisa resolver hoje?</h3>
              <div className="task-entry">
                <input
                  className="form-input"
                  placeholder="Digite uma tarefa para hoje..."
                  value={taskName}
                  onChange={(event) => setTaskName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addTask(todayKey);
                  }}
                  aria-label="Nova tarefa para hoje"
                />
                <button type="button" className="primary-button" onClick={() => addTask(todayKey)}>
                  + Adicionar à agenda de hoje
                </button>
              </div>
              <div className="daily-quick-links">
                <Link href="/financeiro">Nova movimentação financeira ↗</Link>
                <Link href="/rotina/agenda">Organizar agenda ↗</Link>
                <Link href="/rotina/habitos">Acompanhar hábitos ↗</Link>
              </div>
            </section>

            <section className="dashboard-bottom daily-overview-grid">
              <div className="panel activity-panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">AGENDA DE HOJE</div>
                    <h3>Atividades programadas</h3>
                  </div>
                  <Link href="/rotina/agenda" className="small-outline-button">Abrir agenda</Link>
                </div>
                {todayTasks.length ? (
                  <div className="activity-list">
                    {todayTasks.slice(0, 5).map((task) => (
                      <div className="activity-item" key={task.id}>
                        <span className="activity-bullet" />
                        <span>{task.time ? `${task.time} · ` : ""}{task.description}</span>
                        <button type="button" className="activity-check" onClick={() => toggleTask(task.id)} aria-label={`Concluir ${task.description}`}>✓</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>Nenhuma tarefa programada para hoje.</p>
                    <Link href="/rotina/agenda">Organizar minha agenda</Link>
                  </div>
                )}
              </div>

              <div className="panel summary-panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">HÁBITOS</div>
                    <h3>Meu progresso de hoje</h3>
                  </div>
                  <Link href="/rotina/habitos" className="small-outline-button">Ver hábitos</Link>
                </div>
                {activeHabits.length ? (
                  <>
                    <div className="progress-label">
                      <span>{completedHabitsToday.length} de {activeHabits.length} concluídos</span>
                      <strong>{Math.round((completedHabitsToday.length / activeHabits.length) * 100)}%</strong>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${Math.round((completedHabitsToday.length / activeHabits.length) * 100)}%` }} />
                    </div>
                    <div className="activity-list">
                      {activeHabits.slice(0, 5).map((habit) => {
                        const completed = habit.completedDates.includes(todayKey);
                        return (
                          <div className="activity-item" key={habit.id}>
                            <span className="activity-bullet" />
                            <span className={completed ? "daily-completed" : ""}>{habit.name}</span>
                            <button type="button" className="activity-check" onClick={() => toggleHabitToday(habit.id)} aria-label={completed ? `Desmarcar ${habit.name}` : `Concluir ${habit.name}`}>{completed ? "✓" : "○"}</button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <p>Você ainda não cadastrou hábitos.</p>
                    <Link href="/rotina/habitos">Criar primeiro hábito</Link>
                  </div>
                )}
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
                  onClick={() => addTask()}
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

        <style jsx>{`
          .daily-quick-links { display:flex; flex-wrap:wrap; gap:14px; margin-top:14px; }
          .daily-quick-links a { color:#aaa; font-size:10px; text-decoration:none; }
          .daily-quick-links a:hover { color:#fff; text-decoration:underline; }
          .daily-overview-grid { margin-top:18px; }
          .daily-completed { color:#888; text-decoration:line-through; }
          @media(max-width:700px) {
            .daily-quick-links { flex-direction:column; gap:10px; }
            .daily-quick-entry .task-entry { align-items:stretch; flex-direction:column; }
            .daily-quick-entry .task-entry button { width:100%; }
          }
        `}</style>

        <footer className="footer">
          <span>
            © 2026 NEXO — GESTÃO PESSOAL
          </span>

          <span>
            PLANEJE. ORGANIZE. CONQUISTE.
          </span>
        </footer>
      </div>
    </AppLayout>
  );
}

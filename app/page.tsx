
"use client";

import { useNexoConfirm } from "@/contexts/NexoConfirmProvider";

import { useState } from "react";
import { useRoutineCollection } from "@/hooks/useRoutineCollection";
import { useFinanceDashboard } from "@/app/hooks/finance/useFinanceDashboard";
import {
  isValidRoutineTask,
  isValidRoutineHabit,
  type RoutineTask,
  type RoutineHabit,
} from "@/lib/routine/types";
import AppLayout from "../components/layout/AppLayout";
import DailyCenter from "@/components/dashboard/DailyCenter";

type Tab = "dashboard" | "rotina";

export default function Home() {
  const confirm = useNexoConfirm();
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
    transactions: financeTransactions,
    currentConfirmedRevenue: income,
    currentConfirmedExpenses: expenses,
    currentBalance: balance,
    loaded: financeLoaded,
    error: financeError,
  } = useFinanceDashboard();

  const {
    items: habits,
    setItems: setHabits,
    safeToSave: habitsSafeToSave,
    storageError: habitsStorageError,
  } = useRoutineCollection<RoutineHabit>("nexo_habits", isValidRoutineHabit);

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

  async function deleteTask(id: number) {
    if (!safeToSave) return;

    if (!(await confirm({ title: "Excluir atividade", message: "Deseja excluir esta atividade?", confirmLabel: "Excluir", destructive: true }))) {
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
          <DailyCenter
            tasks={tasks}
            habits={habits}
            transactions={financeTransactions}
            financeLoaded={financeLoaded}
            financeError={financeError}
            income={income}
            expenses={expenses}
            balance={balance}
            onToggleTask={toggleTask}
            onToggleHabit={toggleHabitToday}
            onAddTask={() => addTask(todayKey)}
            taskName={taskName}
            onTaskNameChange={setTaskName}
            canSaveTasks={safeToSave}
            canSaveHabits={habitsSafeToSave}
            taskError={storageError}
            habitError={habitsStorageError}
          />
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

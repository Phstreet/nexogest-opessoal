
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import MainNavigation from "../../../components/navigation/MainNavigation";

type Priority = "Baixa" | "Média" | "Alta" | "Urgente";

type Task = {
  id: number;
  description: string;
  done: boolean;
  date?: string;
  time?: string;
  priority?: Priority;
  category?: string;
  notes?: string;
  createdAt?: string;
};

const TASKS_KEY = "nexo_tasks";

const weekDays = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];

function getLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function dateToString(date: Date) {
  return getLocalDate(date);
}

function getWeekStart(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const difference = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);
  result.setHours(12, 0, 0, 0);

  return result;
}

function formatPeriod(start: Date, end: Date) {
  const first = start.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });

  const last = end.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return `${first} – ${last}`;
}

function loadTasks(): Task[] {
  try {
    const stored = localStorage.getItem(TASKS_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is Task =>
        item &&
        typeof item.id === "number" &&
        typeof item.description === "string" &&
        typeof item.done === "boolean"
    );
  } catch {
    return [];
  }
}

function priorityClass(priority?: Priority) {
  switch (priority) {
    case "Urgente":
      return "urgent";
    case "Alta":
      return "high";
    case "Média":
      return "medium";
    default:
      return "low";
  }
}

export default function WeeklyPlanningPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [weekStart, setWeekStart] = useState(() =>
    getWeekStart(new Date())
  );

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getLocalDate());
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState<Priority>("Média");
  const [category, setCategory] = useState("Pessoal");
  const [notes, setNotes] = useState("");

  const today = getLocalDate();

  const loadData = useCallback(() => {
    setTasks(loadTasks());
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadData();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === TASKS_KEY) loadData();
    };

    window.addEventListener("storage", handleStorage);

    return () => window.removeEventListener("storage", handleStorage);
  }, [loadData]);

  useEffect(() => {
    if (!loaded) return;

    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error("Erro ao salvar planejamento:", error);
    }
  }, [tasks, loaded]);

  const days = useMemo(() => {
    return weekDays.map((name, index) => {
      const current = new Date(weekStart);
      current.setDate(current.getDate() + index);

      const dateString = dateToString(current);

      const dayTasks = tasks
        .filter((task) => task.date === dateString)
        .sort((a, b) => {
          if (!a.time && !b.time) return 0;
          if (!a.time) return 1;
          if (!b.time) return -1;
          return a.time.localeCompare(b.time);
        });

      return {
        name,
        date: dateString,
        number: current.getDate(),
        tasks: dayTasks,
        total: dayTasks.length,
        completed: dayTasks.filter((task) => task.done).length,
        pending: dayTasks.filter((task) => !task.done).length,
      };
    });
  }, [weekStart, tasks]);

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }, [weekStart]);

  const weeklyTasks = useMemo(() => {
    const start = dateToString(weekStart);
    const end = dateToString(weekEnd);

    return tasks.filter(
      (task) => task.date && task.date >= start && task.date <= end
    );
  }, [tasks, weekStart, weekEnd]);

  const totalTasks = weeklyTasks.length;
  const completedTasks = weeklyTasks.filter((task) => task.done).length;
  const pendingTasks = totalTasks - completedTasks;

  const weeklyProgress = totalTasks
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  const urgentTasks = weeklyTasks.filter(
    (task) => !task.done && task.priority === "Urgente"
  ).length;

  const unplannedTasks = tasks.filter((task) => !task.date && !task.done).length;

  const busiestDay = useMemo(() => {
    if (!days.length) return null;

    return days.reduce((previous, current) =>
      current.total > previous.total ? current : previous
    );
  }, [days]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  function changeWeek(amount: number) {
    setWeekStart((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + amount * 7);
      return next;
    });
  }

  function goToCurrentWeek() {
    setWeekStart(getWeekStart(new Date()));
  }

  function resetForm() {
    setDescription("");
    setDate(dateToString(weekStart));
    setTime("");
    setPriority("Média");
    setCategory("Pessoal");
    setNotes("");
    setEditingId(null);
    setShowForm(false);
  }

  function openNewTask(selectedDate?: string) {
    setEditingId(null);
    setDescription("");
    setDate(selectedDate || dateToString(weekStart));
    setTime("");
    setPriority("Média");
    setCategory("Pessoal");
    setNotes("");
    setShowForm(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editTask(task: Task) {
    setEditingId(task.id);
    setDescription(task.description);
    setDate(task.date || dateToString(weekStart));
    setTime(task.time || "");
    setPriority(task.priority || "Média");
    setCategory(task.category || "Pessoal");
    setNotes(task.notes || "");
    setShowForm(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!description.trim()) {
      alert("Informe o nome da atividade.");
      return;
    }

    if (!date) {
      alert("Selecione uma data para a atividade.");
      return;
    }

    if (editingId !== null) {
      setTasks((current) =>
        current.map((task) =>
          task.id === editingId
            ? {
                ...task,
                description: description.trim(),
                date,
                time,
                priority,
                category,
                notes: notes.trim(),
              }
            : task
        )
      );
    } else {
      const newTask: Task = {
        id: Date.now(),
        description: description.trim(),
        done: false,
        date,
        time,
        priority,
        category,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      };

      setTasks((current) => [...current, newTask]);
    }

    resetForm();
  }

  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task
      )
    );
  }

  function deleteTask(id: number) {
    if (!window.confirm("Deseja realmente excluir esta atividade?")) return;

    setTasks((current) => current.filter((task) => task.id !== id));

    if (editingId === id) resetForm();
  }

  return (
    <main className="app-shell">
      <MainNavigation />

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Minha rotina</span>
            <span className="breadcrumb-separator">/</span>
            <strong>Planejamento semanal</strong>
          </div>

          <div className="topbar-right">
            <div className="date-display">
              {new Date().toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </div>
            <div className="profile-avatar">N</div>
          </div>
        </header>

        <div className="weekly-content">
          <section className="weekly-welcome">
            <div>
              <span className="eyebrow">ORGANIZAÇÃO E PLANEJAMENTO</span>
              <h1>{greeting}, planeje sua semana.</h1>
              <p>
                Organize suas prioridades, distribua suas atividades e acompanhe
                sua evolução durante a semana.
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={() => openNewTask()}
            >
              ＋ Nova atividade
            </button>
          </section>

          <section className="week-selector">
            <div className="week-selector-left">
              <button
                type="button"
                className="week-arrow"
                onClick={() => changeWeek(-1)}
                aria-label="Semana anterior"
              >
                ‹
              </button>

              <div className="week-period">
                <span className="eyebrow">PERÍODO SELECIONADO</span>
                <h2>{formatPeriod(weekStart, weekEnd)}</h2>
              </div>

              <button
                type="button"
                className="week-arrow"
                onClick={() => changeWeek(1)}
                aria-label="Próxima semana"
              >
                ›
              </button>
            </div>

            <button
              type="button"
              className="today-button"
              onClick={goToCurrentWeek}
            >
              Semana atual
            </button>
          </section>

          <section className="weekly-metrics">
            <div className="metric-card">
              <span className="metric-label">TOTAL DE ATIVIDADES</span>
              <strong>{totalTasks}</strong>
              <span className="metric-caption">Nesta semana</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">CONCLUÍDAS</span>
              <strong>{completedTasks}</strong>
              <span className="metric-caption">Atividades realizadas</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">PENDENTES</span>
              <strong>{pendingTasks}</strong>
              <span className="metric-caption">Aguardando execução</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">URGENTES</span>
              <strong className={urgentTasks ? "danger-number" : ""}>
                {urgentTasks}
              </strong>
              <span className="metric-caption">Prioridade máxima</span>
            </div>
          </section>

          <section className="weekly-progress-panel">
            <div className="progress-info">
              <div>
                <span className="eyebrow">DESEMPENHO SEMANAL</span>
                <h2>Progresso da semana</h2>
                <p>
                  {completedTasks} de {totalTasks} atividades concluídas
                </p>
              </div>
              <strong className="progress-percentage">{weeklyProgress}%</strong>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${weeklyProgress}%` }}
              />
            </div>
          </section>

          {showForm && (
            <section className="task-form-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">
                    {editingId !== null ? "EDIÇÃO" : "CADASTRO"}
                  </span>
                  <h2>
                    {editingId !== null
                      ? "Editar atividade"
                      : "Adicionar ao planejamento"}
                  </h2>
                </div>

                <button
                  type="button"
                  className="close-button"
                  onClick={resetForm}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <label className="form-field field-wide">
                    <span>Nome da atividade *</span>
                    <input
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Ex.: Treino, reunião, estudar..."
                      required
                    />
                  </label>

                  <label className="form-field">
                    <span>Data *</span>
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      required
                    />
                  </label>

                  <label className="form-field">
                    <span>Horário</span>
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                    />
                  </label>

                  <label className="form-field">
                    <span>Prioridade</span>
                    <select
                      value={priority}
                      onChange={(event) =>
                        setPriority(event.target.value as Priority)
                      }
                    >
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                      <option value="Urgente">Urgente</option>
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Categoria</span>
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                    >
                      <option value="Pessoal">Pessoal</option>
                      <option value="Trabalho">Trabalho</option>
                      <option value="Saúde">Saúde</option>
                      <option value="Estudos">Estudos</option>
                      <option value="Financeiro">Financeiro</option>
                      <option value="Lazer">Lazer</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </label>

                  <label className="form-field field-wide">
                    <span>Observações</span>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Detalhes e informações adicionais..."
                      rows={3}
                    />
                  </label>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={resetForm}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="primary-button">
                    {editingId !== null
                      ? "Salvar alterações"
                      : "Adicionar atividade"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="week-board-section">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">VISÃO GERAL</span>
                <h2>Programação semanal</h2>
              </div>
              <span className="board-caption">Segunda a domingo</span>
            </div>

            {!loaded ? (
              <div className="empty-state">Carregando planejamento...</div>
            ) : (
              <div className="week-board">
                {days.map((day) => (
                  <div
                    className={`day-column ${
                      day.date === today ? "current-day" : ""
                    }`}
                    key={day.date}
                  >
                    <div className="day-column-header">
                      <div>
                        <span className="day-name">{day.name}</span>
                        <strong>{day.number.toString().padStart(2, "0")}</strong>
                        <span className="day-month">
                          {parseDate(day.date).toLocaleDateString("pt-BR", {
                            month: "short",
                          })}
                        </span>
                      </div>

                      {day.date === today && (
                        <span className="today-indicator">HOJE</span>
                      )}
                    </div>

                    <div className="day-summary">
                      <span>{day.total} atividade(s)</span>
                      <span>
                        {day.completed}/{day.total} feitas
                      </span>
                    </div>

                    <div className="day-mini-progress">
                      <div
                        style={{
                          width: `${
                            day.total
                              ? (day.completed / day.total) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    <div className="day-tasks">
                      {day.tasks.length === 0 ? (
                        <div className="no-day-tasks">Dia livre</div>
                      ) : (
                        day.tasks.map((task) => (
                          <div
                            className={`week-task ${
                              task.done ? "task-completed" : ""
                            }`}
                            key={task.id}
                          >
                            <button
                              type="button"
                              className={`task-check ${
                                task.done ? "checked" : ""
                              }`}
                              onClick={() => toggleTask(task.id)}
                              aria-label={
                                task.done
                                  ? "Marcar como pendente"
                                  : "Concluir atividade"
                              }
                            >
                              {task.done ? "✓" : ""}
                            </button>

                            <button
                              type="button"
                              className="week-task-content"
                              onClick={() => editTask(task)}
                            >
                              <strong>{task.description}</strong>
                              <span>
                                {task.time || "Sem horário"} ·{" "}
                                {task.category || "Pessoal"}
                              </span>
                            </button>

                            <span
                              className={`task-priority ${priorityClass(
                                task.priority
                              )}`}
                              title={task.priority || "Baixa"}
                            />
                          </div>
                        ))
                      )}
                    </div>

                    <button
                      type="button"
                      className="add-day-task"
                      onClick={() => openNewTask(day.date)}
                    >
                      ＋ Adicionar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="weekly-bottom-grid">
            <section className="bottom-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">DISTRIBUIÇÃO</span>
                  <h2>Atividades por dia</h2>
                </div>
              </div>

              <div className="distribution-list">
                {days.map((day) => (
                  <div className="distribution-item" key={day.date}>
                    <span className="distribution-name">
                      {day.name.replace("-feira", "")}
                    </span>
                    <div className="distribution-track">
                      <div
                        className="distribution-fill"
                        style={{
                          width: `${
                            totalTasks
                              ? (day.total / totalTasks) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <strong>{day.total}</strong>
                  </div>
                ))}
              </div>

              {busiestDay && busiestDay.total > 0 && (
                <div className="insight-message">
                  <span>MAIOR CONCENTRAÇÃO</span>
                  <strong>
                    {busiestDay.name} · {busiestDay.total} atividade(s)
                  </strong>
                </div>
              )}
            </section>

            <section className="bottom-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">PONTOS DE ATENÇÃO</span>
                  <h2>Resumo do planejamento</h2>
                </div>
              </div>

              <div className="attention-row">
                <div>
                  <span>Atividades urgentes</span>
                  <small>Precisam de prioridade</small>
                </div>
                <strong className={urgentTasks ? "danger-number" : ""}>
                  {urgentTasks}
                </strong>
              </div>

              <div className="attention-row">
                <div>
                  <span>Atividades sem data</span>
                  <small>Precisam ser organizadas</small>
                </div>
                <strong>{unplannedTasks}</strong>
              </div>

              <div className="attention-row">
                <div>
                  <span>Atividades pendentes</span>
                  <small>Ainda não concluídas nesta semana</small>
                </div>
                <strong>{pendingTasks}</strong>
              </div>

              {unplannedTasks > 0 && (
                <div className="insight-message">
                  <span>ORGANIZAÇÃO</span>
                  <strong>
                    Existem atividades sem data. Defina quando pretende
                    realizá-las.
                  </strong>
                </div>
              )}
            </section>
          </div>

          <footer className="weekly-footer">
            NEXO · GESTÃO PESSOAL
            <span>Planeje melhor. Execute com propósito.</span>
          </footer>
        </div>
      </section>

      <style jsx>{`
        .weekly-content {
          width: 100%;
          max-width: 1650px;
          margin: 0 auto;
          padding: 30px 34px 24px;
          color: #f1f1f1;
        }

        .weekly-welcome {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 25px;
        }

        .eyebrow {
          display: block;
          margin-bottom: 8px;
          color: #898989;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.7px;
        }

        .weekly-welcome h1 {
          margin: 0;
          color: #f2f2f2;
          font-size: clamp(23px, 3vw, 30px);
          font-weight: 650;
          letter-spacing: -0.8px;
        }

        .weekly-welcome p {
          margin: 9px 0 0;
          color: #909090;
          font-size: 12px;
          line-height: 1.6;
        }

        .primary-button,
        .secondary-button,
        .today-button {
          padding: 11px 16px;
          border: 1px solid transparent;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 650;
          cursor: pointer;
          transition: 0.2s;
        }

        .primary-button {
          background: #ededed;
          color: #111;
        }

        .primary-button:hover {
          background: #fff;
          transform: translateY(-1px);
        }

        .secondary-button {
          background: #252525;
          border-color: #3b3b3b;
          color: #ddd;
        }

        .today-button {
          background: transparent;
          border-color: #414141;
          color: #ddd;
        }

        .today-button:hover,
        .secondary-button:hover {
          background: #303030;
        }

        .week-selector {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 17px 20px;
          margin-bottom: 18px;
          background: #171717;
          border: 1px solid #292929;
          border-radius: 11px;
        }

        .week-selector-left {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .week-arrow {
          width: 34px;
          height: 34px;
          border: 1px solid #393939;
          border-radius: 7px;
          background: #222;
          color: #eee;
          font-size: 22px;
          cursor: pointer;
        }

        .week-arrow:hover {
          background: #333;
        }

        .week-period .eyebrow {
          margin-bottom: 5px;
        }

        .week-period h2 {
          margin: 0;
          color: #eee;
          font-size: 14px;
          font-weight: 650;
          text-transform: capitalize;
        }

        .weekly-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 17px;
        }

        .metric-card {
          display: flex;
          min-height: 105px;
          flex-direction: column;
          align-items: flex-start;
          gap: 7px;
          padding: 16px;
          background: #171717;
          border: 1px solid #292929;
          border-radius: 10px;
        }

        .metric-label {
          color: #898989;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .metric-card strong {
          color: #eee;
          font-size: 26px;
          line-height: 1;
        }

        .metric-caption {
          color: #777;
          font-size: 10px;
        }

        .danger-number {
          color: #e18b8b !important;
        }

        .weekly-progress-panel,
        .task-form-panel,
        .week-board-section,
        .bottom-panel {
          padding: 20px;
          background: #171717;
          border: 1px solid #292929;
          border-radius: 11px;
        }

        .weekly-progress-panel {
          margin-bottom: 19px;
        }

        .progress-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 15px;
        }

        .progress-info h2 {
          margin: 0;
          color: #eee;
          font-size: 15px;
        }

        .progress-info p {
          margin: 6px 0 0;
          color: #888;
          font-size: 10px;
        }

        .progress-percentage {
          color: #eee;
          font-size: 27px;
        }

        .progress-track {
          height: 6px;
          overflow: hidden;
          border-radius: 20px;
          background: #363636;
        }

        .progress-fill {
          height: 100%;
          border-radius: 20px;
          background: #bcbcbc;
          transition: width 0.3s;
        }

        .task-form-panel {
          margin-bottom: 19px;
        }

        .panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .panel-heading h2 {
          margin: 0;
          color: #eee;
          font-size: 15px;
          font-weight: 650;
        }

        .panel-heading .eyebrow {
          margin-bottom: 5px;
        }

        .close-button {
          width: 32px;
          height: 32px;
          border: 1px solid #393939;
          border-radius: 7px;
          background: transparent;
          color: #bbb;
          font-size: 22px;
          cursor: pointer;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .form-field {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 7px;
        }

        .field-wide {
          grid-column: 1 / -1;
        }

        .form-field span {
          color: #aaa;
          font-size: 10px;
          font-weight: 600;
        }

        .form-field input,
        .form-field select,
        .form-field textarea {
          width: 100%;
          min-width: 0;
          padding: 11px;
          border: 1px solid #363636;
          border-radius: 7px;
          outline: none;
          background: #202020;
          color: #eee;
          font-family: inherit;
          font-size: 11px;
          color-scheme: dark;
        }

        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus {
          border-color: #888;
        }

        .form-field textarea {
          resize: vertical;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 17px;
        }

        .week-board-section {
          margin-bottom: 18px;
        }

        .board-caption {
          color: #858585;
          font-size: 10px;
        }

        .week-board {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 9px;
        }

        .day-column {
          display: flex;
          min-width: 0;
          min-height: 245px;
          flex-direction: column;
          padding: 11px 9px;
          border: 1px solid #303030;
          border-radius: 9px;
          background: #1d1d1d;
        }

        .day-column.current-day {
          border-color: #777;
          background: #222;
        }

        .day-column-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 4px;
          min-height: 51px;
        }

        .day-column-header > div {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 3px;
        }

        .day-name {
          color: #aaa;
          font-size: 9px;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .day-column-header strong {
          color: #f1f1f1;
          font-size: 21px;
          line-height: 1;
        }

        .day-month {
          color: #777;
          font-size: 9px;
          text-transform: capitalize;
        }

        .today-indicator {
          padding: 4px 5px;
          border-radius: 4px;
          background: #373737;
          color: #ddd;
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .day-summary {
          display: flex;
          justify-content: space-between;
          gap: 4px;
          padding-top: 10px;
          margin-top: 8px;
          border-top: 1px solid #333;
          color: #898989;
          font-size: 8px;
        }

        .day-mini-progress {
          height: 3px;
          overflow: hidden;
          margin: 8px 0 10px;
          border-radius: 10px;
          background: #393939;
        }

        .day-mini-progress div {
          height: 100%;
          border-radius: 10px;
          background: #b7b7b7;
        }

        .day-tasks {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 7px;
        }

        .no-day-tasks {
          padding: 16px 3px;
          color: #696969;
          font-size: 9px;
          text-align: center;
        }

        .week-task {
          display: flex;
          min-width: 0;
          align-items: flex-start;
          gap: 5px;
          padding: 7px 5px;
          border: 1px solid #353535;
          border-radius: 6px;
          background: #242424;
        }

        .task-check {
          flex-shrink: 0;
          width: 14px;
          height: 14px;
          margin-top: 2px;
          border: 1px solid #777;
          border-radius: 4px;
          background: transparent;
          color: #111;
          font-size: 9px;
          cursor: pointer;
        }

        .task-check.checked {
          border-color: #d0d0d0;
          background: #d0d0d0;
        }

        .week-task-content {
          display: flex;
          flex: 1;
          min-width: 0;
          flex-direction: column;
          gap: 4px;
          padding: 0;
          border: 0;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .week-task-content strong {
          color: #ddd;
          font-size: 9px;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .week-task-content span {
          color: #888;
          font-size: 8px;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .task-priority {
          flex-shrink: 0;
          width: 6px;
          height: 6px;
          margin-top: 4px;
          border-radius: 50%;
          background: #777;
        }

        .task-priority.low {
          background: #8c8c8c;
        }

        .task-priority.medium {
          background: #c6b17b;
        }

        .task-priority.high {
          background: #d98e74;
        }

        .task-priority.urgent {
          background: #e07878;
        }

        .task-completed .week-task-content strong {
          color: #888;
          text-decoration: line-through;
        }

        .add-day-task {
          width: 100%;
          padding: 9px 3px 2px;
          margin-top: 9px;
          border: 0;
          border-top: 1px solid #353535;
          background: transparent;
          color: #aaa;
          font-size: 9px;
          cursor: pointer;
        }

        .add-day-task:hover {
          color: #fff;
        }

        .weekly-bottom-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .bottom-panel {
          min-width: 0;
        }

        .distribution-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .distribution-item {
          display: grid;
          grid-template-columns: 85px minmax(0, 1fr) 20px;
          align-items: center;
          gap: 10px;
        }

        .distribution-name {
          color: #aaa;
          font-size: 10px;
          text-transform: capitalize;
        }

        .distribution-track {
          height: 5px;
          overflow: hidden;
          border-radius: 10px;
          background: #383838;
        }

        .distribution-fill {
          height: 100%;
          border-radius: 10px;
          background: #aaa;
        }

        .distribution-item strong {
          color: #ddd;
          font-size: 10px;
          text-align: right;
        }

        .insight-message {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 11px;
          margin-top: 18px;
          border: 1px solid #363636;
          border-radius: 7px;
          background: #202020;
        }

        .insight-message span {
          color: #858585;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .insight-message strong {
          color: #ccc;
          font-size: 10px;
          line-height: 1.5;
        }

        .attention-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 13px 0;
          border-bottom: 1px solid #303030;
        }

        .attention-row:last-of-type {
          border-bottom: 0;
        }

        .attention-row div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .attention-row span {
          color: #ccc;
          font-size: 10px;
        }

        .attention-row small {
          color: #777;
          font-size: 9px;
        }

        .attention-row strong {
          color: #eee;
          font-size: 16px;
        }

        .weekly-footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding-top: 19px;
          margin-top: 24px;
          border-top: 1px solid #292929;
          color: #777;
          font-size: 9px;
          font-weight: 650;
          letter-spacing: 1px;
        }

        .weekly-footer span {
          font-weight: 400;
          letter-spacing: 0;
        }

        .empty-state {
          padding: 30px;
          color: #888;
          text-align: center;
          font-size: 12px;
        }

        @media (max-width: 1250px) {
          .week-board {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 850px) {
          .week-board {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .weekly-bottom-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (max-width: 700px) {
          .weekly-content {
            padding: 22px 15px;
          }

          .weekly-welcome {
            align-items: flex-start;
            flex-direction: column;
          }

          .weekly-welcome .primary-button {
            width: 100%;
          }

          .weekly-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .week-selector {
            align-items: flex-start;
            flex-direction: column;
          }

          .week-selector-left {
            width: 100%;
            justify-content: space-between;
          }

          .week-period h2 {
            font-size: 12px;
          }

          .week-board {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .day-column {
            min-height: 210px;
          }

          .form-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .field-wide {
            grid-column: auto;
          }

          .form-actions {
            flex-direction: column-reverse;
          }

          .form-actions button {
            width: 100%;
          }

          .weekly-footer {
            flex-direction: column;
          }
        }

        @media (max-width: 380px) {
          .week-board {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </main>
  );
}

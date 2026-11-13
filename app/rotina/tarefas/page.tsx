
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

type Filter = "Todas" | "Hoje" | "Pendentes" | "Concluídas" | "Atrasadas";

const TASKS_KEY = "nexo_tasks";

const CATEGORIES = [
  "Trabalho",
  "Pessoal",
  "Financeiro",
  "Saúde",
  "Estudos",
  "Outros",
];

const PRIORITIES: Priority[] = ["Baixa", "Média", "Alta", "Urgente"];

function getLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value?: string) {
  if (!value) return "Sem data";

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

function isValidTaskArray(value: unknown): value is Task[] {
  return (
    Array.isArray(value) &&
    value.every(
      (task) =>
        task &&
        typeof task.id === "number" &&
        typeof task.description === "string" &&
        typeof task.done === "boolean"
    )
  );
}

function loadTasks(): Task[] {
  try {
    const saved = localStorage.getItem(TASKS_KEY);

    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);

    return isValidTaskArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function priorityClass(priority?: Priority) {
  switch (priority) {
    case "Urgente":
      return "priority-urgent";
    case "Alta":
      return "priority-high";
    case "Média":
      return "priority-medium";
    default:
      return "priority-low";
  }
}

export default function TarefasPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [filter, setFilter] = useState<Filter>("Todas");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [priorityFilter, setPriorityFilter] = useState("Todas");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getLocalDate());
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState<Priority>("Média");
  const [category, setCategory] = useState("Pessoal");
  const [notes, setNotes] = useState("");

  const [expandedTask, setExpandedTask] = useState<number | null>(null);

  const loadData = useCallback(() => {
    setTasks(loadTasks());
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadData();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === TASKS_KEY) {
        loadData();
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadData]);

  useEffect(() => {
    if (!loaded) return;

    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error("Erro ao salvar tarefas:", error);
    }
  }, [tasks, loaded]);

  const today = getLocalDate();

  const metrics = useMemo(() => {
    const completed = tasks.filter((task) => task.done).length;
    const pending = tasks.filter((task) => !task.done).length;

    const overdue = tasks.filter(
      (task) => !task.done && task.date && task.date < today
    ).length;

    const todayTasks = tasks.filter((task) => task.date === today);

    const percentage =
      tasks.length > 0
        ? Math.round((completed / tasks.length) * 100)
        : 0;

    return {
      total: tasks.length,
      completed,
      pending,
      overdue,
      today: todayTasks.length,
      percentage,
    };
  }, [tasks, today]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (filter === "Hoje" && task.date !== today) return false;

        if (filter === "Pendentes" && task.done) return false;

        if (filter === "Concluídas" && !task.done) return false;

        if (
          filter === "Atrasadas" &&
          (task.done || !task.date || task.date >= today)
        ) {
          return false;
        }

        if (
          categoryFilter !== "Todas" &&
          task.category !== categoryFilter
        ) {
          return false;
        }

        if (
          priorityFilter !== "Todas" &&
          task.priority !== priorityFilter
        ) {
          return false;
        }

        if (
          search.trim() &&
          !task.description
            .toLowerCase()
            .includes(search.trim().toLowerCase()) &&
          !(task.notes || "")
            .toLowerCase()
            .includes(search.trim().toLowerCase())
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;

        const dateA = a.date || "9999-12-31";
        const dateB = b.date || "9999-12-31";

        if (dateA !== dateB) return dateA.localeCompare(dateB);

        const priorityOrder: Record<Priority, number> = {
          Urgente: 0,
          Alta: 1,
          Média: 2,
          Baixa: 3,
        };

        return (
          priorityOrder[a.priority || "Média"] -
          priorityOrder[b.priority || "Média"]
        );
      });
  }, [
    tasks,
    filter,
    categoryFilter,
    priorityFilter,
    search,
    today,
  ]);

  const resetForm = () => {
    setDescription("");
    setDate(getLocalDate());
    setTime("");
    setPriority("Média");
    setCategory("Pessoal");
    setNotes("");
    setEditingId(null);
    setShowForm(false);
  };

  const openNewTask = () => {
    resetForm();
    setShowForm(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!description.trim()) return;

    if (editingId !== null) {
      setTasks((current) =>
        current.map((task) =>
          task.id === editingId
            ? {
                ...task,
                description: description.trim(),
                date: date || undefined,
                time: time || undefined,
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
        date: date || undefined,
        time: time || undefined,
        priority,
        category,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      };

      setTasks((current) => [...current, newTask]);
    }

    resetForm();
  };

  const editTask = (task: Task) => {
    setEditingId(task.id);
    setDescription(task.description);
    setDate(task.date || "");
    setTime(task.time || "");
    setPriority(task.priority || "Média");
    setCategory(task.category || "Pessoal");
    setNotes(task.notes || "");
    setShowForm(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleTask = (id: number) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task
      )
    );
  };

  const deleteTask = (id: number) => {
    const confirmed = window.confirm(
      "Tem certeza que deseja excluir esta tarefa?"
    );

    if (!confirmed) return;

    setTasks((current) => current.filter((task) => task.id !== id));

    if (expandedTask === id) {
      setExpandedTask(null);
    }
  };

  const filters: Filter[] = [
    "Todas",
    "Hoje",
    "Pendentes",
    "Concluídas",
    "Atrasadas",
  ];

  return (
    <main className="app-shell">
      <MainNavigation />

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Minha rotina <span>/</span> <strong>Tarefas</strong>
          </div>

          <div className="topbar-right">
            <span className="topbar-date">
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>

            <div className="profile-avatar">N</div>
          </div>
        </header>

        <div className="content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">ORGANIZAÇÃO PESSOAL</div>
              <h1>Minhas tarefas</h1>
              <p>
                Organize suas atividades, acompanhe prioridades e mantenha
                sua rotina sob controle.
              </p>
            </div>

            <button className="primary-button" onClick={openNewTask}>
              <span>＋</span> Nova tarefa
            </button>
          </section>

          <section className="metrics-grid">
            <div className="metric-card">
              <div className="metric-top">
                <span className="metric-label">Total de tarefas</span>
                <span className="metric-icon">▤</span>
              </div>
              <div className="metric-value">{metrics.total}</div>
              <div className="metric-description">Atividades cadastradas</div>
            </div>

            <div className="metric-card">
              <div className="metric-top">
                <span className="metric-label">Pendentes</span>
                <span className="metric-icon">◷</span>
              </div>
              <div className="metric-value">{metrics.pending}</div>
              <div className="metric-description">Aguardando conclusão</div>
            </div>

            <div className="metric-card">
              <div className="metric-top">
                <span className="metric-label">Concluídas</span>
                <span className="metric-icon">✓</span>
              </div>
              <div className="metric-value">{metrics.completed}</div>
              <div className="metric-description">Atividades finalizadas</div>
            </div>

            <div className="metric-card">
              <div className="metric-top">
                <span className="metric-label">Atrasadas</span>
                <span className="metric-icon">!</span>
              </div>
              <div className="metric-value overdue-value">
                {metrics.overdue}
              </div>
              <div className="metric-description">Precisam de atenção</div>
            </div>
          </section>

          <section className="progress-section">
            <div className="progress-info">
              <div>
                <span className="section-label">SEU DESEMPENHO</span>
                <h2>Progresso geral</h2>
                <p>
                  Você concluiu {metrics.completed} de {metrics.total} tarefas.
                </p>
              </div>

              <div className="progress-percentage">
                {metrics.percentage}%
              </div>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${metrics.percentage}%` }}
              />
            </div>

            <div className="progress-footer">
              <span>{metrics.completed} concluídas</span>
              <span>{metrics.pending} pendentes</span>
            </div>
          </section>

          {showForm && (
            <section className="form-card" id="task-form">
              <div className="form-heading">
                <div>
                  <span className="section-label">
                    {editingId !== null ? "EDIÇÃO" : "NOVO REGISTRO"}
                  </span>
                  <h2>
                    {editingId !== null
                      ? "Editar tarefa"
                      : "Cadastrar tarefa"}
                  </h2>
                </div>

                <button
                  className="close-button"
                  onClick={resetForm}
                  type="button"
                  aria-label="Fechar formulário"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-field full-field">
                  <label>Descrição da tarefa *</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Ex.: Finalizar relatório financeiro"
                    required
                    autoFocus
                  />
                </div>

                <div className="form-grid">
                  <div className="form-field">
                    <label>Data prevista</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label>Horário</label>
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label>Prioridade</label>
                    <select
                      value={priority}
                      onChange={(event) =>
                        setPriority(event.target.value as Priority)
                      }
                    >
                      {PRIORITIES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Categoria</label>
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                    >
                      {CATEGORIES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-field full-field">
                  <label>Observações</label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Adicione detalhes ou informações importantes..."
                    rows={3}
                  />
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
                      : "Cadastrar tarefa"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="tasks-section">
            <div className="tasks-heading">
              <div>
                <span className="section-label">GERENCIAMENTO</span>
                <h2>Lista de tarefas</h2>
                <p>
                  Visualize, filtre e gerencie todas as suas atividades.
                </p>
              </div>

              <div className="task-count">
                {filteredTasks.length}{" "}
                {filteredTasks.length === 1 ? "tarefa" : "tarefas"}
              </div>
            </div>

            <div className="search-container">
              <span className="search-icon">⌕</span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar tarefa ou observação..."
              />

              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="clear-search"
                  type="button"
                >
                  ×
                </button>
              )}
            </div>

            <div className="filters-row">
              <div className="filter-tabs">
                {filters.map((item) => (
                  <button
                    key={item}
                    className={`filter-tab ${
                      filter === item ? "selected" : ""
                    }`}
                    onClick={() => setFilter(item)}
                    type="button"
                  >
                    {item}

                    {item === "Atrasadas" && metrics.overdue > 0 && (
                      <span className="filter-number">
                        {metrics.overdue}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="select-filters">
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="Todas">Todas as categorias</option>
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value)}
                >
                  <option value="Todas">Todas as prioridades</option>
                  {PRIORITIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="task-list">
              {!loaded ? (
                <div className="empty-state">
                  <div className="empty-icon">◷</div>
                  <h3>Carregando tarefas...</h3>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">▤</div>
                  <h3>Nenhuma tarefa encontrada</h3>
                  <p>
                    Não existem tarefas para os filtros selecionados.
                    Cadastre uma nova atividade ou altere os filtros.
                  </p>

                  <button
                    className="secondary-button"
                    onClick={() => {
                      setFilter("Todas");
                      setCategoryFilter("Todas");
                      setPriorityFilter("Todas");
                      setSearch("");
                    }}
                    type="button"
                  >
                    Limpar filtros
                  </button>
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const overdue =
                    !task.done && !!task.date && task.date < today;

                  const expanded = expandedTask === task.id;

                  return (
                    <article
                      className={`task-item ${
                        task.done ? "task-completed" : ""
                      }`}
                      key={task.id}
                    >
                      <div className="task-main">
                        <button
                          className={`task-checkbox ${
                            task.done ? "checked" : ""
                          }`}
                          onClick={() => toggleTask(task.id)}
                          aria-label={
                            task.done
                              ? "Reabrir tarefa"
                              : "Concluir tarefa"
                          }
                          type="button"
                        >
                          {task.done ? "✓" : ""}
                        </button>

                        <div className="task-content">
                          <div className="task-title-row">
                            <h3>{task.description}</h3>

                            {overdue && (
                              <span className="overdue-tag">Atrasada</span>
                            )}
                          </div>

                          <div className="task-meta">
                            <span>{task.category || "Pessoal"}</span>
                            <span className="meta-separator">•</span>
                            <span>{formatDate(task.date)}</span>

                            {task.time && (
                              <>
                                <span className="meta-separator">•</span>
                                <span>{task.time}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="task-actions">
                          <span
                            className={`priority-badge ${priorityClass(
                              task.priority
                            )}`}
                          >
                            {task.priority || "Média"}
                          </span>

                          <button
                            className="icon-action"
                            onClick={() =>
                              setExpandedTask(expanded ? null : task.id)
                            }
                            title="Mais opções"
                            type="button"
                          >
                            ⋯
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="task-details">
                          {task.notes ? (
                            <p>{task.notes}</p>
                          ) : (
                            <p className="no-notes">
                              Nenhuma observação adicionada.
                            </p>
                          )}

                          <div className="task-detail-actions">
                            <button
                              onClick={() => editTask(task)}
                              type="button"
                            >
                              ✎ Editar
                            </button>

                            <button
                              onClick={() => toggleTask(task.id)}
                              type="button"
                            >
                              {task.done ? "↺ Reabrir" : "✓ Concluir"}
                            </button>

                            <button
                              className="delete-action"
                              onClick={() => deleteTask(task.id)}
                              type="button"
                            >
                              × Excluir
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <footer className="page-footer">
            <span>NEXO · GESTÃO PESSOAL</span>
            <span>Organização que gera resultados.</span>
          </footer>
        </div>
      </section>

      <style jsx>{`
        .main-area {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .topbar {
          min-height: 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 38px;
          border-bottom: 1px solid #22272d;
          background: #0e1115;
        }

        .breadcrumb {
          color: #858d98;
          font-size: 12px;
        }

        .breadcrumb span {
          margin: 0 9px;
          color: #515965;
        }

        .breadcrumb strong {
          color: #e8e9ec;
          font-weight: 600;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .topbar-date {
          color: #89919c;
          font-size: 11px;
          text-transform: capitalize;
        }

        .profile-avatar {
          width: 33px;
          height: 33px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #252b33;
          border: 1px solid #414954;
          color: #f0f1f3;
          font-size: 13px;
          font-weight: 700;
        }

        .content {
          width: 100%;
          max-width: 1450px;
          padding: 34px 38px 28px;
          margin: 0 auto;
        }

        button {
          font-family: inherit;
          cursor: pointer;
        }

        .page-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 28px;
        }

        .eyebrow,
        .section-label {
          color: #777f8b;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 1.5px;
        }

        .eyebrow {
          margin-bottom: 9px;
        }

        .page-heading h1 {
          margin: 0;
          color: #f0f1f3;
          font-size: 27px;
          font-weight: 650;
          letter-spacing: -0.7px;
        }

        .page-heading p,
        .tasks-heading p {
          margin: 8px 0 0;
          color: #858d98;
          font-size: 12px;
          line-height: 1.6;
        }

        .primary-button {
          min-height: 39px;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #e5e7eb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          color: #15181c;
          font-size: 11px;
          font-weight: 750;
          transition: 0.2s;
        }

        .primary-button:hover {
          background: #fff;
          border-color: #fff;
        }

        .primary-button span {
          font-size: 17px;
          line-height: 1;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-bottom: 18px;
        }

        .metric-card {
          min-height: 120px;
          padding: 18px;
          background: #12161b;
          border: 1px solid #252b33;
          border-radius: 8px;
        }

        .metric-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .metric-label {
          color: #a0a7b1;
          font-size: 11px;
        }

        .metric-icon {
          width: 27px;
          height: 27px;
          display: grid;
          place-items: center;
          background: #20262e;
          border-radius: 6px;
          color: #c3c9d1;
          font-size: 14px;
        }

        .metric-value {
          margin-top: 12px;
          color: #f2f3f5;
          font-size: 25px;
          font-weight: 650;
        }

        .overdue-value {
          color: #e38b83;
        }

        .metric-description {
          margin-top: 3px;
          color: #727b87;
          font-size: 10px;
        }

        .progress-section {
          padding: 21px 22px;
          margin-bottom: 22px;
          background: #12161b;
          border: 1px solid #252b33;
          border-radius: 8px;
        }

        .progress-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .progress-info h2,
        .tasks-heading h2,
        .form-heading h2 {
          margin: 7px 0 0;
          color: #e9ebee;
          font-size: 15px;
          font-weight: 650;
        }

        .progress-info p {
          margin: 5px 0 0;
          color: #858d98;
          font-size: 11px;
        }

        .progress-percentage {
          color: #e8e9ec;
          font-size: 23px;
          font-weight: 650;
        }

        .progress-track {
          height: 6px;
          margin-top: 19px;
          overflow: hidden;
          background: #292f37;
          border-radius: 10px;
        }

        .progress-fill {
          height: 100%;
          background: #aeb6c1;
          border-radius: 10px;
          transition: width 0.3s;
        }

        .progress-footer {
          display: flex;
          justify-content: space-between;
          margin-top: 9px;
          color: #7d8691;
          font-size: 10px;
        }

        .form-card {
          padding: 23px;
          margin-bottom: 22px;
          background: #12161b;
          border: 1px solid #343c46;
          border-radius: 8px;
          animation: formAppear 0.2s ease;
        }

        @keyframes formAppear {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .form-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 22px;
        }

        .close-button {
          width: 30px;
          height: 30px;
          border: 1px solid #333a44;
          border-radius: 6px;
          background: #1a2027;
          color: #aab1bb;
          font-size: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-top: 15px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .full-field {
          margin-top: 15px;
        }

        .form-field label {
          color: #aeb5bf;
          font-size: 11px;
          font-weight: 550;
        }

        .form-field input,
        .form-field select,
        .form-field textarea,
        .select-filters select {
          width: 100%;
          min-height: 39px;
          padding: 0 11px;
          background: #0e1216;
          border: 1px solid #303741;
          border-radius: 5px;
          color: #e6e8eb;
          font-family: inherit;
          font-size: 11px;
          outline: none;
        }

        .form-field textarea {
          min-height: 75px;
          padding: 11px;
          resize: vertical;
        }

        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus,
        .select-filters select:focus,
        .search-container input:focus {
          border-color: #727e8c;
        }

        .form-field input::-webkit-calendar-picker-indicator {
          filter: invert(0.8);
          cursor: pointer;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 20px;
        }

        .secondary-button {
          min-height: 37px;
          padding: 0 14px;
          border: 1px solid #343c46;
          border-radius: 5px;
          background: #1b2027;
          color: #c3c9d1;
          font-size: 11px;
          font-weight: 600;
        }

        .secondary-button:hover {
          background: #252c35;
        }

        .tasks-section {
          padding: 23px;
          background: #12161b;
          border: 1px solid #252b33;
          border-radius: 8px;
        }

        .tasks-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 20px;
        }

        .task-count {
          padding: 7px 10px;
          background: #20262e;
          border: 1px solid #303741;
          border-radius: 5px;
          color: #b7bec8;
          font-size: 10px;
        }

        .search-container {
          position: relative;
          display: flex;
          align-items: center;
          margin-bottom: 17px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          color: #8d96a2;
          font-size: 20px;
        }

        .search-container input {
          width: 100%;
          height: 40px;
          padding: 0 38px;
          background: #0e1216;
          border: 1px solid #303741;
          border-radius: 5px;
          color: #e6e8eb;
          font-size: 11px;
          outline: none;
        }

        .search-container input::placeholder {
          color: #626c78;
        }

        .clear-search {
          position: absolute;
          right: 10px;
          background: transparent;
          border: 0;
          color: #aab1bb;
          font-size: 18px;
        }

        .filters-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          flex-wrap: wrap;
          padding-bottom: 15px;
          border-bottom: 1px solid #272e36;
        }

        .filter-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .filter-tab {
          min-height: 31px;
          padding: 0 10px;
          border: 1px solid transparent;
          border-radius: 5px;
          background: transparent;
          color: #8f98a4;
          font-size: 10px;
          transition: 0.2s;
        }

        .filter-tab:hover {
          color: #e5e8ec;
          background: #20262e;
        }

        .filter-tab.selected {
          background: #282f38;
          border-color: #3c4652;
          color: #f0f1f3;
        }

        .filter-number {
          margin-left: 5px;
          color: #e18e85;
          font-weight: 700;
        }

        .select-filters {
          display: flex;
          gap: 8px;
        }

        .select-filters select {
          width: auto;
          min-width: 135px;
          min-height: 32px;
          color: #aeb5bf;
          font-size: 10px;
        }

        .task-list {
          display: flex;
          flex-direction: column;
        }

        .task-item {
          border-bottom: 1px solid #272e36;
        }

        .task-item:last-child {
          border-bottom: 0;
        }

        .task-main {
          min-height: 76px;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 12px 2px;
        }

        .task-checkbox {
          width: 19px;
          height: 19px;
          min-width: 19px;
          display: grid;
          place-items: center;
          border: 1px solid #59636f;
          border-radius: 5px;
          background: transparent;
          color: #11151a;
          font-size: 12px;
          font-weight: 800;
        }

        .task-checkbox:hover {
          border-color: #c1c8d0;
        }

        .task-checkbox.checked {
          background: #aeb8c4;
          border-color: #aeb8c4;
        }

        .task-content {
          flex: 1;
          min-width: 0;
        }

        .task-title-row {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-wrap: wrap;
        }

        .task-title-row h3 {
          margin: 0;
          color: #e2e5e9;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .task-completed .task-title-row h3 {
          color: #737c87;
          text-decoration: line-through;
        }

        .task-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 7px;
          color: #818b97;
          font-size: 10px;
        }

        .meta-separator {
          color: #4f5965;
        }

        .task-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .priority-badge {
          padding: 5px 8px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 650;
          white-space: nowrap;
        }

        .priority-urgent {
          background: #472a2b;
          color: #efaaa4;
        }

        .priority-high {
          background: #42342a;
          color: #e8b88c;
        }

        .priority-medium {
          background: #333943;
          color: #c4ccd6;
        }

        .priority-low {
          background: #25372f;
          color: #a2cbb1;
        }

        .overdue-tag {
          padding: 4px 7px;
          border-radius: 4px;
          background: #452829;
          color: #e99a92;
          font-size: 9px;
          font-weight: 650;
        }

        .icon-action {
          width: 29px;
          height: 29px;
          border: 1px solid transparent;
          border-radius: 5px;
          background: transparent;
          color: #a0a8b3;
          font-size: 19px;
        }

        .icon-action:hover {
          background: #252c34;
          border-color: #39424e;
        }

        .task-details {
          padding: 12px 15px 15px 34px;
          background: #0e1216;
          border-top: 1px solid #242b33;
        }

        .task-details p {
          margin: 0 0 13px;
          color: #a2aab4;
          font-size: 11px;
          line-height: 1.7;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .task-details p.no-notes {
          color: #69727d;
          font-style: italic;
        }

        .task-detail-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .task-detail-actions button {
          padding: 6px 9px;
          border: 1px solid #343c46;
          border-radius: 4px;
          background: #1a2027;
          color: #c4cbd4;
          font-size: 10px;
        }

        .task-detail-actions button:hover {
          background: #29313b;
        }

        .task-detail-actions .delete-action {
          color: #e19a94;
          border-color: #553536;
        }

        .empty-state {
          padding: 55px 20px;
          text-align: center;
        }

        .empty-icon {
          width: 45px;
          height: 45px;
          display: grid;
          place-items: center;
          margin: 0 auto 15px;
          border: 1px solid #333c47;
          border-radius: 12px;
          background: #1b222a;
          color: #9ca6b2;
          font-size: 21px;
        }

        .empty-state h3 {
          margin: 0;
          color: #e3e6ea;
          font-size: 13px;
        }

        .empty-state p {
          max-width: 370px;
          margin: 8px auto 16px;
          color: #818b97;
          font-size: 11px;
          line-height: 1.6;
        }

        .page-footer {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding-top: 22px;
          color: #626b77;
          font-size: 9px;
          letter-spacing: 0.7px;
        }

        @media (max-width: 1100px) {
          .content {
            padding: 28px 24px;
          }

          .form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .metrics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .topbar {
            min-height: 56px;
            padding: 0 17px;
          }

          .topbar-date {
            display: none;
          }

          .content {
            padding: 25px 16px;
          }

          .page-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .metrics-grid {
            gap: 9px;
          }

          .metric-card {
            padding: 14px;
          }

          .filters-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .select-filters {
            width: 100%;
          }

          .select-filters select {
            flex: 1;
            min-width: 0;
          }

          .tasks-section {
            padding: 16px;
          }

          .task-main {
            gap: 9px;
          }

          .task-actions {
            gap: 5px;
          }

          .priority-badge {
            font-size: 8px;
            padding: 4px 6px;
          }

          .page-footer {
            flex-direction: column;
          }
        }

        @media (max-width: 480px) {
          .page-heading h1 {
            font-size: 23px;
          }

          .metric-card {
            min-height: 105px;
          }

          .metric-value {
            font-size: 22px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .task-meta {
            gap: 5px;
          }

          .task-main {
            align-items: flex-start;
            padding: 15px 0;
          }

          .task-checkbox {
            margin-top: 2px;
          }

          .task-actions {
            flex-direction: column;
            align-items: flex-end;
          }

          .tasks-heading {
            align-items: flex-start;
          }

          .task-details {
            padding-left: 12px;
          }
        }
      `}</style>
    </main>
  );
}


"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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

function getLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(date: string) {
  if (!date) return "Sem data";

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function formatLongDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);

  return parsed.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function isValidTaskArray(value: unknown): value is Task[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item.id === "number" &&
        typeof item.description === "string" &&
        typeof item.done === "boolean"
    )
  );
}

function loadTasks(): Task[] {
  try {
    const stored = localStorage.getItem(TASKS_KEY);

    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);

    return isValidTaskArray(parsed) ? parsed : [];
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

export default function AgendaPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [selectedDate, setSelectedDate] = useState(getLocalDate());

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getLocalDate());
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState<Priority>("Média");
  const [category, setCategory] = useState("Pessoal");
  const [notes, setNotes] = useState("");

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
      console.error("Não foi possível salvar as tarefas:", error);
    }
  }, [tasks, loaded]);

  const selectedTasks = useMemo(() => {
    return tasks
      .filter((task) => task.date === selectedDate)
      .sort((a, b) => {
        if (!a.time && !b.time) return 0;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      });
  }, [tasks, selectedDate]);

  const completedTasks = selectedTasks.filter((task) => task.done);
  const pendingTasks = selectedTasks.filter((task) => !task.done);

  const progress = selectedTasks.length
    ? Math.round((completedTasks.length / selectedTasks.length) * 100)
    : 0;

  const today = getLocalDate();

  const overdueTasks = useMemo(
    () => tasks.filter((task) => task.date && task.date < today && !task.done),
    [tasks, today]
  );

  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter(
          (task) =>
            task.date &&
            task.date > selectedDate &&
            !task.done
        )
        .sort((a, b) => {
          const dateComparison = (a.date || "").localeCompare(b.date || "");

          if (dateComparison !== 0) return dateComparison;

          return (a.time || "99:99").localeCompare(b.time || "99:99");
        })
        .slice(0, 5),
    [tasks, selectedDate]
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  function resetForm() {
    setDescription("");
    setDate(selectedDate);
    setTime("");
    setPriority("Média");
    setCategory("Pessoal");
    setNotes("");
    setEditingId(null);
    setShowForm(false);
  }

  function openNewTask() {
    setDescription("");
    setDate(selectedDate);
    setTime("");
    setPriority("Média");
    setCategory("Pessoal");
    setNotes("");
    setEditingId(null);
    setShowForm(true);
  }

  function editTask(task: Task) {
    setEditingId(task.id);
    setDescription(task.description);
    setDate(task.date || selectedDate);
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
    const confirmed = window.confirm(
      "Deseja realmente excluir esta atividade?"
    );

    if (!confirmed) return;

    setTasks((current) => current.filter((task) => task.id !== id));

    if (editingId === id) {
      resetForm();
    }
  }

  function changeDay(amount: number) {
    const current = new Date(`${selectedDate}T12:00:00`);
    current.setDate(current.getDate() + amount);
    setSelectedDate(getLocalDate(current));
  }

  function goToToday() {
    setSelectedDate(getLocalDate());
  }

  return (
    <div className="content agenda-content">
      <section className="agenda-welcome">
        <div>
          <span className="eyebrow">ORGANIZAÇÃO PESSOAL</span>
          <h1>{greeting}, organize seu dia.</h1>
          <p>
            Visualize seus compromissos, organize seus horários e acompanhe
            suas atividades.
          </p>
        </div>

        <button className="primary-button" onClick={openNewTask}>
          <span>＋</span> Nova atividade
        </button>
      </section>

      <section className="agenda-date-panel">
        <div className="date-navigation">
          <button
            type="button"
            className="date-arrow"
            onClick={() => changeDay(-1)}
            aria-label="Dia anterior"
          >
            ‹
          </button>

          <div className="selected-date">
            <span className="selected-date-day">
              {formatLongDate(selectedDate)}
            </span>
            <span className="selected-date-number">
              {formatDate(selectedDate)}
            </span>
          </div>

          <button
            type="button"
            className="date-arrow"
            onClick={() => changeDay(1)}
            aria-label="Próximo dia"
          >
            ›
          </button>
        </div>

        <button className="today-button" onClick={goToToday}>
          Ir para hoje
        </button>
      </section>

      <section className="agenda-metrics">
        <div className="agenda-metric-card">
          <span className="metric-label">ATIVIDADES DO DIA</span>
          <strong>{selectedTasks.length}</strong>
          <span className="metric-description">Total programado</span>
        </div>

        <div className="agenda-metric-card">
          <span className="metric-label">PENDENTES</span>
          <strong>{pendingTasks.length}</strong>
          <span className="metric-description">Aguardando conclusão</span>
        </div>

        <div className="agenda-metric-card">
          <span className="metric-label">CONCLUÍDAS</span>
          <strong>{completedTasks.length}</strong>
          <span className="metric-description">Atividades realizadas</span>
        </div>

        <div className="agenda-metric-card">
          <span className="metric-label">ATRASADAS</span>
          <strong className={overdueTasks.length ? "metric-danger" : ""}>
            {overdueTasks.length}
          </strong>
          <span className="metric-description">Precisam de atenção</span>
        </div>
      </section>

      {showForm && (
        <section className="agenda-form-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                {editingId !== null ? "EDIÇÃO" : "CADASTRO"}
              </span>
              <h2>
                {editingId !== null
                  ? "Editar atividade"
                  : "Nova atividade"}
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
                  placeholder="Ex.: Reunião, academia, estudar..."
                  required
                />
              </label>

              <label className="form-field">
                <span>Data</span>
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
                  placeholder="Adicione detalhes sobre esta atividade..."
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
                  : "Cadastrar atividade"}
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="agenda-layout">
        <section className="agenda-main-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">PROGRAMAÇÃO</span>
              <h2>Atividades do dia</h2>
            </div>
            <span className="task-counter">
              {selectedTasks.length} atividade(s)
            </span>
          </div>

          <div className="day-progress">
            <div className="day-progress-heading">
              <span>Progresso diário</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {!loaded ? (
            <div className="empty-state">Carregando atividades...</div>
          ) : selectedTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">▦</div>
              <h3>Nenhuma atividade programada</h3>
              <p>
                Você ainda não cadastrou atividades para este dia.
              </p>
              <button className="primary-button" onClick={openNewTask}>
                ＋ Adicionar atividade
              </button>
            </div>
          ) : (
            <div className="timeline">
              {selectedTasks.map((task) => (
                <div
                  className={`timeline-item ${task.done ? "completed" : ""}`}
                  key={task.id}
                >
                  <div className="timeline-time">
                    {task.time || "--:--"}
                  </div>

                  <div className="timeline-marker">
                    <span />
                  </div>

                  <div className="timeline-card">
                    <div className="timeline-card-top">
                      <div className="task-title-area">
                        <button
                          type="button"
                          className={`task-check ${task.done ? "checked" : ""}`}
                          onClick={() => toggleTask(task.id)}
                          aria-label={
                            task.done
                              ? "Marcar como pendente"
                              : "Concluir atividade"
                          }
                        >
                          {task.done ? "✓" : ""}
                        </button>

                        <div>
                          <h3>{task.description}</h3>
                          <span className="task-category">
                            {task.category || "Pessoal"}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`priority-badge ${priorityClass(
                          task.priority
                        )}`}
                      >
                        {task.priority || "Baixa"}
                      </span>
                    </div>

                    {task.notes && (
                      <p className="task-notes">{task.notes}</p>
                    )}

                    <div className="task-actions">
                      <span
                        className={
                          task.done ? "done-label" : "waiting-label"
                        }
                      >
                        {task.done ? "Concluída" : "Pendente"}
                      </span>

                      <div>
                        <button
                          type="button"
                          onClick={() => editTask(task)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="delete-action"
                          onClick={() => deleteTask(task.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="agenda-side-column">
          <section className="side-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">PRÓXIMOS DIAS</span>
                <h2>Próximas atividades</h2>
              </div>
            </div>

            {upcomingTasks.length === 0 ? (
              <p className="side-empty">
                Nenhuma atividade futura pendente.
              </p>
            ) : (
              <div className="upcoming-list">
                {upcomingTasks.map((task) => (
                  <button
                    type="button"
                    className="upcoming-item"
                    key={task.id}
                    onClick={() => {
                      if (task.date) setSelectedDate(task.date);
                    }}
                  >
                    <div className="upcoming-date">
                      <strong>
                        {task.date ? task.date.slice(8, 10) : "--"}
                      </strong>
                      <span>
                        {task.date
                          ? new Date(
                              `${task.date}T12:00:00`
                            ).toLocaleDateString("pt-BR", {
                              month: "short",
                            })
                          : ""}
                      </span>
                    </div>
                    <div className="upcoming-info">
                      <strong>{task.description}</strong>
                      <span>
                        {task.time || "Sem horário"} ·{" "}
                        {task.category || "Pessoal"}
                      </span>
                    </div>
                    <span className="upcoming-arrow">›</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="side-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">ACOMPANHAMENTO</span>
                <h2>Resumo do dia</h2>
              </div>
            </div>

            <div className="summary-row">
              <span>Concluídas</span>
              <strong>{completedTasks.length}</strong>
            </div>
            <div className="summary-row">
              <span>Pendentes</span>
              <strong>{pendingTasks.length}</strong>
            </div>
            <div className="summary-row">
              <span>Total de atividades</span>
              <strong>{selectedTasks.length}</strong>
            </div>

            <div className="summary-message">
              {selectedTasks.length === 0
                ? "Comece organizando suas atividades para este dia."
                : progress === 100
                ? "Excelente! Todas as atividades deste dia foram concluídas."
                : `Você já concluiu ${progress}% das atividades deste dia.`}
            </div>
          </section>
        </aside>
      </div>

      <footer className="agenda-footer">
        NEXO · GESTÃO PESSOAL
        <span>Organize seu tempo. Evolua todos os dias.</span>
      </footer>

      <style jsx>{`
        .agenda-content {
          width: 100%;
          max-width: 1600px;
          margin: 0 auto;
          padding: 30px 34px 24px;
          color: #f1f1f1;
        }

        .eyebrow {
          display: block;
          color: #929292;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.8px;
          margin-bottom: 9px;
        }

        .agenda-welcome {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 25px;
        }

        .agenda-welcome h1 {
          margin: 0;
          font-size: clamp(23px, 3vw, 30px);
          font-weight: 650;
          letter-spacing: -0.8px;
        }

        .agenda-welcome p {
          margin: 9px 0 0;
          color: #929292;
          font-size: 13px;
          line-height: 1.6;
        }

        .primary-button,
        .secondary-button,
        .today-button {
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 11px 16px;
          font-size: 12px;
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
          background: #242424;
          border-color: #393939;
          color: #ddd;
        }

        .secondary-button:hover {
          background: #303030;
        }

        .agenda-date-panel {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 20px;
          margin-bottom: 18px;
          background: #171717;
          border: 1px solid #292929;
          border-radius: 12px;
        }

        .date-navigation {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .date-arrow {
          width: 34px;
          height: 34px;
          border: 1px solid #363636;
          border-radius: 8px;
          background: #202020;
          color: #eee;
          font-size: 23px;
          cursor: pointer;
        }

        .date-arrow:hover {
          background: #303030;
        }

        .selected-date {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .selected-date-day {
          color: #f0f0f0;
          font-size: 14px;
          font-weight: 650;
          text-transform: capitalize;
        }

        .selected-date-number {
          color: #858585;
          font-size: 11px;
        }

        .today-button {
          background: transparent;
          color: #ddd;
          border-color: #424242;
        }

        .today-button:hover {
          background: #242424;
        }

        .agenda-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 20px;
        }

        .agenda-metric-card {
          min-height: 112px;
          padding: 17px;
          background: #171717;
          border: 1px solid #292929;
          border-radius: 11px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 7px;
        }

        .metric-label {
          color: #888;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.1px;
        }

        .agenda-metric-card strong {
          color: #f2f2f2;
          font-size: 27px;
          font-weight: 650;
          line-height: 1;
        }

        .agenda-metric-card .metric-danger {
          color: #e17c7c;
        }

        .metric-description {
          color: #777;
          font-size: 10px;
        }

        .agenda-form-panel,
        .agenda-main-panel,
        .side-panel {
          background: #171717;
          border: 1px solid #292929;
          border-radius: 12px;
        }

        .agenda-form-panel {
          padding: 21px;
          margin-bottom: 20px;
        }

        .panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 19px;
        }

        .panel-heading h2 {
          margin: 0;
          color: #f0f0f0;
          font-size: 16px;
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
          gap: 15px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field-wide {
          grid-column: 1 / -1;
        }

        .form-field span {
          color: #a5a5a5;
          font-size: 11px;
          font-weight: 600;
        }

        .form-field input,
        .form-field select,
        .form-field textarea {
          width: 100%;
          min-width: 0;
          padding: 11px 12px;
          border: 1px solid #363636;
          border-radius: 7px;
          outline: none;
          background: #202020;
          color: #eee;
          font-family: inherit;
          font-size: 12px;
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
          margin-top: 18px;
        }

        .agenda-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.7fr) minmax(260px, 0.9fr);
          align-items: start;
          gap: 17px;
        }

        .agenda-main-panel,
        .side-panel {
          padding: 21px;
        }

        .task-counter {
          color: #858585;
          font-size: 10px;
        }

        .day-progress {
          padding: 13px;
          margin-bottom: 19px;
          background: #202020;
          border: 1px solid #2c2c2c;
          border-radius: 8px;
        }

        .day-progress-heading {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          color: #a0a0a0;
          font-size: 11px;
        }

        .day-progress-heading strong {
          color: #eee;
        }

        .progress-track {
          height: 5px;
          overflow: hidden;
          background: #383838;
          border-radius: 20px;
        }

        .progress-fill {
          height: 100%;
          background: #bcbcbc;
          border-radius: 20px;
          transition: width 0.3s;
        }

        .empty-state {
          padding: 45px 15px;
          text-align: center;
          color: #888;
        }

        .empty-icon {
          margin-bottom: 12px;
          color: #777;
          font-size: 30px;
        }

        .empty-state h3 {
          margin: 0 0 8px;
          color: #ddd;
          font-size: 14px;
        }

        .empty-state p {
          margin: 0 0 18px;
          color: #858585;
          font-size: 11px;
        }

        .timeline {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .timeline-item {
          display: grid;
          grid-template-columns: 52px 14px minmax(0, 1fr);
          gap: 10px;
          align-items: stretch;
        }

        .timeline-time {
          padding-top: 17px;
          color: #a5a5a5;
          font-size: 11px;
          font-weight: 650;
          text-align: right;
        }

        .timeline-marker {
          position: relative;
          display: flex;
          justify-content: center;
          padding-top: 19px;
        }

        .timeline-marker::after {
          position: absolute;
          top: 27px;
          bottom: -24px;
          width: 1px;
          background: #383838;
          content: "";
        }

        .timeline-item:last-child .timeline-marker::after {
          display: none;
        }

        .timeline-marker span {
          z-index: 1;
          width: 8px;
          height: 8px;
          border: 2px solid #a4a4a4;
          border-radius: 50%;
          background: #171717;
        }

        .timeline-card {
          min-width: 0;
          padding: 14px;
          background: #202020;
          border: 1px solid #303030;
          border-radius: 9px;
        }

        .timeline-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }

        .task-title-area {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-width: 0;
        }

        .task-check {
          flex-shrink: 0;
          width: 17px;
          height: 17px;
          margin-top: 1px;
          border: 1px solid #686868;
          border-radius: 5px;
          background: transparent;
          color: #111;
          font-size: 11px;
          cursor: pointer;
        }

        .task-check.checked {
          background: #d6d6d6;
          border-color: #d6d6d6;
        }

        .task-title-area h3 {
          margin: 0 0 5px;
          color: #eee;
          font-size: 12px;
          font-weight: 650;
          overflow-wrap: anywhere;
        }

        .task-category {
          color: #888;
          font-size: 10px;
        }

        .priority-badge {
          flex-shrink: 0;
          padding: 5px 8px;
          border-radius: 5px;
          font-size: 9px;
          font-weight: 650;
        }

        .priority-badge.low {
          background: #303030;
          color: #aaa;
        }

        .priority-badge.medium {
          background: #39352a;
          color: #d7c28c;
        }

        .priority-badge.high {
          background: #422f2b;
          color: #e6a18d;
        }

        .priority-badge.urgent {
          background: #482b2b;
          color: #ed9393;
        }

        .task-notes {
          margin: 12px 0 0 27px;
          color: #969696;
          font-size: 11px;
          line-height: 1.6;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .task-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-top: 11px;
          margin-top: 12px;
          border-top: 1px solid #343434;
        }

        .task-actions button {
          padding: 4px 7px;
          border: 0;
          background: transparent;
          color: #aaa;
          font-size: 10px;
          cursor: pointer;
        }

        .task-actions button:hover {
          color: #fff;
        }

        .task-actions .delete-action:hover {
          color: #e18b8b;
        }

        .done-label,
        .waiting-label {
          font-size: 10px;
        }

        .done-label {
          color: #91b89c;
        }

        .waiting-label {
          color: #b9a979;
        }

        .timeline-item.completed .task-title-area h3 {
          color: #898989;
          text-decoration: line-through;
        }

        .timeline-item.completed .timeline-marker span {
          border-color: #83a58d;
          background: #83a58d;
        }

        .side-panel {
          margin-bottom: 16px;
        }

        .side-panel .panel-heading {
          margin-bottom: 15px;
        }

        .side-empty {
          color: #858585;
          font-size: 11px;
          line-height: 1.6;
        }

        .upcoming-list {
          display: flex;
          flex-direction: column;
        }

        .upcoming-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 0;
          border: 0;
          border-bottom: 1px solid #303030;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .upcoming-item:last-child {
          border-bottom: 0;
        }

        .upcoming-item:hover .upcoming-info strong {
          color: #fff;
        }

        .upcoming-date {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 39px;
          height: 43px;
          border: 1px solid #393939;
          border-radius: 7px;
          background: #222;
        }

        .upcoming-date strong {
          color: #eee;
          font-size: 15px;
        }

        .upcoming-date span {
          color: #888;
          font-size: 9px;
          text-transform: capitalize;
        }

        .upcoming-info {
          display: flex;
          flex: 1;
          min-width: 0;
          flex-direction: column;
          gap: 5px;
        }

        .upcoming-info strong {
          color: #d8d8d8;
          font-size: 10px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .upcoming-info span {
          color: #858585;
          font-size: 9px;
        }

        .upcoming-arrow {
          color: #777;
          font-size: 19px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 11px 0;
          border-bottom: 1px solid #303030;
          color: #999;
          font-size: 11px;
        }

        .summary-row strong {
          color: #eee;
        }

        .summary-message {
          padding: 12px;
          margin-top: 14px;
          border: 1px solid #343434;
          border-radius: 7px;
          background: #202020;
          color: #aaa;
          font-size: 10px;
          line-height: 1.6;
        }

        .agenda-footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding-top: 20px;
          margin-top: 25px;
          border-top: 1px solid #292929;
          color: #777;
          font-size: 9px;
          font-weight: 650;
          letter-spacing: 1px;
        }

        .agenda-footer span {
          font-weight: 400;
          letter-spacing: 0;
        }

        @media (max-width: 1050px) {
          .agenda-layout {
            grid-template-columns: minmax(0, 1fr);
          }

          .agenda-side-column {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 15px;
          }
        }

        @media (max-width: 700px) {
          .agenda-content {
            padding: 22px 15px;
          }

          .agenda-welcome {
            align-items: flex-start;
            flex-direction: column;
          }

          .agenda-welcome .primary-button {
            width: 100%;
          }

          .agenda-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .agenda-date-panel {
            padding: 14px;
          }

          .selected-date-day {
            font-size: 12px;
          }

          .agenda-side-column {
            grid-template-columns: minmax(0, 1fr);
          }

          .form-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .field-wide {
            grid-column: auto;
          }

          .timeline-item {
            grid-template-columns: 42px 10px minmax(0, 1fr);
            gap: 7px;
          }

          .timeline-time {
            font-size: 10px;
          }

          .timeline-card {
            padding: 11px;
          }

          .timeline-card-top {
            flex-direction: column;
          }

          .form-actions {
            flex-direction: column-reverse;
          }

          .form-actions button {
            width: 100%;
          }

          .agenda-footer {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

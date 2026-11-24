
"use client";

import { getSaoPauloDateKey } from "@/lib/date/sao-paulo";
import { useNexoConfirm } from "@/contexts/NexoConfirmProvider";

import { FormEvent, useMemo, useState } from "react";
import { useRoutineCollection } from "@/hooks/useRoutineCollection";
import { isValidRoutineTask as isValidTask } from "@/lib/routine/types";
import AgendaMetrics from "@/components/routine/agenda/AgendaMetrics";
import AgendaForm from "@/components/routine/agenda/AgendaForm";
import AgendaTimeline from "@/components/routine/agenda/AgendaTimeline";
import { getOverdueRoutineTasks, getRoutineTasksForDate, getUpcomingRoutineTasks } from "@/lib/routine/task-queries";
import type { RoutinePriority as Priority, RoutineTask as Task } from "@/lib/routine/types";

function getLocalDate(date?: Date) {
  if (!date) return getSaoPauloDateKey();
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

export default function AgendaPage() {
  const confirm = useNexoConfirm();
  const { items: tasks, setItems: setTasks, loaded, storageError } = useRoutineCollection<Task>("nexo_tasks", isValidTask);

  const [selectedDate, setSelectedDate] = useState(getLocalDate());

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getLocalDate());
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState<Priority>("Média");
  const [category, setCategory] = useState("Pessoal");
  const [notes, setNotes] = useState("");

  const selectedTasks = useMemo(() => getRoutineTasksForDate(tasks, selectedDate), [tasks, selectedDate]);

  const completedTasks = selectedTasks.filter((task) => task.done);
  const pendingTasks = selectedTasks.filter((task) => !task.done);

  const progress = selectedTasks.length
    ? Math.round((completedTasks.length / selectedTasks.length) * 100)
    : 0;

  const today = getLocalDate();

  const overdueTasks = useMemo(() => getOverdueRoutineTasks(tasks, today), [tasks, today]);

  const upcomingTasks = useMemo(() => getUpcomingRoutineTasks(tasks, selectedDate), [tasks, selectedDate]);

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

  async function deleteTask(id: number) {
    const confirmed = await confirm({ title: "Excluir atividade", message: "Deseja realmente excluir esta atividade?", confirmLabel: "Excluir", destructive: true });

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
      {storageError && (
        <div className="form-card" role="alert">
          <strong>Armazenamento protegido</strong>
          <p>{storageError}</p>
        </div>
      )}
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

            <AgendaMetrics total={selectedTasks.length} pending={pendingTasks.length} completed={completedTasks.length} overdue={overdueTasks.length} />

      {showForm && (
        <AgendaForm
          editingId={editingId}
          description={description}
          setDescription={setDescription}
          date={date}
          setDate={setDate}
          time={time}
          setTime={setTime}
          priority={priority}
          setPriority={setPriority}
          category={category}
          setCategory={setCategory}
          notes={notes}
          setNotes={setNotes}
          onCancel={resetForm}
          onSubmit={handleSubmit}
        />
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
                          <AgendaTimeline selectedTasks={selectedTasks} toggleTask={toggleTask} editTask={editTask} deleteTask={deleteTask} />
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

      <style jsx global>{`
        .agenda-content {
          width: 100%;
          max-width: 1600px;
          margin: 0 auto;
          padding: 30px 34px 24px;
          color: #f1f1f1;
        }

        .agenda-content .eyebrow {
          display: block;
          color: #929292;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.8px;
          margin-bottom: 9px;
        }

        .agenda-content .agenda-welcome {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 25px;
        }

        .agenda-content .agenda-welcome h1 {
          margin: 0;
          font-size: clamp(23px, 3vw, 30px);
          font-weight: 650;
          letter-spacing: -0.8px;
        }

        .agenda-content .agenda-welcome p {
          margin: 9px 0 0;
          color: #929292;
          font-size: 13px;
          line-height: 1.6;
        }

        .agenda-content .primary-button,
        .agenda-content .secondary-button,
        .agenda-content .today-button {
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 11px 16px;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
          transition: 0.2s;
        }

        .agenda-content .primary-button {
          background: #ededed;
          color: #111;
        }

        .agenda-content .primary-button:hover {
          background: #fff;
          transform: translateY(-1px);
        }

        .agenda-content .secondary-button {
          background: #242424;
          border-color: #393939;
          color: #ddd;
        }

        .agenda-content .secondary-button:hover {
          background: #303030;
        }

        .agenda-content .agenda-date-panel {
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

        .agenda-content .date-navigation {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .agenda-content .date-arrow {
          width: 34px;
          height: 34px;
          border: 1px solid #363636;
          border-radius: 8px;
          background: #202020;
          color: #eee;
          font-size: 23px;
          cursor: pointer;
        }

        .agenda-content .date-arrow:hover {
          background: #303030;
        }

        .agenda-content .selected-date {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .agenda-content .selected-date-day {
          color: #f0f0f0;
          font-size: 14px;
          font-weight: 650;
          text-transform: capitalize;
        }

        .agenda-content .selected-date-number {
          color: #858585;
          font-size: 11px;
        }

        .agenda-content .today-button {
          background: transparent;
          color: #ddd;
          border-color: #424242;
        }

        .agenda-content .today-button:hover {
          background: #242424;
        }

        .agenda-content .agenda-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 20px;
        }

        .agenda-content .agenda-metric-card {
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

        .agenda-content .metric-label {
          color: #888;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.1px;
        }

        .agenda-content .agenda-metric-card strong {
          color: #f2f2f2;
          font-size: 27px;
          font-weight: 650;
          line-height: 1;
        }

        .agenda-content .agenda-metric-card .metric-danger {
          color: #e17c7c;
        }

        .agenda-content .metric-description {
          color: #777;
          font-size: 10px;
        }

        .agenda-content .agenda-form-panel,
        .agenda-content .agenda-main-panel,
        .agenda-content .side-panel {
          background: #171717;
          border: 1px solid #292929;
          border-radius: 12px;
        }

        .agenda-content .agenda-form-panel {
          padding: 21px;
          margin-bottom: 20px;
        }

        .agenda-content .panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 19px;
        }

        .agenda-content .panel-heading h2 {
          margin: 0;
          color: #f0f0f0;
          font-size: 16px;
          font-weight: 650;
        }

        .agenda-content .panel-heading .eyebrow {
          margin-bottom: 5px;
        }

        .agenda-content .close-button {
          width: 32px;
          height: 32px;
          border: 1px solid #393939;
          border-radius: 7px;
          background: transparent;
          color: #bbb;
          font-size: 22px;
          cursor: pointer;
        }

        .agenda-content .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .agenda-content .form-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .agenda-content .field-wide {
          grid-column: 1 / -1;
        }

        .agenda-content .form-field span {
          color: #a5a5a5;
          font-size: 11px;
          font-weight: 600;
        }

        .agenda-content .form-field input,
        .agenda-content .form-field select,
        .agenda-content .form-field textarea {
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

        .agenda-content .form-field input:focus,
        .agenda-content .form-field select:focus,
        .agenda-content .form-field textarea:focus {
          border-color: #888;
        }

        .agenda-content .form-field textarea {
          resize: vertical;
        }

        .agenda-content .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 18px;
        }

        .agenda-content .agenda-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.7fr) minmax(260px, 0.9fr);
          align-items: start;
          gap: 17px;
        }

        .agenda-content .agenda-main-panel,
        .agenda-content .side-panel {
          padding: 21px;
        }

        .agenda-content .task-counter {
          color: #858585;
          font-size: 10px;
        }

        .agenda-content .day-progress {
          padding: 13px;
          margin-bottom: 19px;
          background: #202020;
          border: 1px solid #2c2c2c;
          border-radius: 8px;
        }

        .agenda-content .day-progress-heading {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          color: #a0a0a0;
          font-size: 11px;
        }

        .agenda-content .day-progress-heading strong {
          color: #eee;
        }

        .agenda-content .progress-track {
          height: 5px;
          overflow: hidden;
          background: #383838;
          border-radius: 20px;
        }

        .agenda-content .progress-fill {
          height: 100%;
          background: #bcbcbc;
          border-radius: 20px;
          transition: width 0.3s;
        }

        .agenda-content .empty-state {
          padding: 45px 15px;
          text-align: center;
          color: #888;
        }

        .agenda-content .empty-icon {
          margin-bottom: 12px;
          color: #777;
          font-size: 30px;
        }

        .agenda-content .empty-state h3 {
          margin: 0 0 8px;
          color: #ddd;
          font-size: 14px;
        }

        .agenda-content .empty-state p {
          margin: 0 0 18px;
          color: #858585;
          font-size: 11px;
        }

        .agenda-content .timeline {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .agenda-content .timeline-item {
          display: grid;
          grid-template-columns: 52px 14px minmax(0, 1fr);
          gap: 10px;
          align-items: stretch;
        }

        .agenda-content .timeline-time {
          padding-top: 17px;
          color: #a5a5a5;
          font-size: 11px;
          font-weight: 650;
          text-align: right;
        }

        .agenda-content .timeline-marker {
          position: relative;
          display: flex;
          justify-content: center;
          padding-top: 19px;
        }

        .agenda-content .timeline-marker::after {
          position: absolute;
          top: 27px;
          bottom: -24px;
          width: 1px;
          background: #383838;
          content: "";
        }

        .agenda-content .timeline-item:last-child .timeline-marker::after {
          display: none;
        }

        .agenda-content .timeline-marker span {
          z-index: 1;
          width: 8px;
          height: 8px;
          border: 2px solid #a4a4a4;
          border-radius: 50%;
          background: #171717;
        }

        .agenda-content .timeline-card {
          min-width: 0;
          padding: 14px;
          background: #202020;
          border: 1px solid #303030;
          border-radius: 9px;
        }

        .agenda-content .timeline-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }

        .agenda-content .task-title-area {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-width: 0;
        }

        .agenda-content .task-check {
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

        .agenda-content .task-check.checked {
          background: #d6d6d6;
          border-color: #d6d6d6;
        }

        .agenda-content .task-title-area h3 {
          margin: 0 0 5px;
          color: #eee;
          font-size: 12px;
          font-weight: 650;
          overflow-wrap: anywhere;
        }

        .agenda-content .task-category {
          color: #888;
          font-size: 10px;
        }

        .agenda-content .priority-badge {
          flex-shrink: 0;
          padding: 5px 8px;
          border-radius: 5px;
          font-size: 9px;
          font-weight: 650;
        }

        .agenda-content .priority-badge.low {
          background: #303030;
          color: #aaa;
        }

        .agenda-content .priority-badge.medium {
          background: #39352a;
          color: #d7c28c;
        }

        .agenda-content .priority-badge.high {
          background: #422f2b;
          color: #e6a18d;
        }

        .agenda-content .priority-badge.urgent {
          background: #482b2b;
          color: #ed9393;
        }

        .agenda-content .task-notes {
          margin: 12px 0 0 27px;
          color: #969696;
          font-size: 11px;
          line-height: 1.6;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .agenda-content .task-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-top: 11px;
          margin-top: 12px;
          border-top: 1px solid #343434;
        }

        .agenda-content .task-actions button {
          padding: 4px 7px;
          border: 0;
          background: transparent;
          color: #aaa;
          font-size: 10px;
          cursor: pointer;
        }

        .agenda-content .task-actions button:hover {
          color: #fff;
        }

        .agenda-content .task-actions .delete-action:hover {
          color: #e18b8b;
        }

        .agenda-content .done-label,
        .agenda-content .waiting-label {
          font-size: 10px;
        }

        .agenda-content .done-label {
          color: #91b89c;
        }

        .agenda-content .waiting-label {
          color: #b9a979;
        }

        .agenda-content .timeline-item.completed .task-title-area h3 {
          color: #898989;
          text-decoration: line-through;
        }

        .agenda-content .timeline-item.completed .timeline-marker span {
          border-color: #83a58d;
          background: #83a58d;
        }

        .agenda-content .side-panel {
          margin-bottom: 16px;
        }

        .agenda-content .side-panel .panel-heading {
          margin-bottom: 15px;
        }

        .agenda-content .side-empty {
          color: #858585;
          font-size: 11px;
          line-height: 1.6;
        }

        .agenda-content .upcoming-list {
          display: flex;
          flex-direction: column;
        }

        .agenda-content .upcoming-item {
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

        .agenda-content .upcoming-item:last-child {
          border-bottom: 0;
        }

        .agenda-content .upcoming-item:hover .upcoming-info strong {
          color: #fff;
        }

        .agenda-content .upcoming-date {
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

        .agenda-content .upcoming-date strong {
          color: #eee;
          font-size: 15px;
        }

        .agenda-content .upcoming-date span {
          color: #888;
          font-size: 9px;
          text-transform: capitalize;
        }

        .agenda-content .upcoming-info {
          display: flex;
          flex: 1;
          min-width: 0;
          flex-direction: column;
          gap: 5px;
        }

        .agenda-content .upcoming-info strong {
          color: #d8d8d8;
          font-size: 10px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .agenda-content .upcoming-info span {
          color: #858585;
          font-size: 9px;
        }

        .agenda-content .upcoming-arrow {
          color: #777;
          font-size: 19px;
        }

        .agenda-content .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 11px 0;
          border-bottom: 1px solid #303030;
          color: #999;
          font-size: 11px;
        }

        .agenda-content .summary-row strong {
          color: #eee;
        }

        .agenda-content .summary-message {
          padding: 12px;
          margin-top: 14px;
          border: 1px solid #343434;
          border-radius: 7px;
          background: #202020;
          color: #aaa;
          font-size: 10px;
          line-height: 1.6;
        }

        .agenda-content .agenda-footer {
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

        .agenda-content .agenda-footer span {
          font-weight: 400;
          letter-spacing: 0;
        }

        @media (max-width: 1050px) {
          .agenda-content .agenda-layout {
            grid-template-columns: minmax(0, 1fr);
          }

          .agenda-content .agenda-side-column {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 15px;
          }
        }

        @media (max-width: 700px) {
          .agenda-content {
            padding: 22px 15px;
          }

          .agenda-content .agenda-welcome {
            align-items: flex-start;
            flex-direction: column;
          }

          .agenda-content .agenda-welcome .primary-button {
            width: 100%;
          }

          .agenda-content .agenda-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .agenda-content .agenda-date-panel {
            padding: 14px;
          }

          .agenda-content .selected-date-day {
            font-size: 12px;
          }

          .agenda-content .agenda-side-column {
            grid-template-columns: minmax(0, 1fr);
          }

          .agenda-content .form-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .agenda-content .field-wide {
            grid-column: auto;
          }

          .agenda-content .timeline-item {
            grid-template-columns: 42px 10px minmax(0, 1fr);
            gap: 7px;
          }

          .agenda-content .timeline-time {
            font-size: 10px;
          }

          .agenda-content .timeline-card {
            padding: 11px;
          }

          .agenda-content .timeline-card-top {
            flex-direction: column;
          }

          .agenda-content .form-actions {
            flex-direction: column-reverse;
          }

          .agenda-content .form-actions button {
            width: 100%;
          }

          .agenda-content .agenda-footer {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

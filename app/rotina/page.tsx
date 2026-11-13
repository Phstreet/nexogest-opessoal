
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MainNavigation from "../../components/navigation/MainNavigation";

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

function formatLongDate(date = new Date()) {
  return date.toLocaleDateString("pt-BR", {
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
        item !== null &&
        typeof item === "object" &&
        typeof item.id === "number" &&
        typeof item.description === "string" &&
        typeof item.done === "boolean"
    )
  );
}

function loadTasks(): Task[] {
  try {
    const saved = localStorage.getItem(TASKS_KEY);

    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);

    return isValidTaskArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erro ao carregar tarefas:", error);
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

export default function RoutineDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [taskName, setTaskName] = useState("");
  const [taskDate, setTaskDate] = useState(getLocalDate());
  const [taskTime, setTaskTime] = useState("");
  const [taskPriority, setTaskPriority] = useState<Priority>("Média");

  const [showQuickForm, setShowQuickForm] = useState(false);

  const today = getLocalDate();
  const currentDate = new Date();

  const loadData = useCallback(() => {
    setTasks(loadTasks());
    setLoaded(true);
  }, []);

  // CARREGAMENTO E SINCRONIZAÇÃO

  useEffect(() => {
    loadData();

    function handleStorage(event: StorageEvent) {
      if (event.key === TASKS_KEY || event.key === null) {
        loadData();
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadData]);

  // SALVAMENTO

  useEffect(() => {
    if (!loaded) return;

    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error("Erro ao salvar tarefas:", error);
    }
  }, [tasks, loaded]);

  // INDICADORES

  const completedTasks = tasks.filter((task) => task.done);
  const pendingTasks = tasks.filter((task) => !task.done);

  const todayTasks = tasks.filter((task) => task.date === today);

  const todayCompleted = todayTasks.filter((task) => task.done);

  const overdueTasks = pendingTasks.filter(
    (task) => task.date && task.date < today
  );

  const nextSevenDays = getLocalDate(
    new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() + 7
    )
  );

  const upcomingTasks = pendingTasks
    .filter(
      (task) =>
        task.date &&
        task.date >= today &&
        task.date <= nextSevenDays
    )
    .sort((a, b) => {
      const dateComparison = (a.date || "").localeCompare(b.date || "");

      if (dateComparison !== 0) return dateComparison;

      return (a.time || "").localeCompare(b.time || "");
    });

  const progress = tasks.length
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : 0;

  const todayProgress = todayTasks.length
    ? Math.round((todayCompleted.length / todayTasks.length) * 100)
    : 0;

  const highPriorityTasks = pendingTasks.filter(
    (task) =>
      task.priority === "Alta" ||
      task.priority === "Urgente"
  );

  const tasksWithoutDate = pendingTasks.filter((task) => !task.date);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";

    return "Boa noite";
  }, []);

  // AÇÕES

  function addTask() {
    const description = taskName.trim();

    if (!description) {
      alert("Informe o nome da atividade.");
      return;
    }

    const newTask: Task = {
      id: Date.now(),
      description,
      done: false,
      date: taskDate || undefined,
      time: taskTime || undefined,
      priority: taskPriority,
      category: "Pessoal",
      createdAt: new Date().toISOString(),
    };

    setTasks((current) => [...current, newTask]);

    setTaskName("");
    setTaskTime("");
    setTaskPriority("Média");
    setTaskDate(today);
    setShowQuickForm(false);
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
    if (!confirm("Deseja excluir esta atividade?")) return;

    setTasks((current) =>
      current.filter((task) => task.id !== id)
    );
  }

  return (
    <main className="app-shell">
      {/* NAVEGAÇÃO CENTRALIZADA NEXO */}

      <MainNavigation />

      {/* ÁREA PRINCIPAL */}

      <section className="main-area">
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              NEXO / MINHA ROTINA / VISÃO GERAL
            </div>
            <h1>Minha rotina</h1>
          </div>

          <div className="topbar-right">
            <div className="date-display">
              <span className="date-icon">◷</span>
              {formatLongDate()}
            </div>

            <div className="profile-avatar">N</div>
          </div>
        </header>

        <div className="content routine-content">
          {/* BOAS-VINDAS */}

          <section className="routine-welcome">
            <div className="routine-welcome-content">
              <div className="routine-eyebrow">
                <span />
                SEU CENTRO DE ORGANIZAÇÃO
              </div>

              <h2>
                {greeting}, vamos colocar
                <br />
                seus planos em <span>movimento.</span>
              </h2>

              <p>
                Organize suas prioridades, acompanhe suas atividades
                e transforme seus objetivos em resultados.
              </p>

              <button
                type="button"
                className="routine-primary-button"
                onClick={() =>
                  setShowQuickForm((current) => !current)
                }
              >
                + Nova atividade
              </button>
            </div>

            <div className="routine-welcome-art">
              <div className="routine-art-circle circle-one" />
              <div className="routine-art-circle circle-two" />
              <div className="routine-art-center">
                <span>✓</span>
              </div>
              <div className="routine-art-line" />
            </div>

            <div className="routine-welcome-index">
              01 — ORGANIZAÇÃO
            </div>
          </section>

          {/* CADASTRO RÁPIDO */}

          {showQuickForm && (
            <section className="routine-panel quick-form">
              <div className="routine-panel-heading">
                <div>
                  <div className="routine-kicker">
                    PLANEJAMENTO
                  </div>
                  <h3>Adicionar atividade</h3>
                </div>

                <button
                  type="button"
                  className="routine-close"
                  onClick={() => setShowQuickForm(false)}
                  aria-label="Fechar formulário"
                >
                  ×
                </button>
              </div>

              <div className="quick-form-grid">
                <label className="quick-field field-description">
                  <span>Descrição da atividade</span>
                  <input
                    value={taskName}
                    onChange={(event) =>
                      setTaskName(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") addTask();
                    }}
                    placeholder="O que você precisa fazer?"
                    autoFocus
                  />
                </label>

                <label className="quick-field">
                  <span>Data</span>
                  <input
                    type="date"
                    value={taskDate}
                    onChange={(event) =>
                      setTaskDate(event.target.value)
                    }
                  />
                </label>

                <label className="quick-field">
                  <span>Horário</span>
                  <input
                    type="time"
                    value={taskTime}
                    onChange={(event) =>
                      setTaskTime(event.target.value)
                    }
                  />
                </label>

                <label className="quick-field">
                  <span>Prioridade</span>
                  <select
                    value={taskPriority}
                    onChange={(event) =>
                      setTaskPriority(
                        event.target.value as Priority
                      )
                    }
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </label>
              </div>

              <div className="quick-form-actions">
                <button
                  type="button"
                  className="routine-secondary-button"
                  onClick={() => setShowQuickForm(false)}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="routine-primary-button"
                  onClick={addTask}
                >
                  Salvar atividade
                </button>
              </div>
            </section>
          )}

          {/* INDICADORES */}

          <div className="routine-section-heading">
            <div>
              <div className="routine-kicker">
                ACOMPANHAMENTO
              </div>
              <h2>Resumo da rotina</h2>
            </div>

            <span className="routine-updated">
              Dados atualizados automaticamente
            </span>
          </div>

          <section className="routine-metrics">
            <div className="routine-metric-card">
              <div className="routine-metric-top">
                <span>Total de atividades</span>
                <span className="routine-metric-icon">▤</span>
              </div>
              <strong>{tasks.length}</strong>
              <small>Atividades cadastradas</small>
              <div className="routine-metric-line" />
            </div>

            <div className="routine-metric-card">
              <div className="routine-metric-top">
                <span>Concluídas</span>
                <span className="routine-metric-icon">✓</span>
              </div>
              <strong>{completedTasks.length}</strong>
              <small>Atividades finalizadas</small>
              <div className="routine-metric-line" />
            </div>

            <div className="routine-metric-card">
              <div className="routine-metric-top">
                <span>Pendentes</span>
                <span className="routine-metric-icon">◷</span>
              </div>
              <strong>{pendingTasks.length}</strong>
              <small>Aguardando conclusão</small>
              <div className="routine-metric-line" />
            </div>

            <div className="routine-metric-card">
              <div className="routine-metric-top">
                <span>Atrasadas</span>
                <span className="routine-metric-icon">!</span>
              </div>
              <strong className={overdueTasks.length ? "metric-danger" : ""}>
                {overdueTasks.length}
              </strong>
              <small>Precisam de atenção</small>
              <div className="routine-metric-line" />
            </div>
          </section>

          {/* ATIVIDADES DE HOJE E PROGRESSO */}

          <section className="routine-dashboard-grid">
            <div className="routine-panel today-panel">
              <div className="routine-panel-heading">
                <div>
                  <div className="routine-kicker">
                    {formatDate(today)}
                  </div>
                  <h3>Atividades de hoje</h3>
                </div>

                <Link
                  href="/rotina/agenda"
                  className="routine-text-link"
                >
                  Ver agenda →
                </Link>
              </div>

              <div className="today-progress">
                <div className="today-progress-info">
                  <span>Progresso do dia</span>
                  <strong>{todayProgress}%</strong>
                </div>

                <div className="today-progress-track">
                  <div
                    className="today-progress-fill"
                    style={{ width: `${todayProgress}%` }}
                  />
                </div>
              </div>

              {todayTasks.length > 0 ? (
                <div className="routine-task-list">
                  {todayTasks
                    .slice()
                    .sort((a, b) =>
                      (a.time || "99:99").localeCompare(
                        b.time || "99:99"
                      )
                    )
                    .slice(0, 6)
                    .map((task) => (
                      <div className="routine-task" key={task.id}>
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() => toggleTask(task.id)}
                          aria-label={`Concluir ${task.description}`}
                        />

                        <div className="routine-task-info">
                          <strong
                            className={
                              task.done ? "task-completed" : ""
                            }
                          >
                            {task.description}
                          </strong>
                          <small>
                            {task.time || "Horário não definido"}
                          </small>
                        </div>

                        <span
                          className={`routine-priority ${priorityClass(
                            task.priority
                          )}`}
                        >
                          {task.priority || "Normal"}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="routine-empty">
                  <span>✓</span>
                  <strong>
                    Nenhuma atividade programada para hoje.
                  </strong>
                  <small>Que tal organizar seu dia?</small>

                  <button
                    type="button"
                    onClick={() => setShowQuickForm(true)}
                  >
                    Adicionar atividade
                  </button>
                </div>
              )}

              {todayTasks.length > 6 && (
                <Link
                  href="/rotina/agenda"
                  className="routine-see-more"
                >
                  Ver todas as {todayTasks.length} atividades
                </Link>
              )}
            </div>

            <div className="routine-panel progress-panel">
              <div className="routine-kicker">
                DESEMPENHO GERAL
              </div>

              <h3>Sua evolução</h3>

              <p>
                Acompanhe seu ritmo de execução e mantenha a
                consistência nas suas atividades.
              </p>

              <div className="routine-progress-circle">
                <svg viewBox="0 0 160 160">
                  <circle
                    cx="80"
                    cy="80"
                    r="66"
                    className="progress-circle-background"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="66"
                    className="progress-circle-value"
                    style={{
                      strokeDasharray: `${
                        (progress / 100) * 414.69
                      } 414.69`,
                    }}
                  />
                </svg>

                <div className="routine-progress-center">
                  <strong>{progress}%</strong>
                  <small>Concluído</small>
                </div>
              </div>

              <div className="progress-detail">
                <div>
                  <span className="progress-dot completed-dot" />
                  Concluídas
                  <strong>{completedTasks.length}</strong>
                </div>

                <div>
                  <span className="progress-dot pending-dot" />
                  Pendentes
                  <strong>{pendingTasks.length}</strong>
                </div>
              </div>
            </div>
          </section>

          {/* PRÓXIMAS ATIVIDADES E PRIORIDADES */}

          <section className="routine-dashboard-grid secondary-grid">
            <div className="routine-panel upcoming-panel">
              <div className="routine-panel-heading">
                <div>
                  <div className="routine-kicker">
                    PRÓXIMOS SETE DIAS
                  </div>
                  <h3>Próximas atividades</h3>
                </div>

                <Link
                  href="/rotina/planejamento"
                  className="routine-text-link"
                >
                  Planejar semana →
                </Link>
              </div>

              {upcomingTasks.length > 0 ? (
                <div className="upcoming-list">
                  {upcomingTasks.slice(0, 5).map((task) => (
                    <div className="upcoming-item" key={task.id}>
                      <div className="upcoming-date">
                        <strong>{task.date?.slice(8, 10)}</strong>
                        <small>
                          {new Date(
                            `${task.date}T12:00:00`
                          ).toLocaleDateString("pt-BR", {
                            month: "short",
                          })}
                        </small>
                      </div>

                      <div className="upcoming-info">
                        <strong>{task.description}</strong>
                        <small>
                          {task.time || "Horário não definido"}
                        </small>
                      </div>

                      <span
                        className={`routine-priority ${priorityClass(
                          task.priority
                        )}`}
                      >
                        {task.priority || "Normal"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="routine-empty compact-empty">
                  <span>▦</span>
                  <strong>
                    Nenhuma atividade futura cadastrada.
                  </strong>
                  <small>
                    Suas próximas atividades aparecerão aqui.
                  </small>
                </div>
              )}
            </div>

            <div className="routine-panel attention-panel">
              <div className="routine-kicker">
                PONTOS DE ATENÇÃO
              </div>

              <h3>O que precisa de foco?</h3>

              <div className="attention-item">
                <span className="attention-indicator danger-indicator" />
                <div>
                  <strong>Atividades atrasadas</strong>
                  <small>Precisam ser revisadas</small>
                </div>
                <b>{overdueTasks.length}</b>
              </div>

              <div className="attention-item">
                <span className="attention-indicator warning-indicator" />
                <div>
                  <strong>Alta prioridade</strong>
                  <small>Exigem atenção especial</small>
                </div>
                <b>{highPriorityTasks.length}</b>
              </div>

              <div className="attention-item">
                <span className="attention-indicator neutral-indicator" />
                <div>
                  <strong>Sem data definida</strong>
                  <small>Precisam de planejamento</small>
                </div>
                <b>{tasksWithoutDate.length}</b>
              </div>

              <Link
                href="/rotina/tarefas"
                className="attention-link"
              >
                Organizar minhas tarefas →
              </Link>
            </div>
          </section>

          {/* HÁBITOS */}

          <section className="routine-panel habits-preview">
            <div className="habits-preview-content">
              <div className="routine-kicker">
                CONSTÂNCIA E EVOLUÇÃO
              </div>

              <h3>Pequenos hábitos, grandes resultados.</h3>

              <p>
                Crie hábitos, acompanhe sua frequência e construa
                uma rotina mais consistente.
              </p>

              <Link
                href="/rotina/habitos"
                className="routine-secondary-button"
              >
                Acessar meus hábitos →
              </Link>
            </div>

            <div className="habits-preview-art">
              <div>01</div>
              <div>02</div>
              <div>03</div>
              <span>CONSISTÊNCIA</span>
            </div>
          </section>

          <footer className="routine-footer">
            <span>© 2026 NEXO — GESTÃO PESSOAL</span>
            <span>PLANEJE. ORGANIZE. CONQUISTE.</span>
          </footer>
        </div>
      </section>

      <style jsx>{`
        /* CONTEÚDO DA ROTINA */

        .routine-content {
          padding-top: 23px;
        }

        .routine-welcome {
          min-height: 225px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          padding: 27px 32px;
          background: linear-gradient(
            100deg,
            #222326 0%,
            #171719 52%,
            #101012 100%
          );
          border: 1px solid #35353a;
          border-radius: 10px;
        }

        .routine-welcome-content {
          position: relative;
          z-index: 2;
          max-width: 590px;
        }

        .routine-eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 13px;
          color: #b1b4bb;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 1.7px;
        }

        .routine-eyebrow span {
          width: 20px;
          height: 1px;
          background: #d3d6dc;
        }

        .routine-welcome h2 {
          margin: 0;
          font-family: var(--font-heading);
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 800;
          line-height: 1.12;
          letter-spacing: -1.5px;
        }

        .routine-welcome h2 span {
          color: #bfc4cc;
        }

        .routine-welcome p {
          max-width: 460px;
          margin: 11px 0 16px;
          color: #a1a2a8;
          font-size: 11px;
          line-height: 1.6;
        }

        .routine-primary-button {
          min-height: 36px;
          padding: 0 13px;
          color: #111214;
          background: linear-gradient(135deg, #e1e3e7, #9da3ad);
          border: 1px solid #aeb3bc;
          border-radius: 5px;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition);
        }

        .routine-primary-button:hover {
          filter: brightness(1.12);
          transform: translateY(-1px);
        }

        .routine-welcome-art {
          width: 310px;
          height: 240px;
          position: absolute;
          right: 7%;
          top: 50%;
          transform: translateY(-50%);
          display: grid;
          place-items: center;
          opacity: 0.8;
        }

        .routine-art-circle {
          position: absolute;
          border: 1px solid rgba(204, 210, 220, 0.15);
          border-radius: 50%;
        }

        .circle-one {
          width: 220px;
          height: 220px;
        }

        .circle-two {
          width: 160px;
          height: 160px;
        }

        .routine-art-center {
          width: 90px;
          height: 90px;
          display: grid;
          place-items: center;
          border: 1px solid #aeb5c0;
          border-radius: 50%;
          background: #252930;
          box-shadow: 0 0 50px rgba(180, 190, 205, 0.12);
        }

        .routine-art-center span {
          font-size: 38px;
          color: #d9dde3;
          font-weight: 300;
        }

        .routine-art-line {
          width: 270px;
          height: 1px;
          position: absolute;
          background: linear-gradient(
            90deg,
            transparent,
            #89919d,
            transparent
          );
          transform: rotate(-35deg);
        }

        .routine-welcome-index {
          position: absolute;
          right: 17px;
          bottom: 13px;
          color: #858991;
          font-size: 7px;
          letter-spacing: 1.5px;
        }

        /* TÍTULOS E SEÇÕES */

        .routine-kicker {
          color: #777a81;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 1.7px;
        }

        .routine-section-heading {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 15px;
          margin: 25px 0 12px;
        }

        .routine-section-heading h2 {
          margin: 5px 0 0;
          color: #f0f0f2;
          font-family: var(--font-heading);
          font-size: 15px;
          font-weight: 700;
        }

        .routine-updated {
          color: #727782;
          font-size: 10px;
        }

        /* INDICADORES */

        .routine-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .routine-metric-card {
          min-width: 0;
          position: relative;
          overflow: hidden;
          padding: 15px 15px 16px;
          background: linear-gradient(145deg, #1b1b1e, #131315);
          border: 1px solid #2c2c31;
          border-radius: 8px;
          transition: var(--transition);
        }

        .routine-metric-card:hover {
          border-color: #555861;
          transform: translateY(-1px);
        }

        .routine-metric-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #a5a6ac;
          font-size: 10px;
        }

        .routine-metric-icon {
          display: grid;
          place-items: center;
          width: 25px;
          height: 25px;
          color: #d2d5db;
          border: 1px solid #45474e;
          border-radius: 6px;
          font-size: 13px;
        }

        .routine-metric-card > strong {
          display: block;
          margin-top: 11px;
          font-family: var(--font-heading);
          font-size: clamp(17px, 1.7vw, 22px);
          font-weight: 700;
          letter-spacing: -0.7px;
        }

        .routine-metric-card > strong.metric-danger {
          color: #d18c8c;
        }

        .routine-metric-card > small {
          display: block;
          margin-top: 5px;
          color: #777980;
          font-size: 9px;
        }

        .routine-metric-line {
          width: 28px;
          height: 2px;
          margin-top: 12px;
          border-radius: 3px;
          background: linear-gradient(90deg, #c5cad2, #777d87);
        }

        /* PAINÉIS */

        .routine-dashboard-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(260px, 1fr);
          gap: 11px;
          margin-top: 12px;
        }

        .routine-panel {
          min-width: 0;
          padding: 17px;
          background: linear-gradient(145deg, #19191c, #131315);
          border: 1px solid #2c2c31;
          border-radius: 8px;
        }

        .routine-panel-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 13px;
        }

        .routine-panel h3 {
          margin: 5px 0 0;
          color: #f0f0f2;
          font-family: var(--font-heading);
          font-size: 13px;
          font-weight: 700;
        }

        .routine-text-link {
          color: #b8bdc5;
          font-size: 10px;
          text-decoration: none;
          white-space: nowrap;
        }

        .routine-text-link:hover {
          color: #fff;
        }

        /* PROGRESSO DO DIA */

        .today-progress {
          margin: 18px 0 12px;
        }

        .today-progress-info {
          display: flex;
          justify-content: space-between;
          color: #9298a2;
          font-size: 10px;
          margin-bottom: 9px;
        }

        .today-progress-info strong {
          color: #e1e4e9;
        }

        .today-progress-track {
          height: 4px;
          overflow: hidden;
          background: #303136;
          border-radius: 5px;
        }

        .today-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #e1e3e7, #858b95);
          border-radius: 5px;
          transition: width 0.3s ease;
        }

        /* TAREFAS */

        .routine-task-list {
          display: flex;
          flex-direction: column;
        }

        .routine-task {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 52px;
          border-top: 1px solid #29292e;
        }

        .routine-task input {
          flex-shrink: 0;
          width: 15px;
          height: 15px;
          accent-color: #c4cad3;
          cursor: pointer;
        }

        .routine-task-info {
          flex: 1;
          min-width: 0;
        }

        .routine-task-info strong,
        .upcoming-info strong {
          display: block;
          overflow: hidden;
          color: #e1e3e7;
          font-size: 10px;
          font-weight: 500;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .routine-task-info small,
        .upcoming-info small {
          display: block;
          color: #777d87;
          font-size: 9px;
          margin-top: 4px;
        }

        .task-completed {
          color: #737983 !important;
          text-decoration: line-through;
        }

        .routine-priority {
          flex-shrink: 0;
          padding: 4px 7px;
          border-radius: 20px;
          font-size: 8px;
          background: #282b31;
          color: #b5bbc4;
          white-space: nowrap;
        }

        .routine-priority.urgent,
        .routine-priority.high {
          color: #e3a0a0;
          background: rgba(160, 70, 70, 0.13);
        }

        .routine-priority.medium {
          color: #d4c39d;
          background: rgba(170, 145, 85, 0.12);
        }

        .routine-priority.low {
          color: #aab9ad;
          background: rgba(100, 140, 110, 0.12);
        }

        /* ESTADO VAZIO */

        .routine-empty {
          min-height: 150px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 8px;
          color: #777d87;
        }

        .routine-empty > span {
          font-size: 21px;
          color: #b4bbc5;
        }

        .routine-empty strong {
          color: #c5c9d0;
          font-size: 11px;
          font-weight: 500;
        }

        .routine-empty small {
          font-size: 9px;
        }

        .routine-empty button {
          margin-top: 6px;
          border: 0;
          background: transparent;
          color: #c7cbd2;
          font-size: 9px;
          cursor: pointer;
          text-decoration: underline;
        }

        .routine-see-more {
          display: block;
          padding-top: 10px;
          color: #b8bdc5;
          border-top: 1px solid #29292e;
          font-size: 10px;
          text-decoration: none;
        }

        /* PROGRESSO GERAL */

        .progress-panel {
          display: flex;
          flex-direction: column;
        }

        .progress-panel p {
          color: #92949b;
          font-size: 10px;
          line-height: 1.7;
          margin: 9px 0 0;
        }

        .routine-progress-circle {
          width: 160px;
          height: 160px;
          position: relative;
          margin: 8px auto 0;
        }

        .routine-progress-circle svg {
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }

        .routine-progress-circle circle {
          fill: none;
          stroke-width: 8;
        }

        .progress-circle-background {
          stroke: #30333a;
        }

        .progress-circle-value {
          stroke: #c5cbd4;
          stroke-linecap: round;
          transition: stroke-dasharray 0.3s ease;
        }

        .routine-progress-center {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .routine-progress-center strong {
          font-size: 30px;
          font-weight: 500;
        }

        .routine-progress-center small {
          color: #858b95;
          font-size: 9px;
        }

        .progress-detail {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: auto;
          padding-top: 15px;
          border-top: 1px solid #303238;
        }

        .progress-detail > div {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #9298a2;
          font-size: 9px;
        }

        .progress-detail strong {
          color: #e4e6e9;
          margin-left: 2px;
        }

        .progress-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .completed-dot {
          background: #c4cad3;
        }

        .pending-dot {
          background: #626873;
        }

        /* PRÓXIMAS ATIVIDADES */

        .secondary-grid {
          margin-top: 12px;
        }

        .upcoming-list {
          margin-top: 12px;
        }

        .upcoming-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          border-top: 1px solid #29292e;
        }

        .upcoming-date {
          width: 35px;
          height: 38px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: #272a30;
          border-radius: 4px;
        }

        .upcoming-date strong {
          color: #e6e8eb;
          font-size: 14px;
          font-weight: 500;
        }

        .upcoming-date small {
          color: #9298a2;
          font-size: 8px;
          text-transform: uppercase;
        }

        .upcoming-info {
          flex: 1;
          min-width: 0;
        }

        .compact-empty {
          min-height: 130px;
        }

        /* PONTOS DE ATENÇÃO */

        .attention-panel h3 {
          margin-bottom: 13px;
        }

        .attention-item {
          min-height: 53px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-top: 1px solid #29292e;
        }

        .attention-indicator {
          width: 7px;
          height: 7px;
          flex-shrink: 0;
          border-radius: 50%;
        }

        .danger-indicator {
          background: #c67f7f;
        }

        .warning-indicator {
          background: #c1a46c;
        }

        .neutral-indicator {
          background: #929aa7;
        }

        .attention-item div {
          flex: 1;
        }

        .attention-item strong {
          display: block;
          color: #d9dce1;
          font-size: 10px;
          font-weight: 500;
        }

        .attention-item small {
          display: block;
          margin-top: 4px;
          color: #777d87;
          font-size: 9px;
        }

        .attention-item b {
          color: #e3e5e9;
          font-size: 15px;
          font-weight: 500;
        }

        .attention-link {
          display: block;
          margin-top: 13px;
          color: #c4cad3;
          font-size: 10px;
          text-decoration: none;
        }

        /* HÁBITOS */

        .habits-preview {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 25px;
          margin-top: 12px;
          background:
            radial-gradient(
              ellipse at 100% 0%,
              rgba(180, 185, 195, 0.09),
              transparent 55%
            ),
            #171719;
        }

        .habits-preview h3 {
          font-size: 16px;
          margin-top: 9px;
        }

        .habits-preview p {
          max-width: 510px;
          color: #92949b;
          font-size: 10px;
          line-height: 1.7;
          margin: 9px 0 16px;
        }

        .routine-secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 35px;
          padding: 0 13px;
          border: 1px solid #555b65;
          border-radius: 5px;
          background: transparent;
          color: #d2d6dc;
          font-size: 10px;
          text-decoration: none;
          cursor: pointer;
        }

        .routine-secondary-button:hover {
          background: #292c32;
        }

        .habits-preview-art {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-shrink: 0;
        }

        .habits-preview-art div {
          width: 35px;
          height: 35px;
          display: grid;
          place-items: center;
          border: 1px solid #565d68;
          border-radius: 50%;
          color: #c4cad3;
          font-size: 9px;
        }

        .habits-preview-art div:nth-child(2) {
          opacity: 0.7;
        }

        .habits-preview-art div:nth-child(3) {
          opacity: 0.4;
        }

        .habits-preview-art span {
          color: #777d87;
          font-size: 8px;
          letter-spacing: 1.3px;
          margin-left: 5px;
        }

        /* RODAPÉ */

        .routine-footer {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 13px 0;
          margin-top: 24px;
          color: #62646b;
          border-top: 1px solid #29292d;
          font-size: 8px;
          letter-spacing: 1px;
        }

        .routine-footer span:last-child {
          text-align: right;
        }

        /* FORMULÁRIO RÁPIDO */

        .quick-form {
          margin-top: 17px;
        }

        .routine-close {
          width: 30px;
          height: 30px;
          border: 1px solid #3b3e45;
          border-radius: 4px;
          background: transparent;
          color: #c6cbd3;
          font-size: 21px;
          cursor: pointer;
        }

        .quick-form-grid {
          display: grid;
          grid-template-columns:
            minmax(180px, 2fr)
            repeat(3, minmax(110px, 1fr));
          gap: 12px;
          margin-top: 15px;
        }

        .quick-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          color: #a7a8ae;
          font-size: 9px;
        }

        .quick-field input,
        .quick-field select {
          width: 100%;
          min-width: 0;
          height: 36px;
          padding: 0 10px;
          border: 1px solid #37373d;
          border-radius: 6px;
          outline: none;
          background: #101012;
          color: #f3f3f5;
          font: inherit;
          color-scheme: dark;
        }

        .quick-field input:focus,
        .quick-field select:focus {
          border-color: #aeb4be;
          box-shadow: 0 0 0 2px rgba(190, 195, 205, 0.08);
        }

        .quick-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 15px;
        }

        /* RESPONSIVIDADE */

        @media (max-width: 1100px) {
          .routine-content {
            padding: 20px 22px;
          }

          .routine-welcome-art {
            right: 0;
            opacity: 0.65;
          }

          .routine-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .quick-form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .routine-content {
            padding: 17px 13px;
          }

          .routine-welcome {
            min-height: 220px;
            padding: 22px 18px;
          }

          .routine-welcome-art {
            right: -105px;
            opacity: 0.3;
          }

          .routine-welcome h2 {
            font-size: 30px;
          }

          .routine-dashboard-grid {
            grid-template-columns: 1fr;
          }

          .routine-section-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .routine-date {
            display: none;
          }

          .routine-updated {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .routine-content {
            padding: 14px;
          }

          .routine-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .routine-metric-card {
            padding: 12px 10px;
          }

          .routine-metric-card > strong {
            font-size: 16px;
          }

          .routine-metric-top {
            font-size: 9px;
          }

          .routine-panel {
            padding: 14px;
          }

          .routine-welcome {
            padding: 22px 18px;
          }

          .routine-welcome h2 {
            font-size: 25px;
          }

          .routine-welcome p {
            font-size: 10px;
          }

          .routine-welcome-index {
            display: none;
          }

          .routine-task {
            gap: 8px;
          }

          .routine-task-info strong {
            font-size: 10px;
          }

          .routine-priority {
            font-size: 7px;
          }

          .quick-form-grid {
            grid-template-columns: 1fr;
          }

          .quick-form-actions {
            flex-direction: column-reverse;
          }

          .quick-form-actions button {
            width: 100%;
          }

          .habits-preview {
            align-items: flex-start;
            flex-direction: column;
          }

          .habits-preview-art {
            align-self: flex-start;
          }

          .routine-footer {
            flex-direction: column;
            font-size: 8px;
          }

          .routine-footer span:last-child {
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}

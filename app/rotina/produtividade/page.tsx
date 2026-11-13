
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Task = {
  id: number;
  description: string;
  done: boolean;
  date?: string;
  time?: string;
  priority?: string;
  category?: string;
  notes?: string;
  createdAt?: string;
};

type Habit = {
  id: number;
  name: string;
  category: string;
  frequency: string;
  time?: string;
  notes?: string;
  completedDates: string[];
  active: boolean;
  createdAt: string;
};

type DayData = {
  date: string;
  label: string;
  tasks: number;
  habits: number;
  total: number;
};

const TASKS_KEY = "nexo_tasks";
const HABITS_KEY = "nexo_habits";

function getLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value: string) {
  return parseDate(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function loadTasks(): Task[] {
  try {
    const stored = localStorage.getItem(TASKS_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
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

function loadHabits(): Habit[] {
  try {
    const stored = localStorage.getItem(HABITS_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.id === "number" &&
          typeof item.name === "string"
      )
      .map((item) => ({
        ...item,
        completedDates: Array.isArray(item.completedDates)
          ? item.completedDates.filter(
              (date: unknown) => typeof date === "string"
            )
          : [],
        active: item.active !== false,
      }));
  } catch {
    return [];
  }
}

export default function ProdutividadePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loaded, setLoaded] = useState(false);

  const today = getLocalDate();

  useEffect(() => {
    const syncData = () => {
      setTasks(loadTasks());
      setHabits(loadHabits());
      setLoaded(true);
    };

    syncData();

    window.addEventListener("storage", syncData);

    return () => {
      window.removeEventListener("storage", syncData);
    };
  }, []);

  const activeTasks = tasks;
  const completedTasks = activeTasks.filter((task) => task.done);
  const pendingTasks = activeTasks.filter((task) => !task.done);

  const activeHabits = habits.filter((habit) => habit.active);
  const completedHabitsToday = activeHabits.filter((habit) =>
    habit.completedDates.includes(today)
  );

  const taskRate =
    activeTasks.length > 0
      ? Math.round((completedTasks.length / activeTasks.length) * 100)
      : 0;

  const habitRate =
    activeHabits.length > 0
      ? Math.round(
          (completedHabitsToday.length / activeHabits.length) * 100
        )
      : 0;

  const overallRate =
    activeTasks.length + activeHabits.length > 0
      ? Math.round(
          ((completedTasks.length + completedHabitsToday.length) /
            (activeTasks.length + activeHabits.length)) *
            100
        )
      : 0;

  const weeklyData = useMemo<DayData[]>(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));

      const dateKey = getLocalDate(date);

      const tasksForDay = tasks.filter(
        (task) => task.done && task.date === dateKey
      ).length;

      const habitsForDay = habits
        .filter((habit) => habit.active)
        .reduce(
          (total, habit) =>
            total + (habit.completedDates.includes(dateKey) ? 1 : 0),
          0
        );

      return {
        date: dateKey,
        label: date
          .toLocaleDateString("pt-BR", {
            weekday: "short",
          })
          .replace(".", ""),
        tasks: tasksForDay,
        habits: habitsForDay,
        total: tasksForDay + habitsForDay,
      };
    });
  }, [tasks, habits]);

  const maxDailyValue = Math.max(
    1,
    ...weeklyData.map((day) => day.total)
  );

  const weeklyTasks = weeklyData.reduce(
    (total, day) => total + day.tasks,
    0
  );

  const weeklyHabits = weeklyData.reduce(
    (total, day) => total + day.habits,
    0
  );

  const weeklyTotal = weeklyTasks + weeklyHabits;

  const bestDay = weeklyData.reduce<DayData | null>(
    (best, day) => (!best || day.total > best.total ? day : best),
    null
  );

  const todayTasks = tasks.filter(
    (task) => task.done && task.date === today
  ).length;

  const todayTotal = todayTasks + completedHabitsToday.length;

  const categorySummary = useMemo(() => {
    const categories = new Map<string, number>();

    habits
      .filter((habit) => habit.active)
      .forEach((habit) => {
        categories.set(
          habit.category || "Outros",
          (categories.get(habit.category || "Outros") || 0) + 1
        );
      });

    return Array.from(categories.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [habits]);

  const upcomingTasks = tasks
    .filter((task) => !task.done && task.date)
    .filter((task) => task.date! >= today)
    .sort((a, b) => {
      const dateComparison = (a.date || "").localeCompare(b.date || "");
      if (dateComparison !== 0) return dateComparison;
      return (a.time || "").localeCompare(b.time || "");
    })
    .slice(0, 5);

  const productivityMessage =
    overallRate >= 80
      ? "Excelente ritmo! Você está mantendo uma ótima consistência."
      : overallRate >= 50
        ? "Você está avançando. Continue mantendo a constância."
        : overallRate > 0
          ? "Pequenos avanços também contam. Continue evoluindo."
          : "Comece registrando suas tarefas e hábitos para acompanhar sua evolução.";

  return (
    <div className="content productivity-page-content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DESEMPENHO PESSOAL</div>
          <h1>Produtividade</h1>
          <p>
            Acompanhe seu desempenho, sua consistência e a evolução da sua
            rotina.
          </p>
        </div>
        <div className="heading-period">
          <span className="period-dot" />
          Últimos 7 dias
        </div>
      </div>

      {!loaded ? (
        <div className="loading-state">Carregando indicadores...</div>
      ) : (
        <>
          <section className="metrics-grid">
            <article className="metric-card highlight-card">
              <div className="metric-top">
                <span className="metric-label">ÍNDICE DE CONCLUSÃO</span>
                <span className="metric-icon">◉</span>
              </div>
              <div className="metric-value">{overallRate}%</div>
              <div className="metric-description">
                Desempenho geral dos registros
              </div>
              <div className="metric-progress">
                <div
                  className="metric-progress-fill"
                  style={{ width: `${overallRate}%` }}
                />
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-label">TAREFAS CONCLUÍDAS</span>
                <span className="metric-icon">✓</span>
              </div>
              <div className="metric-value">
                {completedTasks.length}
                <small>/{activeTasks.length}</small>
              </div>
              <div className="metric-description">
                {pendingTasks.length} tarefas pendentes
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-label">HÁBITOS DE HOJE</span>
                <span className="metric-icon">↗</span>
              </div>
              <div className="metric-value">
                {completedHabitsToday.length}
                <small>/{activeHabits.length}</small>
              </div>
              <div className="metric-description">
                {habitRate}% de conclusão diária
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-label">REGISTROS HOJE</span>
                <span className="metric-icon">▦</span>
              </div>
              <div className="metric-value">{todayTotal}</div>
              <div className="metric-description">
                Tarefas e hábitos registrados como concluídos
              </div>
            </article>
          </section>

          <section className="insight-card">
            <div className="insight-symbol">✦</div>
            <div>
              <div className="insight-title">Seu ritmo atual</div>
              <p>{productivityMessage}</p>
            </div>
          </section>

          <section className="dashboard-grid">
            <article className="panel weekly-panel">
              <div className="panel-heading">
                <div>
                  <div className="section-label">ACOMPANHAMENTO</div>
                  <h2>Desempenho semanal</h2>
                  <p>Atividades concluídas por dia</p>
                </div>
                <div className="chart-total">
                  <strong>{weeklyTotal}</strong>
                  <span>conclusões</span>
                </div>
              </div>

              <div className="chart-legend">
                <span><i className="legend-task" /> Tarefas</span>
                <span><i className="legend-habit" /> Hábitos</span>
              </div>

              <div className="weekly-chart">
                {weeklyData.map((day) => {
                  const taskHeight = (day.tasks / maxDailyValue) * 100;
                  const habitHeight = (day.habits / maxDailyValue) * 100;

                  return (
                    <div className="chart-day" key={day.date}>
                      <div className="chart-value">
                        {day.total > 0 ? day.total : ""}
                      </div>
                      <div className="bar-area">
                        <div className="bar-stack">
                          <div
                            className="bar-task"
                            style={{ height: `${taskHeight}%` }}
                            title={`${day.tasks} tarefas`}
                          />
                          <div
                            className="bar-habit"
                            style={{ height: `${habitHeight}%` }}
                            title={`${day.habits} hábitos`}
                          />
                        </div>
                      </div>
                      <span className="chart-day-label">{day.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="chart-summary">
                <div>
                  <span className="summary-number">{weeklyTasks}</span>
                  <span className="summary-label">Tarefas na semana</span>
                </div>
                <div>
                  <span className="summary-number">{weeklyHabits}</span>
                  <span className="summary-label">Hábitos na semana</span>
                </div>
              </div>
              <p className="chart-note">
                As tarefas são agrupadas pela data cadastrada nelas. Os hábitos
                consideram as datas em que foram marcados como concluídos.
              </p>
            </article>

            <article className="panel today-panel">
              <div className="panel-heading">
                <div>
                  <div className="section-label">RESUMO DIÁRIO</div>
                  <h2>Hoje</h2>
                  <p>Seu progresso no dia</p>
                </div>
                <div className="today-symbol">◷</div>
              </div>

              <div className="today-progress">
                <div
                  className="progress-ring"
                  style={{
                    background: `conic-gradient(#d6d9de ${overallRate}%, #292f37 ${overallRate}% 100%)`,
                  }}
                >
                  <div className="progress-ring-inner">
                    <strong>{overallRate}%</strong>
                    <span>concluído</span>
                  </div>
                </div>
              </div>

              <div className="today-breakdown">
                <div className="breakdown-row">
                  <span className="breakdown-indicator task-indicator" />
                  <span>Tarefas concluídas hoje</span>
                  <strong>{todayTasks}</strong>
                </div>
                <div className="breakdown-row">
                  <span className="breakdown-indicator habit-indicator" />
                  <span>Hábitos concluídos hoje</span>
                  <strong>{completedHabitsToday.length}</strong>
                </div>
                <div className="breakdown-row">
                  <span className="breakdown-indicator pending-indicator" />
                  <span>Tarefas pendentes</span>
                  <strong>{pendingTasks.length}</strong>
                </div>
              </div>
            </article>
          </section>

          <section className="lower-grid">
            <article className="panel best-day-panel">
              <div className="panel-heading">
                <div>
                  <div className="section-label">CONSISTÊNCIA</div>
                  <h2>Melhor dia da semana</h2>
                  <p>Com base nos registros dos últimos 7 dias</p>
                </div>
                <span className="trophy-symbol">♛</span>
              </div>

              {bestDay && bestDay.total > 0 ? (
                <div className="best-day-content">
                  <div className="best-day-number">{bestDay.total}</div>
                  <div>
                    <strong>
                      {parseDate(bestDay.date).toLocaleDateString("pt-BR", {
                        weekday: "long",
                      })}
                    </strong>
                    <span>{formatDate(bestDay.date)}</span>
                  </div>
                </div>
              ) : (
                <div className="small-empty">
                  Ainda não há conclusões registradas nesta semana.
                </div>
              )}
            </article>

            <article className="panel categories-panel">
              <div className="panel-heading">
                <div>
                  <div className="section-label">ORGANIZAÇÃO</div>
                  <h2>Hábitos por categoria</h2>
                  <p>Distribuição dos hábitos ativos</p>
                </div>
              </div>

              {categorySummary.length > 0 ? (
                <div className="category-list">
                  {categorySummary.map((category) => (
                    <div className="category-row" key={category.name}>
                      <span>{category.name}</span>
                      <div className="category-track">
                        <div
                          className="category-fill"
                          style={{
                            width: `${
                              (category.total /
                                Math.max(
                                  ...categorySummary.map(
                                    (item) => item.total
                                  )
                                )) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                      <strong>{category.total}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="small-empty">
                  Cadastre hábitos para visualizar sua distribuição.
                </div>
              )}
            </article>
          </section>

          <section className="panel upcoming-panel">
            <div className="panel-heading upcoming-heading">
              <div>
                <div className="section-label">ORGANIZAÇÃO</div>
                <h2>Próximas tarefas</h2>
                <p>Suas próximas atividades ainda não concluídas</p>
              </div>
              <Link href="/rotina/tarefas" className="text-link">
                Ver todas <span>→</span>
              </Link>
            </div>

            {upcomingTasks.length > 0 ? (
              <div className="upcoming-list">
                {upcomingTasks.map((task) => (
                  <div className="upcoming-item" key={task.id}>
                    <div className="upcoming-check" />
                    <div className="upcoming-info">
                      <strong>{task.description}</strong>
                      <span>
                        {task.category || "Sem categoria"}
                        {task.time ? ` · ${task.time}` : ""}
                      </span>
                    </div>
                    <div className="upcoming-date">
                      {task.date === today ? "Hoje" : formatDate(task.date!)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="small-empty">
                Nenhuma tarefa futura pendente com data definida.
              </div>
            )}
          </section>

          <section className="quick-links">
            <Link href="/rotina/tarefas" className="quick-link">
              <span className="quick-link-icon">✓</span>
              <span>
                <strong>Organizar tarefas</strong>
                <small>Gerencie suas atividades</small>
              </span>
              <span className="quick-arrow">→</span>
            </Link>

            <Link href="/rotina/habitos" className="quick-link">
              <span className="quick-link-icon">↗</span>
              <span>
                <strong>Acompanhar hábitos</strong>
                <small>Construa consistência diariamente</small>
              </span>
              <span className="quick-arrow">→</span>
            </Link>

            <Link href="/rotina/planejamento" className="quick-link">
              <span className="quick-link-icon">▦</span>
              <span>
                <strong>Planejar semana</strong>
                <small>Organize seus próximos dias</small>
              </span>
              <span className="quick-arrow">→</span>
            </Link>
          </section>
        </>
      )}

      <footer className="page-footer">
        NEXO Gestão Pessoal <span>·</span> Produtividade
      </footer>

      <style jsx>{`
        .content {
          width: 100%;
          max-width: 1500px;
          padding: 34px 38px 28px;
          margin: 0 auto;
        }

        .page-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          margin-bottom: 28px;
        }

        .eyebrow,
        .section-label {
          color: #9299a3;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        h1 {
          color: #f0f1f3;
          font-size: 29px;
          letter-spacing: -0.8px;
          margin: 9px 0 7px;
          font-weight: 600;
        }

        .page-heading p,
        .panel-heading p {
          color: #858d98;
          font-size: 12px;
          margin: 0;
          line-height: 1.6;
        }

        .heading-period {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #b9bec6;
          font-size: 11px;
          border: 1px solid #303741;
          background: #151a20;
          border-radius: 6px;
          padding: 9px 12px;
          white-space: nowrap;
        }

        .period-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #c5cbd3;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }

        .metric-card {
          min-width: 0;
          background: #12161b;
          border: 1px solid #252b33;
          border-radius: 9px;
          padding: 19px 20px;
        }

        .highlight-card {
          border-color: #414954;
          background: linear-gradient(145deg, #1b2027, #12161b);
        }

        .metric-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .metric-label {
          color: #939ba6;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .metric-icon {
          color: #bfc5ce;
          font-size: 17px;
        }

        .metric-value {
          color: #f0f1f3;
          font-size: 31px;
          font-weight: 600;
          letter-spacing: -1px;
          margin-top: 16px;
        }

        .metric-value small {
          color: #737c88;
          font-size: 15px;
          font-weight: 400;
          margin-left: 4px;
        }

        .metric-description {
          color: #838b96;
          font-size: 11px;
          margin-top: 5px;
        }

        .metric-progress {
          height: 4px;
          background: #303741;
          border-radius: 10px;
          overflow: hidden;
          margin-top: 15px;
        }

        .metric-progress-fill {
          height: 100%;
          background: #d5d9df;
          border-radius: 10px;
          transition: width 0.3s ease;
        }

        .insight-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 19px;
          background: #171c22;
          border: 1px solid #2b323b;
          border-radius: 8px;
          margin-bottom: 17px;
        }

        .insight-symbol {
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          border-radius: 8px;
          display: grid;
          place-items: center;
          color: #e0e3e8;
          background: #292f38;
          font-size: 17px;
        }

        .insight-title {
          color: #e4e6e9;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .insight-card p {
          color: #929aa5;
          font-size: 11px;
          margin: 0;
          line-height: 1.5;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.65fr) minmax(280px, 1fr);
          gap: 16px;
          margin-bottom: 16px;
        }

        .panel {
          min-width: 0;
          background: #12161b;
          border: 1px solid #252b33;
          border-radius: 9px;
          padding: 21px;
        }

        .panel-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
        }

        h2 {
          color: #e8eaed;
          font-size: 15px;
          font-weight: 600;
          margin: 7px 0 5px;
        }

        .chart-total {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .chart-total strong {
          color: #e8eaed;
          font-size: 23px;
        }

        .chart-total span {
          color: #818a96;
          font-size: 10px;
        }

        .chart-legend {
          display: flex;
          gap: 17px;
          margin-top: 22px;
          color: #a1a8b1;
          font-size: 10px;
        }

        .chart-legend span {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .chart-legend i {
          width: 7px;
          height: 7px;
          border-radius: 2px;
          display: inline-block;
        }

        .legend-task {
          background: #d1d5db;
        }

        .legend-habit {
          background: #777f8b;
        }

        .weekly-chart {
          height: 185px;
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 13px;
          margin-top: 15px;
          border-bottom: 1px solid #2b323b;
        }

        .chart-day {
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .chart-value {
          height: 18px;
          color: #cbd0d7;
          font-size: 10px;
        }

        .bar-area {
          width: 100%;
          flex: 1;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }

        .bar-stack {
          width: min(29px, 75%);
          height: 100%;
          display: flex;
          flex-direction: column-reverse;
          justify-content: flex-start;
          overflow: hidden;
          border-radius: 4px 4px 0 0;
        }

        .bar-task {
          width: 100%;
          min-height: 0;
          background: #cbd0d7;
          transition: height 0.3s ease;
        }

        .bar-habit {
          width: 100%;
          min-height: 0;
          background: #777f8b;
          transition: height 0.3s ease;
        }

        .chart-day-label {
          height: 28px;
          padding-top: 9px;
          color: #929aa5;
          font-size: 10px;
          text-transform: capitalize;
        }

        .chart-summary {
          display: flex;
          gap: 35px;
          padding-top: 17px;
        }

        .chart-summary > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .summary-number {
          color: #e3e6ea;
          font-size: 17px;
          font-weight: 600;
        }

        .summary-label {
          color: #858d98;
          font-size: 10px;
        }

        .chart-note {
          color: #69727e;
          font-size: 10px;
          line-height: 1.5;
          margin: 16px 0 0;
        }

        .today-symbol {
          color: #bfc5ce;
          font-size: 22px;
        }

        .today-progress {
          display: flex;
          justify-content: center;
          padding: 25px 0 22px;
        }

        .progress-ring {
          width: 142px;
          height: 142px;
          border-radius: 50%;
          display: grid;
          place-items: center;
        }

        .progress-ring-inner {
          width: 119px;
          height: 119px;
          border-radius: 50%;
          background: #12161b;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
        }

        .progress-ring-inner strong {
          color: #f0f1f3;
          font-size: 27px;
        }

        .progress-ring-inner span {
          color: #858d98;
          font-size: 10px;
        }

        .today-breakdown {
          border-top: 1px solid #282f37;
          padding-top: 13px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .breakdown-row {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #a6adb7;
          font-size: 10px;
        }

        .breakdown-row strong {
          color: #e5e7eb;
          margin-left: auto;
          font-size: 11px;
        }

        .breakdown-indicator {
          width: 7px;
          height: 7px;
          border-radius: 2px;
        }

        .task-indicator {
          background: #cbd0d7;
        }

        .habit-indicator {
          background: #777f8b;
        }

        .pending-indicator {
          background: #555e6a;
        }

        .lower-grid {
          display: grid;
          grid-template-columns: 1fr 1.35fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .trophy-symbol {
          color: #c8cdd5;
          font-size: 23px;
        }

        .best-day-content {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-top: 25px;
        }

        .best-day-number {
          color: #f0f1f3;
          font-size: 39px;
          font-weight: 600;
          letter-spacing: -1px;
        }

        .best-day-content > div:last-child {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .best-day-content strong {
          color: #e1e4e8;
          font-size: 12px;
          text-transform: capitalize;
        }

        .best-day-content span {
          color: #858d98;
          font-size: 10px;
        }

        .category-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
          margin-top: 22px;
        }

        .category-row {
          display: grid;
          grid-template-columns: 90px minmax(30px, 1fr) 20px;
          align-items: center;
          gap: 12px;
          color: #a6adb7;
          font-size: 10px;
        }

        .category-row strong {
          color: #e3e6ea;
          text-align: right;
          font-size: 11px;
        }

        .category-track {
          height: 5px;
          border-radius: 10px;
          background: #2b323b;
          overflow: hidden;
        }

        .category-fill {
          height: 100%;
          border-radius: 10px;
          background: #bfc5ce;
        }

        .small-empty {
          color: #777f8a;
          font-size: 11px;
          line-height: 1.6;
          padding: 24px 0 8px;
        }

        .upcoming-panel {
          margin-bottom: 16px;
        }

        .upcoming-heading {
          align-items: center;
        }

        .text-link {
          color: #c4cad2;
          font-size: 10px;
          text-decoration: none;
          white-space: nowrap;
        }

        .text-link span {
          margin-left: 5px;
        }

        .upcoming-list {
          margin-top: 18px;
        }

        .upcoming-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 0;
          border-top: 1px solid #252b33;
        }

        .upcoming-check {
          width: 15px;
          height: 15px;
          border: 1px solid #626b77;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .upcoming-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .upcoming-info strong {
          color: #dfe2e6;
          font-size: 11px;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .upcoming-info span {
          color: #79828e;
          font-size: 10px;
        }

        .upcoming-date {
          color: #b8bec7;
          font-size: 10px;
          margin-left: auto;
          white-space: nowrap;
        }

        .quick-links {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 30px;
        }

        .quick-link {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
          padding: 14px;
          border: 1px solid #292f38;
          background: #14191f;
          border-radius: 8px;
          text-decoration: none;
          transition: border-color 0.2s, background 0.2s;
        }

        .quick-link:hover {
          border-color: #59616d;
          background: #191f26;
        }

        .quick-link-icon {
          width: 31px;
          height: 31px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 7px;
          background: #292f38;
          color: #d8dce2;
          font-size: 14px;
        }

        .quick-link > span:nth-child(2) {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .quick-link strong {
          color: #e0e3e7;
          font-size: 10px;
          font-weight: 600;
        }

        .quick-link small {
          color: #858d98;
          font-size: 9px;
          line-height: 1.4;
        }

        .quick-arrow {
          color: #858d98;
          margin-left: auto;
          font-size: 13px;
        }

        .loading-state {
          padding: 60px 20px;
          text-align: center;
          color: #858d98;
          font-size: 12px;
        }

        .page-footer {
          border-top: 1px solid #252b33;
          padding-top: 18px;
          color: #68717d;
          font-size: 10px;
        }

        .page-footer span {
          margin: 0 5px;
        }

        @media (max-width: 1100px) {
          .metrics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .dashboard-grid {
            grid-template-columns: minmax(0, 1.3fr) minmax(260px, 1fr);
          }

          .quick-links {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .content {
            padding: 27px 20px;
          }

          .dashboard-grid,
          .lower-grid {
            grid-template-columns: 1fr;
          }

          .page-heading {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media (max-width: 480px) {
          .metrics-grid {
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .metric-card {
            padding: 14px;
          }

          .metric-label {
            font-size: 8px;
          }

          .metric-value {
            font-size: 25px;
          }

          .metric-description {
            font-size: 9px;
          }

          .panel {
            padding: 16px;
          }

          .weekly-chart {
            gap: 6px;
          }

          .category-row {
            grid-template-columns: 75px minmax(25px, 1fr) 18px;
            gap: 8px;
          }

          .content {
            padding: 24px 14px;
          }
        }
      `}</style>
    </div>
  );
}

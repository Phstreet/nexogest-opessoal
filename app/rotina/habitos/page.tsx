
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Frequency = "Diário" | "Dias úteis" | "3 vezes por semana";

type Habit = {
  id: number;
  name: string;
  category: string;
  frequency: Frequency;
  time?: string;
  notes?: string;
  completedDates: string[];
  active: boolean;
  createdAt: string;
};

type HabitFilter = "Todos" | "Concluídos" | "Pendentes";

const HABITS_KEY = "nexo_habits";

const CATEGORIES = [
  "Trabalho",
  "Pessoal",
  "Financeiro",
  "Saúde",
  "Estudos",
  "Outros",
];

const FREQUENCIES: Frequency[] = [
  "Diário",
  "Dias úteis",
  "3 vezes por semana",
];

function getLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, amount: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);

  return getLocalDate(date);
}

function isValidHabitArray(value: unknown): value is Habit[] {
  return (
    Array.isArray(value) &&
    value.every(
      (habit) =>
        habit &&
        typeof habit.id === "number" &&
        typeof habit.name === "string" &&
        typeof habit.category === "string" &&
        Array.isArray(habit.completedDates) &&
        typeof habit.active === "boolean"
    )
  );
}

function loadHabits(): Habit[] {
  try {
    const saved = localStorage.getItem(HABITS_KEY);

    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);

    return isValidHabitArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getStreak(habit: Habit, today: string) {
  const completed = new Set(habit.completedDates);

  let currentDate = completed.has(today) ? today : addDays(today, -1);
  let streak = 0;

  while (completed.has(currentDate)) {
    streak++;
    currentDate = addDays(currentDate, -1);
  }

  return streak;
}

function getWeekProgress(habit: Habit, today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const current = new Date(year, month - 1, day);
  const dayOfWeek = current.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = addDays(today, -mondayOffset);
  let completed = 0;

  for (let index = 0; index < 7; index++) {
    const date = addDays(monday, index);

    if (habit.completedDates.includes(date)) {
      completed++;
    }
  }

  return completed;
}

export default function HabitosPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Pessoal");
  const [frequency, setFrequency] = useState<Frequency>("Diário");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  const [filter, setFilter] = useState<HabitFilter>("Todos");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [search, setSearch] = useState("");

  const today = getLocalDate();

  const loadData = useCallback(() => {
    setHabits(loadHabits());
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadData();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === HABITS_KEY) {
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
      localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
    } catch (error) {
      console.error("Erro ao salvar hábitos:", error);
    }
  }, [habits, loaded]);

  const activeHabits = useMemo(
    () => habits.filter((habit) => habit.active),
    [habits]
  );

  const metrics = useMemo(() => {
    const completed = activeHabits.filter((habit) =>
      habit.completedDates.includes(today)
    ).length;

    const pending = activeHabits.length - completed;

    const percentage =
      activeHabits.length > 0
        ? Math.round((completed / activeHabits.length) * 100)
        : 0;

    return {
      total: activeHabits.length,
      completed,
      pending,
      percentage,
    };
  }, [activeHabits, today]);

  const filteredHabits = useMemo(() => {
    return activeHabits
      .filter((habit) => {
        const completedToday = habit.completedDates.includes(today);

        if (filter === "Concluídos" && !completedToday) return false;
        if (filter === "Pendentes" && completedToday) return false;

        if (
          categoryFilter !== "Todas" &&
          habit.category !== categoryFilter
        ) {
          return false;
        }

        if (
          search.trim() &&
          !habit.name.toLowerCase().includes(search.trim().toLowerCase()) &&
          !(habit.notes || "")
            .toLowerCase()
            .includes(search.trim().toLowerCase())
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aCompleted = a.completedDates.includes(today);
        const bCompleted = b.completedDates.includes(today);

        if (aCompleted !== bCompleted) {
          return aCompleted ? 1 : -1;
        }

        return a.name.localeCompare(b.name);
      });
  }, [activeHabits, filter, categoryFilter, search, today]);

  const resetForm = () => {
    setName("");
    setCategory("Pessoal");
    setFrequency("Diário");
    setTime("");
    setNotes("");
    setEditingId(null);
    setShowForm(false);
  };

  const openNewHabit = () => {
    resetForm();
    setShowForm(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) return;

    if (editingId !== null) {
      setHabits((current) =>
        current.map((habit) =>
          habit.id === editingId
            ? {
                ...habit,
                name: name.trim(),
                category,
                frequency,
                time: time || undefined,
                notes: notes.trim(),
              }
            : habit
        )
      );
    } else {
      const newHabit: Habit = {
        id: Date.now(),
        name: name.trim(),
        category,
        frequency,
        time: time || undefined,
        notes: notes.trim(),
        completedDates: [],
        active: true,
        createdAt: new Date().toISOString(),
      };

      setHabits((current) => [...current, newHabit]);
    }

    resetForm();
  };

  const editHabit = (habit: Habit) => {
    setEditingId(habit.id);
    setName(habit.name);
    setCategory(habit.category);
    setFrequency(habit.frequency || "Diário");
    setTime(habit.time || "");
    setNotes(habit.notes || "");
    setShowForm(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleCompletion = (id: number) => {
    setHabits((current) =>
      current.map((habit) => {
        if (habit.id !== id) return habit;

        const completed = habit.completedDates.includes(today);

        return {
          ...habit,
          completedDates: completed
            ? habit.completedDates.filter((date) => date !== today)
            : [...habit.completedDates, today],
        };
      })
    );
  };

  const deleteHabit = (id: number) => {
    const confirmed = window.confirm(
      "Tem certeza que deseja excluir este hábito e seu histórico?"
    );

    if (!confirmed) return;

    setHabits((current) => current.filter((habit) => habit.id !== id));
  };

  const toggleActive = (id: number) => {
    setHabits((current) =>
      current.map((habit) =>
        habit.id === id ? { ...habit, active: !habit.active } : habit
      )
    );
  };

  const filters: HabitFilter[] = ["Todos", "Pendentes", "Concluídos"];

  return (
    <div className="content">
      <section className="page-heading">
        <div>
          <div className="eyebrow">DESENVOLVIMENTO PESSOAL</div>
          <h1>Meus hábitos</h1>
          <p>
            Construa bons hábitos, acompanhe sua consistência e evolua
            um dia de cada vez.
          </p>
        </div>

        <button className="primary-button" onClick={openNewHabit}>
          <span>＋</span> Novo hábito
        </button>
      </section>

      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Hábitos ativos</span>
            <span className="metric-icon">▤</span>
          </div>
          <div className="metric-value">{metrics.total}</div>
          <div className="metric-description">Hábitos em acompanhamento</div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Concluídos hoje</span>
            <span className="metric-icon">✓</span>
          </div>
          <div className="metric-value">{metrics.completed}</div>
          <div className="metric-description">Hábitos realizados hoje</div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Pendentes hoje</span>
            <span className="metric-icon">◷</span>
          </div>
          <div className="metric-value">{metrics.pending}</div>
          <div className="metric-description">Ainda precisam ser realizados</div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Desempenho diário</span>
            <span className="metric-icon">%</span>
          </div>
          <div className="metric-value">{metrics.percentage}%</div>
          <div className="metric-description">Percentual de conclusão</div>
        </div>
      </section>

      <section className="progress-section">
        <div className="progress-info">
          <div>
            <span className="section-label">CONSISTÊNCIA DIÁRIA</span>
            <h2>Seu progresso de hoje</h2>
            <p>
              Você realizou {metrics.completed} de {metrics.total} hábitos
              ativos.
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
          <span>{metrics.completed} realizados</span>
          <span>{metrics.pending} restantes</span>
        </div>
      </section>

      {showForm && (
        <section className="form-card" id="habit-form">
          <div className="form-heading">
            <div>
              <span className="section-label">
                {editingId !== null ? "EDIÇÃO" : "NOVO REGISTRO"}
              </span>
              <h2>
                {editingId !== null
                  ? "Editar hábito"
                  : "Cadastrar hábito"}
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
              <label>Nome do hábito *</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Treinar musculação"
                required
                autoFocus
              />
            </div>

            <div className="form-grid">
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

              <div className="form-field">
                <label>Frequência</label>
                <select
                  value={frequency}
                  onChange={(event) =>
                    setFrequency(event.target.value as Frequency)
                  }
                >
                  {FREQUENCIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Horário previsto</label>
                <input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </div>
            </div>

            <div className="form-field full-field">
              <label>Observações</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Adicione detalhes ou metas para este hábito..."
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
                  : "Cadastrar hábito"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="habits-section">
        <div className="habits-heading">
          <div>
            <span className="section-label">ACOMPANHAMENTO</span>
            <h2>Minha rotina de hábitos</h2>
            <p>
              Marque os hábitos realizados e acompanhe sua evolução.
            </p>
          </div>

          <div className="habit-count">
            {filteredHabits.length}{" "}
            {filteredHabits.length === 1 ? "hábito" : "hábitos"}
          </div>
        </div>

        <div className="search-container">
          <span className="search-icon">⌕</span>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar hábito ou observação..."
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
          </div>
        </div>

        <div className="habit-list">
          {!loaded ? (
            <div className="empty-state">
              <div className="empty-icon">◷</div>
              <h3>Carregando hábitos...</h3>
            </div>
          ) : filteredHabits.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✧</div>
              <h3>Nenhum hábito encontrado</h3>
              <p>
                Cadastre um novo hábito ou altere os filtros para visualizar
                seus registros.
              </p>

              <button
                className="secondary-button"
                onClick={() => {
                  setFilter("Todos");
                  setCategoryFilter("Todas");
                  setSearch("");
                }}
                type="button"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            filteredHabits.map((habit) => {
              const completedToday =
                habit.completedDates.includes(today);

              const streak = getStreak(habit, today);
              const weekProgress = getWeekProgress(habit, today);

              return (
                <article
                  className={`habit-item ${
                    completedToday ? "habit-completed" : ""
                  }`}
                  key={habit.id}
                >
                  <button
                    className={`habit-check ${
                      completedToday ? "checked" : ""
                    }`}
                    onClick={() => toggleCompletion(habit.id)}
                    type="button"
                    aria-label={
                      completedToday
                        ? "Desmarcar hábito"
                        : "Marcar hábito como concluído"
                    }
                  >
                    {completedToday ? "✓" : ""}
                  </button>

                  <div className="habit-content">
                    <div className="habit-title-row">
                      <h3>{habit.name}</h3>

                      {completedToday && (
                        <span className="completed-tag">Concluído</span>
                      )}
                    </div>

                    <div className="habit-meta">
                      <span>{habit.category}</span>
                      <span className="meta-separator">•</span>
                      <span>{habit.frequency}</span>

                      {habit.time && (
                        <>
                          <span className="meta-separator">•</span>
                          <span>{habit.time}</span>
                        </>
                      )}
                    </div>

                    <div className="habit-stats">
                      <span className="streak-indicator">
                        <span>↗</span> {streak}{" "}
                        {streak === 1 ? "dia seguido" : "dias seguidos"}
                      </span>
                      <span className="week-indicator">
                        Semana: {weekProgress}/7
                      </span>
                    </div>

                    {habit.notes && (
                      <p className="habit-notes">{habit.notes}</p>
                    )}
                  </div>

                  <div className="habit-actions">
                    <button
                      className="icon-action"
                      onClick={() => editHabit(habit)}
                      title="Editar hábito"
                      type="button"
                    >
                      ✎
                    </button>

                    <button
                      className="icon-action"
                      onClick={() => toggleActive(habit.id)}
                      title="Desativar hábito"
                      type="button"
                    >
                      ◷
                    </button>

                    <button
                      className="icon-action delete-action"
                      onClick={() => deleteHabit(habit.id)}
                      title="Excluir hábito"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {habits.some((habit) => !habit.active) && (
        <section className="inactive-section">
          <div className="inactive-heading">
            <div>
              <span className="section-label">ARQUIVO</span>
              <h2>Hábitos desativados</h2>
            </div>
            <span className="inactive-count">
              {habits.filter((habit) => !habit.active).length}
            </span>
          </div>

          {habits
            .filter((habit) => !habit.active)
            .map((habit) => (
              <div className="inactive-item" key={habit.id}>
                <div>
                  <strong>{habit.name}</strong>
                  <span>{habit.category}</span>
                </div>

                <div className="inactive-actions">
                  <button
                    type="button"
                    onClick={() => toggleActive(habit.id)}
                  >
                    Reativar
                  </button>
                  <button
                    type="button"
                    className="delete-action"
                    onClick={() => deleteHabit(habit.id)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
        </section>
      )}

      <footer className="page-footer">
        <span>NEXO · GESTÃO PESSOAL</span>
        <span>Pequenos hábitos, grandes resultados.</span>
      </footer>

      <style jsx>{`
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
        .habits-heading p {
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
        .habits-heading h2,
        .form-heading h2,
        .inactive-heading h2 {
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
          grid-template-columns: repeat(3, minmax(0, 1fr));
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

        .habits-section,
        .inactive-section {
          padding: 23px;
          background: #12161b;
          border: 1px solid #252b33;
          border-radius: 8px;
        }

        .habits-heading,
        .inactive-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 20px;
        }

        .habit-count,
        .inactive-count {
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

        .select-filters select {
          width: auto;
          min-width: 160px;
          min-height: 32px;
          color: #aeb5bf;
          font-size: 10px;
        }

        .habit-list {
          display: flex;
          flex-direction: column;
        }

        .habit-item {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 17px 2px;
          border-bottom: 1px solid #272e36;
        }

        .habit-item:last-child {
          border-bottom: 0;
        }

        .habit-check {
          width: 21px;
          height: 21px;
          min-width: 21px;
          display: grid;
          place-items: center;
          margin-top: 2px;
          border: 1px solid #59636f;
          border-radius: 6px;
          background: transparent;
          color: #11151a;
          font-size: 13px;
          font-weight: 800;
          transition: 0.2s;
        }

        .habit-check:hover {
          border-color: #c1c8d0;
        }

        .habit-check.checked {
          background: #aeb8c4;
          border-color: #aeb8c4;
        }

        .habit-content {
          flex: 1;
          min-width: 0;
        }

        .habit-title-row {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-wrap: wrap;
        }

        .habit-title-row h3 {
          margin: 0;
          color: #e2e5e9;
          font-size: 12px;
          font-weight: 650;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .habit-completed .habit-title-row h3 {
          color: #aeb6c1;
        }

        .completed-tag {
          padding: 4px 7px;
          border-radius: 4px;
          background: #25372f;
          color: #a2cbb1;
          font-size: 9px;
          font-weight: 650;
        }

        .habit-meta {
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

        .habit-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          margin-top: 9px;
          color: #8d97a3;
          font-size: 10px;
        }

        .streak-indicator span {
          color: #d1a875;
          font-weight: 800;
        }

        .week-indicator {
          color: #858f9b;
        }

        .habit-notes {
          margin: 9px 0 0;
          color: #737e8a;
          font-size: 10px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .habit-actions {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .icon-action {
          width: 29px;
          height: 29px;
          border: 1px solid transparent;
          border-radius: 5px;
          background: transparent;
          color: #a0a8b3;
          font-size: 17px;
        }

        .icon-action:hover {
          background: #252c34;
          border-color: #39424e;
        }

        .delete-action {
          color: #e19a94 !important;
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

        .inactive-section {
          margin-top: 18px;
        }

        .inactive-heading {
          margin-bottom: 10px;
        }

        .inactive-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 13px 2px;
          border-top: 1px solid #272e36;
        }

        .inactive-item > div:first-child {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .inactive-item strong {
          color: #c0c6ce;
          font-size: 11px;
        }

        .inactive-item span {
          color: #737e8a;
          font-size: 10px;
        }

        .inactive-actions {
          display: flex;
          gap: 7px;
        }

        .inactive-actions button {
          padding: 6px 9px;
          border: 1px solid #343c46;
          border-radius: 4px;
          background: #1a2027;
          color: #c4cbd4;
          font-size: 10px;
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

          .select-filters,
          .select-filters select {
            width: 100%;
          }

          .habits-section {
            padding: 16px;
          }

          .habit-item {
            gap: 9px;
          }

          .habit-actions {
            gap: 2px;
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

          .habit-item {
            flex-wrap: wrap;
          }

          .habit-content {
            width: calc(100% - 45px);
          }

          .habit-actions {
            margin-left: 34px;
          }

          .inactive-item {
            align-items: flex-start;
            flex-direction: column;
          }

          .page-footer {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

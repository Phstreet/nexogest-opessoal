"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRoutineCollection } from "@/hooks/useRoutineCollection";
import { useCloudFinanceCollections } from "@/hooks/useCloudFinanceCollections";
import {
  isValidRoutineTask,
  isValidRoutineHabit,
} from "@/lib/routine/types";
import type { RoutineTask, RoutineHabit } from "@/lib/routine/types";

type TrackingType = "numeric" | "steps" | "frequency" | "completion";
type GoalStatus = "active" | "paused" | "completed";
type Direction = "increase" | "decrease";
type GoalStep = { id: string; title: string; done: boolean; createdAt: string };
type GoalHistory = { date: string; value: number; note?: string };
type Goal = {
  id: string;
  title: string;
  category: string;
  description?: string;
  trackingType?: TrackingType;
  unit: string;
  target: number;
  current: number;
  startValue?: number;
  direction?: Direction;
  frequencyTarget?: number;
  frequencyLogs?: string[];
  steps?: GoalStep[];
  progressHistory?: GoalHistory[];
  parentGoalId?: string;
  linkedReserveId?: number;
  priority?: "Baixa" | "Média" | "Alta" | "Urgente";
  status?: GoalStatus;
  deadline: string;
  createdAt: string;
  updatedAt?: string;
};

type Filter = "all" | "active" | "paused" | "completed";
type CategoryFilter = "Todas" | string;

const CATEGORIES = [
  "Saúde e corpo",
  "Estudos e conhecimento",
  "Carreira e profissão",
  "Financeiro",
  "Projetos pessoais",
  "Desenvolvimento pessoal",
  "Relacionamentos e família",
  "Experiências e lazer",
];

const TRACKING_OPTIONS: { value: TrackingType; label: string; hint: string }[] = [
  { value: "numeric", label: "Numérico", hint: "Peso, dinheiro, horas, distância ou quantidade" },
  { value: "steps", label: "Por etapas", hint: "Cursos, projetos, certificações e processos" },
  { value: "frequency", label: "Por frequência", hint: "Atividades realizadas por semana" },
  { value: "completion", label: "Conclusão", hint: "Um objetivo com resultado final" },
];

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidGoal(value: unknown): value is Goal {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0 &&
    typeof value.title === "string" && value.title.trim().length > 0 &&
    typeof value.category === "string" && typeof value.unit === "string" &&
    typeof value.target === "number" && Number.isFinite(value.target) &&
    typeof value.current === "number" && Number.isFinite(value.current) &&
    typeof value.deadline === "string" && typeof value.createdAt === "string";
}

function parseNumber(value: string) {
  const raw = value.trim().replace(/\s/g, "");
  if (!raw) return NaN;
  return Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTracking(goal: Goal): TrackingType {
  return goal.trackingType || "numeric";
}

function normalizeStatus(goal: Goal): GoalStatus {
  if (goal.status) return goal.status;
  if (normalizeTracking(goal) === "numeric" && goal.target > 0 && goal.current >= goal.target) return "completed";
  return "active";
}

function getWeekStart(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = start.getDay() === 0 ? 6 : start.getDay() - 1;
  start.setDate(start.getDate() - offset);
  return localDateKey(start);
}

function daysFrom(dateKey: string) {
  const a = new Date(`${dateKey}T12:00:00`).getTime();
  const b = new Date(`${localDateKey()}T12:00:00`).getTime();
  return Math.round((a - b) / 86400000);
}

function formatNumber(value: number, unit: string) {
  const safe = Number.isFinite(value) ? value : 0;
  if (unit === "R$") return safe.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatted = safe.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return unit === "%" ? `${formatted}%` : unit ? `${formatted} ${unit}` : formatted;
}

function reserveBalance(reserve: { initialBalance: number; id: number }, movements: { reserveId: number; amount: number; type: string }[]) {
  return movements.filter((item) => item.reserveId === reserve.id).reduce((total, item) => {
    if (item.type === "Aporte" || item.type === "Rendimento" || item.type === "Ajuste") return total + item.amount;
    if (item.type === "Resgate") return total - item.amount;
    return total;
  }, reserve.initialBalance);
}

function percentFor(goal: Goal, current: number, target: number) {
  const type = normalizeTracking(goal);
  if (type === "completion") return normalizeStatus(goal) === "completed" ? 100 : 0;
  if (type === "steps") {
    const steps = goal.steps || [];
    return steps.length ? Math.round((steps.filter((step) => step.done).length / steps.length) * 100) : 0;
  }
  if (type === "frequency") {
    const start = getWeekStart();
    const count = (goal.frequencyLogs || []).filter((date) => date >= start && date <= localDateKey()).length;
    return Math.min(100, Math.round((count / Math.max(1, goal.frequencyTarget || 1)) * 100));
  }
  if (goal.direction === "decrease") {
    const initial = goal.startValue ?? goal.current;
    const distance = initial - target;
    if (distance <= 0) return current <= target ? 100 : 0;
    return Math.max(0, Math.min(100, Math.round(((initial - current) / distance) * 100)));
  }
  const initial = goal.startValue ?? 0;
  const distance = target - initial;
  if (distance <= 0) return current >= target ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round(((current - initial) / distance) * 100)));
}

function isReached(goal: Goal, current: number, target: number) {
  if (normalizeStatus(goal) === "completed") return true;
  if (normalizeTracking(goal) === "numeric") {
    return goal.direction === "decrease" ? current <= target : current >= target;
  }
  if (normalizeTracking(goal) === "steps") {
    const steps = goal.steps || [];
    return steps.length > 0 && steps.every((step) => step.done);
  }
  return false;
}

function categoryForRoutine(category: string) {
  if (category.includes("Saúde")) return "Saúde";
  if (category.includes("Estudos")) return "Estudos";
  if (category === "Financeiro") return "Financeiro";
  if (category.includes("Carreira")) return "Trabalho";
  return "Pessoal";
}

function Icon({ name }: { name: "target" | "check" | "chart" | "calendar" | "plus" | "flag" | "pause" | "play" | "trash" | "list" | "book" | "heart" | "wallet" | "arrow" | "repeat" }) {
  const paths: Record<string, React.ReactNode> = {
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-7" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    flag: <path d="M5 21V4h12l-2 4 2 4H5" />,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    play: <path d="m8 5 11 7-11 7z" />,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" /></>,
    list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z" /><path d="M4 5.5v14A2.5 2.5 0 0 1 6.5 17H20" /></>,
    heart: <path d="M20.8 8.8c0 5.5-8.8 11-8.8 11s-8.8-5.5-8.8-11A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6z" />,
    wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 15h2" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    repeat: <><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" /></>,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function MetasCenter() {
  const { items: goals, setItems: setGoals, loaded, safeToSave, storageError } =
    useRoutineCollection<Goal>("nexo_personal_goals", isValidGoal);
  const { items: tasks, setItems: setTasks, loaded: tasksLoaded, safeToSave: tasksSafe } =
    useRoutineCollection<RoutineTask>("nexo_tasks", isValidRoutineTask);
  const { items: habits, setItems: setHabits, loaded: habitsLoaded, safeToSave: habitsSafe } =
    useRoutineCollection<RoutineHabit>("nexo_habits", isValidRoutineHabit);
  const finance = useCloudFinanceCollections();

  const [filter, setFilter] = useState<Filter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("Todas");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [trackingType, setTrackingType] = useState<TrackingType>("numeric");
  const [unit, setUnit] = useState("kg");
  const [direction, setDirection] = useState<Direction>("increase");
  const [startValue, setStartValue] = useState("0");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [frequencyTarget, setFrequencyTarget] = useState("3");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<Goal["priority"]>("Média");
  const [parentGoalId, setParentGoalId] = useState("");
  const [linkedReserveId, setLinkedReserveId] = useState("");
  const [formError, setFormError] = useState("");
  const [stepInputs, setStepInputs] = useState<Record<string, string>>({});
  const [valueInputs, setValueInputs] = useState<Record<string, string>>({});
  const [newStepInput, setNewStepInput] = useState("");

  const canSave = safeToSave && tasksLoaded && tasksSafe && habitsLoaded && habitsSafe;
  const today = localDateKey();
  const reserveById = useMemo(() => new Map(finance.reserves.map((reserve) => [reserve.id, reserve])), [finance.reserves]);

  function currentFor(goal: Goal) {
    if (goal.linkedReserveId) {
      const reserve = reserveById.get(goal.linkedReserveId);
      if (reserve) return reserveBalance(reserve, finance.reserveMovements);
    }
    return goal.current;
  }

  function targetFor(goal: Goal) {
    if (goal.linkedReserveId) {
      const reserve = reserveById.get(goal.linkedReserveId);
      if (reserve) return reserve.targetAmount;
    }
    return goal.target;
  }

  const active = goals.filter((goal) => normalizeStatus(goal) === "active" && !isReached(goal, currentFor(goal), targetFor(goal)));
  const paused = goals.filter((goal) => normalizeStatus(goal) === "paused");
  const completed = goals.filter((goal) => normalizeStatus(goal) === "completed" || isReached(goal, currentFor(goal), targetFor(goal)));
  const overdue = active.filter((goal) => goal.deadline && daysFrom(goal.deadline) < 0);
  const categories = useMemo(() => ["Todas", ...new Set([...CATEGORIES, ...goals.map((goal) => goal.category)])], [goals]);
  const visible = useMemo(() => goals.filter((goal) => {
    const status = normalizeStatus(goal);
    const reached = isReached(goal, currentFor(goal), targetFor(goal));
    const matchesStatus = filter === "all" || (filter === "active" && status === "active" && !reached) ||
      (filter === "paused" && status === "paused") || (filter === "completed" && (status === "completed" || reached));
    const matchesCategory = categoryFilter === "Todas" || goal.category === categoryFilter;
    const query = search.trim().toLocaleLowerCase("pt-BR");
    const matchesSearch = !query || goal.title.toLocaleLowerCase("pt-BR").includes(query) ||
      (goal.description || "").toLocaleLowerCase("pt-BR").includes(query);
    return matchesStatus && matchesCategory && matchesSearch;
  }).sort((a, b) => {
    const aParent = a.parentGoalId ? 1 : 0;
    const bParent = b.parentGoalId ? 1 : 0;
    return aParent - bParent || (a.deadline || "9999-99-99").localeCompare(b.deadline || "9999-99-99");
  }), [goals, filter, categoryFilter, search, reserveById, finance.reserveMovements]);

  const avgProgress = goals.length ? Math.round(goals.reduce((sum, goal) => sum + percentFor(goal, currentFor(goal), targetFor(goal)), 0) / goals.length) : 0;
  const nextDeadline = active.filter((goal) => goal.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline))[0];

  function resetForm() {
    setEditingId(null); setTitle(""); setDescription(""); setCategory(CATEGORIES[0]); setCustomCategory("");
    setTrackingType("numeric"); setUnit("kg"); setDirection("increase"); setStartValue("0");
    setTarget(""); setCurrent("0"); setFrequencyTarget("3"); setDeadline(""); setPriority("Média");
    setParentGoalId(""); setLinkedReserveId(""); setFormError(""); setShowForm(false);
  }

  function openCreate(parentId = "") {
    resetForm();
    setParentGoalId(parentId);
    setShowForm(true);
  }

  function openEdit(goal: Goal) {
    setEditingId(goal.id); setTitle(goal.title); setDescription(goal.description || "");
    setCategory(CATEGORIES.includes(goal.category) ? goal.category : "Personalizada");
    setCustomCategory(CATEGORIES.includes(goal.category) ? "" : goal.category);
    setTrackingType(normalizeTracking(goal)); setUnit(goal.unit || "unidades");
    setDirection(goal.direction || "increase"); setStartValue(String(goal.startValue ?? 0));
    setTarget(String(goal.target || "")); setCurrent(String(goal.current ?? 0));
    setFrequencyTarget(String(goal.frequencyTarget || 3)); setDeadline(goal.deadline || "");
    setPriority(goal.priority || "Média"); setParentGoalId(goal.parentGoalId || "");
    setLinkedReserveId(goal.linkedReserveId ? String(goal.linkedReserveId) : "");
    setShowForm(true); setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) { setFormError("Aguarde a sincronização dos dados antes de salvar."); return; }
    if (!title.trim()) { setFormError("Informe o nome do objetivo."); return; }
    const finalCategory = category === "Personalizada" ? customCategory.trim() : category;
    if (!finalCategory) { setFormError("Informe o nome da categoria personalizada."); return; }
    if (parentGoalId && parentGoalId === editingId) { setFormError("Um objetivo não pode ser pai dele mesmo."); return; }

    const linkedId = finalCategory === "Financeiro" && linkedReserveId ? Number(linkedReserveId) : undefined;
    const linkedReserve = linkedId ? reserveById.get(linkedId) : undefined;
    const parsedTarget = trackingType === "numeric" ? (linkedReserve ? linkedReserve.targetAmount : parseNumber(target)) : 0;
    const parsedCurrent = trackingType === "numeric" ? (linkedReserve ? reserveBalance(linkedReserve, finance.reserveMovements) : parseNumber(current)) : 0;
    const parsedStart = trackingType === "numeric" ? parseNumber(startValue || "0") : 0;
    const parsedFrequency = trackingType === "frequency" ? parseNumber(frequencyTarget) : 0;

    if (trackingType === "numeric" && (!Number.isFinite(parsedTarget) || parsedTarget <= 0)) { setFormError("Informe um valor-alvo maior que zero."); return; }
    if (trackingType === "numeric" && (!Number.isFinite(parsedCurrent) || parsedCurrent < 0)) { setFormError("Informe um valor atual válido."); return; }
    if (trackingType === "numeric" && !linkedReserve && direction === "decrease" && parsedStart <= parsedTarget) { setFormError("Para um objetivo de redução, o valor inicial precisa ser maior que o valor desejado."); return; }
    if (trackingType === "numeric" && !linkedReserve && direction === "increase" && parsedStart >= parsedTarget) { setFormError("O valor inicial precisa ser menor que o valor desejado."); return; }
    if (trackingType === "frequency" && (!Number.isFinite(parsedFrequency) || parsedFrequency < 1 || parsedFrequency > 7)) { setFormError("Informe uma frequência entre 1 e 7 vezes por semana."); return; }

    const old = editingId ? goals.find((goal) => goal.id === editingId) : undefined;
    const goal: Goal = {
      id: editingId || makeId(),
      title: title.trim(),
      category: finalCategory,
      description: description.trim(),
      trackingType,
      unit: linkedReserve ? "R$" : trackingType === "numeric" ? unit : trackingType === "frequency" ? "vezes/semana" : trackingType === "steps" ? "etapas" : "",
      target: parsedTarget,
      current: parsedCurrent,
      startValue: linkedReserve ? 0 : parsedStart,
      direction: linkedReserve ? "increase" : direction,
      frequencyTarget: parsedFrequency || undefined,
      frequencyLogs: old?.frequencyLogs || [],
      steps: old?.steps || [],
      progressHistory: old?.progressHistory || [],
      parentGoalId: parentGoalId || undefined,
      linkedReserveId: linkedId,
      priority,
      status: old?.status || "active",
      deadline,
      createdAt: old?.createdAt || today,
      updatedAt: new Date().toISOString(),
    };

    setGoals((previous) => editingId ? previous.map((item) => item.id === editingId ? goal : item) : [...previous, goal]);
    resetForm();
  }

  function updateGoal(id: string, updater: (goal: Goal) => Goal) {
    if (!canSave) return;
    setGoals((previous) => previous.map((goal) => goal.id === id ? updater(goal) : goal));
  }

  function addNumericProgress(goal: Goal) {
    const value = parseNumber(valueInputs[goal.id] || "");
    if (!Number.isFinite(value) || value < 0) return;
    if (goal.direction === "decrease" && value > (goal.startValue ?? goal.current)) {
      setValueInputs((previous) => ({ ...previous, [goal.id]: "" }));
      return;
    }
    updateGoal(goal.id, (item) => ({
      ...item,
      current: value,
      progressHistory: [...(item.progressHistory || []), { date: today, value }],
      updatedAt: new Date().toISOString(),
    }));
    setValueInputs((previous) => ({ ...previous, [goal.id]: "" }));
  }

  function addStep(goal: Goal) {
    const value = (stepInputs[goal.id] || "").trim();
    if (!value) return;
    updateGoal(goal.id, (item) => ({ ...item, steps: [...(item.steps || []), { id: makeId(), title: value, done: false, createdAt: today }] }));
    setStepInputs((previous) => ({ ...previous, [goal.id]: "" }));
  }

  function toggleStep(goal: Goal, stepId: string) {
    updateGoal(goal.id, (item) => ({
      ...item,
      steps: (item.steps || []).map((step) => step.id === stepId ? { ...step, done: !step.done } : step),
    }));
  }

  function logFrequency(goal: Goal) {
    const logs = goal.frequencyLogs || [];
    if (logs.includes(today)) return;
    updateGoal(goal.id, (item) => ({ ...item, frequencyLogs: [...(item.frequencyLogs || []), today] }));
  }

  function changeStatus(goal: Goal, status: GoalStatus) {
    updateGoal(goal.id, (item) => ({ ...item, status, updatedAt: new Date().toISOString() }));
  }

  function completeGoal(goal: Goal) {
    updateGoal(goal.id, (item) => ({ ...item, status: "completed", updatedAt: new Date().toISOString() }));
  }

  function deleteGoal(goal: Goal) {
    if (!canSave || !window.confirm(`Excluir "${goal.title}"? Os subobjetivos serão mantidos como objetivos independentes.`)) return;
    setGoals((previous) => previous.filter((item) => item.id !== goal.id).map((item) => item.parentGoalId === goal.id ? { ...item, parentGoalId: undefined } : item));
  }

  function createLinkedTask(goal: Goal) {
    if (!canSave) return;
    const task: RoutineTask = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      description: `Objetivo: ${goal.title}`,
      done: false,
      date: goal.deadline || today,
      priority: goal.priority || "Média",
      category: categoryForRoutine(goal.category),
      notes: `Tarefa vinculada ao objetivo: ${goal.title}`,
      createdAt: new Date().toISOString(),
      goalId: goal.id,
    };
    setTasks((previous) => [...previous, task]);
  }

  function createLinkedHabit(goal: Goal) {
    if (!canSave) return;
    const habit: RoutineHabit = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: `Acompanhar: ${goal.title}`,
      category: categoryForRoutine(goal.category),
      frequency: "Diário",
      notes: `Hábito vinculado ao objetivo: ${goal.title}`,
      completedDates: [],
      active: true,
      createdAt: new Date().toISOString(),
      goalId: goal.id,
    };
    setHabits((previous) => [...previous, habit]);
  }

  const tabs: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "Todos", count: goals.length },
    { value: "active", label: "Em andamento", count: active.length },
    { value: "paused", label: "Pausados", count: paused.length },
    { value: "completed", label: "Concluídos", count: completed.length },
  ];

  return (
    <div className="objectives-page">
      <section className="objectives-hero">
        <div>
          <span className="eyebrow">NEXO / DESENVOLVIMENTO PESSOAL</span>
          <h1>Meus objetivos</h1>
          <p>Organize o que deseja conquistar e acompanhe sua evolução em todas as áreas da vida.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => openCreate()}>
          <Icon name="plus" /> Novo objetivo
        </button>
      </section>

      <div className="objectives-sync">
        <span className={safeToSave && tasksSafe && habitsSafe ? "sync-dot ready" : "sync-dot"} />
        {loaded && tasksLoaded && habitsLoaded ? safeToSave && tasksSafe && habitsSafe ? "Dados sincronizados com a nuvem" : "Sincronização indisponível" : "Sincronizando dados…"}
        {finance.error && <span className="sync-warning"> · Integração financeira indisponível: {finance.error}</span>}
      </div>
      {storageError && <div className="objectives-error" role="alert">{storageError}</div>}

      <section className="objectives-metrics">
        <article><span>Objetivos ativos</span><strong>{active.length}</strong><small>Em andamento</small></article>
        <article><span>Concluídos</span><strong>{completed.length}</strong><small>Conquistas registradas</small></article>
        <article><span>Progresso médio</span><strong>{avgProgress}%</strong><small>Considerando todos os objetivos</small></article>
        <article><span>Fora do prazo</span><strong className={overdue.length ? "negative" : ""}>{overdue.length}</strong><small>Precisam de atenção</small></article>
      </section>

      {showForm && (
        <section className="objective-form-card" id="objective-form">
          <header>
            <div><span className="eyebrow">{editingId ? "ATUALIZAÇÃO" : "NOVO REGISTRO"}</span><h2>{editingId ? "Editar objetivo" : "Criar objetivo"}</h2></div>
            <button className="close-button" type="button" onClick={resetForm}>×</button>
          </header>
          <form onSubmit={submitGoal}>
            <div className="form-grid">
              <label className="wide"><span>Nome do objetivo *</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Concluir curso de Excel avançado" required /></label>
              <label><span>Categoria *</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}<option value="Personalizada">Personalizada</option></select></label>
              {category === "Personalizada" && <label><span>Nome da categoria *</span><input value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="Ex.: Espiritualidade" /></label>}
              <label><span>Forma de acompanhamento</span><select value={trackingType} onChange={(event) => setTrackingType(event.target.value as TrackingType)}>{TRACKING_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label><span>Prioridade</span><select value={priority} onChange={(event) => setPriority(event.target.value as Goal["priority"])}><option>Baixa</option><option>Média</option><option>Alta</option><option>Urgente</option></select></label>
              <label><span>Objetivo principal (opcional)</span><select value={parentGoalId} onChange={(event) => setParentGoalId(event.target.value)}><option value="">Nenhum — objetivo independente</option>{goals.filter((goal) => goal.id !== editingId && !goal.parentGoalId).map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>
              <label><span>Prazo final (opcional)</span><input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
              <label className="wide"><span>Descrição / motivação</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="Por que esse objetivo é importante para você?" /></label>
            </div>

            {trackingType === "numeric" && (
              <div className="tracking-panel">
                <h3>Indicador numérico</h3>
                {category === "Financeiro" && finance.reserves.length > 0 && (
                  <label className="wide"><span>Vincular a uma reserva financeira (opcional)</span><select value={linkedReserveId} onChange={(event) => setLinkedReserveId(event.target.value)}><option value="">Acompanhamento manual</option>{finance.reserves.map((reserve) => <option key={reserve.id} value={reserve.id}>{reserve.name} — {reserve.targetAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</option>)}</select><small>Quando vinculada, o saldo e o valor-alvo serão atualizados pelas movimentações da reserva.</small></label>
                )}
                {!linkedReserveId && <div className="form-grid">
                  <label><span>Direção do objetivo</span><select value={direction} onChange={(event) => setDirection(event.target.value as Direction)}><option value="increase">Aumentar / acumular</option><option value="decrease">Reduzir / diminuir</option></select></label>
                  <label><span>Unidade</span><select value={unit} onChange={(event) => setUnit(event.target.value)}>{["kg", "R$", "horas", "km", "unidades", "livros", "páginas", "%", "dias"].map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label><span>Valor inicial</span><input value={startValue} onChange={(event) => setStartValue(event.target.value)} inputMode="decimal" placeholder="Ex.: 100" /></label>
                  <label><span>Valor desejado</span><input value={target} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" placeholder="Ex.: 90" /></label>
                  <label><span>Valor atual</span><input value={current} onChange={(event) => setCurrent(event.target.value)} inputMode="decimal" placeholder="Ex.: 96" /></label>
                </div>}
              </div>
            )}
            {trackingType === "frequency" && <div className="tracking-panel"><h3>Frequência semanal</h3><label><span>Quantas vezes por semana?</span><input type="number" min="1" max="7" value={frequencyTarget} onChange={(event) => setFrequencyTarget(event.target.value)} /></label></div>}
            {trackingType === "steps" && <div className="tracking-panel"><h3>Acompanhamento por etapas</h3><p>Depois de criar o objetivo, você poderá adicionar e marcar cada etapa como concluída.</p></div>}
            {trackingType === "completion" && <div className="tracking-panel"><h3>Objetivo de conclusão</h3><p>O progresso será marcado quando você concluir o objetivo.</p></div>}
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <footer><button type="button" className="secondary-button" onClick={resetForm}>Cancelar</button><button className="primary-button" type="submit" disabled={!canSave}>{editingId ? "Salvar alterações" : "Criar objetivo"}</button></footer>
          </form>
        </section>
      )}

      <section className="objectives-toolbar">
        <div className="filter-tabs">{tabs.map((tab) => <button type="button" key={tab.value} className={filter === tab.value ? "selected" : ""} onClick={() => setFilter(tab.value)}>{tab.label}<span>{tab.count}</span></button>)}</div>
        <div className="toolbar-fields"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar objetivo..." aria-label="Buscar objetivo" /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>
      </section>

      {!loaded ? <div className="empty-state">Carregando seus objetivos…</div> : visible.length === 0 ? <div className="empty-state">{goals.length ? "Nenhum objetivo encontrado para este filtro." : "Você ainda não cadastrou objetivos. Comece criando algo que deseja conquistar."}</div> : (
        <section className="objectives-list">
          {visible.map((goal) => {
            const tracking = normalizeTracking(goal);
            const status = normalizeStatus(goal);
            const currentValue = currentFor(goal);
            const targetValue = targetFor(goal);
            const progress = percentFor(goal, currentValue, targetValue);
            const reached = isReached(goal, currentValue, targetValue);
            const children = goals.filter((item) => item.parentGoalId === goal.id);
            const linkedTasks = tasks.filter((task) => task.goalId === goal.id);
            const linkedHabits = habits.filter((habit) => habit.goalId === goal.id);
            const logs = (goal.progressHistory || []).slice(-3).reverse();
            const weekCount = (goal.frequencyLogs || []).filter((date) => date >= getWeekStart() && date <= today).length;
            const deadlineDays = goal.deadline ? daysFrom(goal.deadline) : null;
            return (
              <article className={`objective-card ${status === "paused" ? "is-paused" : ""} ${reached ? "is-completed" : ""}`} key={goal.id}>
                <div className="objective-progress"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" className="ring-bg" /><circle cx="50" cy="50" r="42" className="ring-value" strokeDasharray={2 * Math.PI * 42} strokeDashoffset={2 * Math.PI * 42 * (1 - progress / 100)} /></svg><strong>{progress}%</strong></div>
                <div className="objective-main">
                  <div className="objective-tags"><span className="category-tag">{goal.category}</span><span className={`status-tag ${reached ? "done" : status === "paused" ? "paused" : deadlineDays !== null && deadlineDays < 0 ? "late" : ""}`}>{reached ? "Concluído" : status === "paused" ? "Pausado" : deadlineDays !== null && deadlineDays < 0 ? "Atrasado" : "Em andamento"}</span>{goal.parentGoalId && <span className="relation-tag">Subobjetivo</span>}</div>
                  <h2>{goal.title}</h2>
                  {goal.description && <p className="objective-description">{goal.description}</p>}
                  {tracking === "numeric" && <p className="objective-value"><strong>{formatNumber(currentValue, goal.linkedReserveId ? "R$" : goal.unit)}</strong> de {formatNumber(targetValue, goal.linkedReserveId ? "R$" : goal.unit)}{goal.direction === "decrease" && !goal.linkedReserveId ? " · redução" : ""}</p>}
                  {tracking === "steps" && <p className="objective-value">{(goal.steps || []).filter((step) => step.done).length} de {(goal.steps || []).length} etapas concluídas</p>}
                  {tracking === "frequency" && <p className="objective-value">{weekCount} de {goal.frequencyTarget || 3} vezes nesta semana</p>}
                  {tracking === "completion" && <p className="objective-value">Objetivo com acompanhamento por conclusão</p>}
                  <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
                  <div className="objective-meta"><span>{goal.deadline ? deadlineDays! < 0 && !reached ? `Atrasado há ${Math.abs(deadlineDays!)} dia(s)` : deadlineDays === 0 ? "Prazo hoje" : `Prazo: ${new Date(`${goal.deadline}T12:00:00`).toLocaleDateString("pt-BR")}` : "Sem prazo definido"}</span><span>Prioridade: {goal.priority || "Média"}</span></div>

                  {tracking === "numeric" && !reached && status !== "paused" && !goal.linkedReserveId && <div className="inline-actions"><input value={valueInputs[goal.id] || ""} onChange={(event) => setValueInputs((previous) => ({ ...previous, [goal.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") addNumericProgress(goal); }} inputMode="decimal" placeholder="Atualizar valor atual" aria-label={`Atualizar valor de ${goal.title}`} /><button type="button" onClick={() => addNumericProgress(goal)}>Atualizar</button></div>}
                  {tracking === "numeric" && goal.linkedReserveId && <p className="linked-note"><Icon name="wallet" /> Progresso atualizado pela reserva financeira vinculada.</p>}

                  {tracking === "steps" && status !== "paused" && (
                    <div className="steps-panel">
                      {(goal.steps || []).map((step) => <label key={step.id} className="step-row"><input type="checkbox" checked={step.done} onChange={() => toggleStep(goal, step.id)} /><span className={step.done ? "step-done" : ""}>{step.title}</span></label>)}
                      <div className="inline-actions"><input value={stepInputs[goal.id] || ""} onChange={(event) => setStepInputs((previous) => ({ ...previous, [goal.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") addStep(goal); }} placeholder="Adicionar uma etapa..." /><button type="button" onClick={() => addStep(goal)}>Adicionar etapa</button></div>
                    </div>
                  )}

                  {tracking === "frequency" && status !== "paused" && <div className="inline-actions"><button type="button" disabled={(goal.frequencyLogs || []).includes(today)} onClick={() => logFrequency(goal)}>{(goal.frequencyLogs || []).includes(today) ? "Registrado hoje" : "Registrar atividade de hoje"}</button></div>}
                  {logs.length > 0 && <div className="history-mini"><strong>Últimas atualizações</strong>{logs.map((log, index) => <span key={`${log.date}-${index}`}>{new Date(`${log.date}T12:00:00`).toLocaleDateString("pt-BR")} · {formatNumber(log.value, goal.unit)}</span>)}</div>}

                  {children.length > 0 && <div className="children-panel"><strong>Subobjetivos ({children.length})</strong>{children.map((child) => <div key={child.id}><span>{child.title}</span><small>{percentFor(child, currentFor(child), targetFor(child))}%</small></div>)}</div>}
                  <div className="relationship-actions">
                    <button type="button" onClick={() => openCreate(goal.id)}><Icon name="plus" /> Subobjetivo</button>
                    <button type="button" onClick={() => createLinkedTask(goal)}><Icon name="list" /> Criar tarefa</button>
                    <button type="button" onClick={() => createLinkedHabit(goal)}><Icon name="repeat" /> Criar hábito</button>
                  </div>
                  <div className="card-actions">
                    <button type="button" onClick={() => openEdit(goal)}>Editar</button>
                    {status === "paused" ? <button type="button" onClick={() => changeStatus(goal, "active")}><Icon name="play" /> Retomar</button> : !reached && <button type="button" onClick={() => changeStatus(goal, "paused")}><Icon name="pause" /> Pausar</button>}
                    {!reached && <button type="button" onClick={() => completeGoal(goal)}><Icon name="check" /> Concluir</button>}
                    <button type="button" className="delete-button" onClick={() => deleteGoal(goal)}><Icon name="trash" /> Excluir</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <footer className="objectives-footer"><Link href="/">Voltar à Central do Dia <Icon name="arrow" /></Link><span>NEXO · OBJETIVOS</span></footer>

      <style jsx global>{`
        .objectives-page{display:flex;flex-direction:column;gap:16px;min-width:0;padding:8px 0 30px;color:#f1f1f3}
        .objectives-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:10px 0 8px}
        .objectives-hero .eyebrow,.objective-form-card .eyebrow{color:#8e929c;font-size:10px;font-weight:750;letter-spacing:1.6px}
        .objectives-hero h1{margin:9px 0 6px;color:#f5f5f7;font-size:clamp(29px,4vw,42px);font-weight:680;letter-spacing:-1.3px}
        .objectives-hero p{max-width:650px;margin:0;color:#9c9da6;font-size:13px;line-height:1.6}
        .objectives-page button{font:inherit;cursor:pointer}
        .primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 15px;border:1px solid #d0d2d8;border-radius:8px;background:linear-gradient(180deg,#dedfe3,#bfc1c8);color:#17171a;font-size:12px;font-weight:750}
        .primary-button:disabled{opacity:.45;cursor:not-allowed}
        .objectives-sync{color:#92939d;font-size:11px}
        .sync-dot{display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#b48b62}
        .sync-dot.ready{background:#8eb69b}
        .sync-warning{color:#d2ad82}
        .objectives-error,.form-error{padding:11px 13px;border:1px solid #704b4b;border-radius:9px;background:#24191b;color:#dfb4b4;font-size:12px}
        .objectives-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}
        .objectives-metrics article{display:flex;flex-direction:column;gap:4px;padding:15px 17px;border:1px solid #2d2d34;border-radius:13px;background:rgba(20,20,24,.78);box-shadow:0 12px 28px rgba(0,0,0,.2)}
        .objectives-metrics article>span{color:#a3a4ad;font-size:11px}
        .objectives-metrics article strong{color:#f4f4f6;font-size:27px;font-weight:680;letter-spacing:-.7px}
        .objectives-metrics article strong.negative{color:#dfa0a0}
        .objectives-metrics article small{color:#81828c;font-size:10px}
        .objective-form-card{padding:20px;border:1px solid #36363e;border-radius:15px;background:rgba(19,19,23,.94);box-shadow:0 14px 34px rgba(0,0,0,.25)}
        .objective-form-card>header{display:flex;align-items:center;justify-content:space-between;margin-bottom:17px}
        .objective-form-card h2{margin:5px 0 0;font-size:19px}
        .close-button{width:31px;height:31px;border:1px solid #3a3a43;border-radius:7px;background:#17171b;color:#c9c9d0;font-size:20px}
        .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .form-grid label,.tracking-panel label{display:flex;flex-direction:column;gap:6px;min-width:0}
        .form-grid label>span,.tracking-panel label>span{color:#a7a7b0;font-size:11px}
        .form-grid .wide{grid-column:1/-1}
        .objective-form-card input,.objective-form-card select,.objective-form-card textarea,.toolbar-fields input,.toolbar-fields select,.inline-actions input{width:100%;min-width:0;min-height:38px;padding:8px 10px;border:1px solid #393941;border-radius:8px;background:#111115;color:#ededf0;font:inherit;font-size:12px;outline:none;box-sizing:border-box;color-scheme:dark}
        .objective-form-card textarea{resize:vertical}
        .objective-form-card input:focus,.objective-form-card select:focus,.objective-form-card textarea:focus,.toolbar-fields input:focus,.toolbar-fields select:focus,.inline-actions input:focus{border-color:#81818b}
        .tracking-panel{display:flex;flex-direction:column;gap:12px;margin-top:15px;padding:14px;border:1px solid #303039;border-radius:10px;background:rgba(255,255,255,.025)}
        .tracking-panel h3{margin:0;color:#e7e7eb;font-size:13px}
        .tracking-panel p,.tracking-panel small{margin:0;color:#92939c;font-size:11px;line-height:1.5}
        .tracking-panel .form-grid{width:100%}
        .objective-form-card form>footer{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
        .secondary-button{min-height:39px;padding:0 14px;border:1px solid #41414a;border-radius:8px;background:#19191e;color:#d0d0d6;font-size:12px}
        .form-error{margin:13px 0 0}
        .objectives-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .filter-tabs{display:flex;flex-wrap:wrap;gap:6px}
        .filter-tabs button{display:flex;align-items:center;gap:7px;min-height:34px;padding:0 11px;border:1px solid #303039;border-radius:8px;background:#17171b;color:#bcbcc5;font-size:11px}
        .filter-tabs button.selected{border-color:#bfc1c8;background:#d1d2d7;color:#17171a;font-weight:750}
        .filter-tabs button span{opacity:.7}
        .toolbar-fields{display:flex;gap:7px;min-width:280px}
        .toolbar-fields input{max-width:190px}
        .empty-state{padding:35px 20px;border:1px dashed #393941;border-radius:13px;color:#92939c;text-align:center;font-size:13px}
        .objectives-list{display:flex;flex-direction:column;gap:12px}
        .objective-card{display:flex;align-items:flex-start;gap:18px;padding:18px;border:1px solid #2d2d34;border-radius:15px;background:rgba(19,19,23,.86);box-shadow:0 12px 28px rgba(0,0,0,.2)}
        .objective-card.is-paused{opacity:.78}
        .objective-card.is-completed{border-color:#3b5142}
        .objective-progress{position:relative;flex-shrink:0;width:76px;height:76px}
        .objective-progress svg{width:100%;height:100%;transform:rotate(-90deg)}
        .objective-progress circle{fill:none;stroke-width:8}
        .objective-progress .ring-bg{stroke:#383840}
        .objective-progress .ring-value{stroke:#c9cbd2;stroke-linecap:round}
        .objective-card.is-completed .ring-value{stroke:#91b39a}
        .objective-progress strong{position:absolute;inset:0;display:grid;place-items:center;color:#f0f0f3;font-size:16px}
        .objective-main{flex:1;min-width:0}
        .objective-tags{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .category-tag,.status-tag,.relation-tag{padding:4px 8px;border:1px solid #41414a;border-radius:6px;color:#bcbcc5;font-size:9px;font-weight:650}
        .status-tag.done{border-color:#4e6956;color:#a7c8af}
        .status-tag.paused{border-color:#685b43;color:#d2c08f}
        .status-tag.late{border-color:#704b4b;color:#dbaaaa}
        .relation-tag{border-color:#4c5265;color:#b7bfd6}
        .objective-main h2{margin:8px 0 4px;color:#f3f3f5;font-size:17px;font-weight:650;overflow-wrap:anywhere}
        .objective-description{margin:0 0 7px;color:#9697a1;font-size:11px;line-height:1.5}
        .objective-value{margin:4px 0 8px;color:#a8a9b2;font-size:12px}
        .objective-value strong{color:#f0f0f3;font-size:14px}
        .progress-track{height:5px;overflow:hidden;border-radius:8px;background:#303039}
        .progress-track span{display:block;height:100%;border-radius:8px;background:#c3c5cc}
        .objective-card.is-completed .progress-track span{background:#91b39a}
        .objective-meta{display:flex;justify-content:space-between;gap:10px;margin-top:7px;color:#858690;font-size:10px}
        .inline-actions{display:flex;gap:7px;align-items:center;margin-top:10px}
        .inline-actions input{max-width:230px}
        .inline-actions button,.relationship-actions button,.card-actions button{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:31px;padding:0 9px;border:1px solid #41414a;border-radius:7px;background:#1a1a20;color:#d0d0d7;font-size:10px}
        .inline-actions button:disabled{opacity:.5;cursor:not-allowed}
        .linked-note{display:flex;align-items:center;gap:6px;margin:9px 0;color:#a7c8af;font-size:10px}
        .steps-panel{margin-top:10px;padding:10px;border:1px solid #303039;border-radius:9px;background:rgba(255,255,255,.02)}
        .step-row{display:flex;align-items:center;gap:8px;padding:6px 0;color:#d1d1d7;font-size:11px}
        .step-row input{accent-color:#c5c7ce}
        .step-done{color:#83848d;text-decoration:line-through}
        .history-mini{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;color:#8f909a;font-size:10px}
        .history-mini strong{width:100%;color:#bfc0c8;font-size:10px}
        .children-panel{display:flex;flex-direction:column;gap:5px;margin-top:11px;padding:10px;border:1px solid #303039;border-radius:9px}
        .children-panel>strong{margin-bottom:3px;color:#c9c9d0;font-size:10px}
        .children-panel>div{display:flex;justify-content:space-between;gap:10px;color:#a7a7b0;font-size:11px}
        .children-panel small{color:#c7c8cf}
        .relationship-actions,.card-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}
        .relationship-actions button{border-color:#35353e;background:rgba(255,255,255,.025);color:#bdbdc6}
        .card-actions{padding-top:9px;border-top:1px solid #2e2e36}
        .card-actions button.delete-button{margin-left:auto;color:#d5a3a3}
        .objectives-footer{display:flex;justify-content:space-between;gap:12px;padding-top:7px;color:#7f808a;font-size:10px}
        .objectives-footer a{display:inline-flex;align-items:center;gap:6px;color:#bfc0c8;text-decoration:none}
        @media(max-width:950px){.objectives-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.objectives-toolbar{align-items:stretch;flex-direction:column}.toolbar-fields{min-width:0}.toolbar-fields input{max-width:none;flex:1}}
        @media(max-width:620px){.objectives-hero{align-items:flex-start;flex-direction:column}.objectives-hero .primary-button{width:100%}.objectives-metrics{gap:8px}.objectives-metrics article{padding:12px}.objective-card{gap:11px;padding:13px}.objective-progress{width:58px;height:58px}.objective-progress strong{font-size:13px}.objective-main h2{font-size:15px}.objective-meta{flex-direction:column;gap:4px}.form-grid{grid-template-columns:minmax(0,1fr)}.form-grid .wide{grid-column:auto}.toolbar-fields{flex-direction:column}.objectives-footer{flex-direction:column}}
      `}</style>
    </div>
  );
}

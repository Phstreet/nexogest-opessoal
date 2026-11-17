export type RoutinePriority = "Baixa" | "Média" | "Alta" | "Urgente";

export type RoutineTask = {
  id: number;
  description: string;
  done: boolean;
  date?: string;
  time?: string;
  priority?: RoutinePriority;
  category?: string;
  notes?: string;
  createdAt?: string;
};

export type RoutineHabitFrequency =
  | "Diário"
  | "Dias úteis"
  | "3 vezes por semana";

export type RoutineHabit = {
  id: number;
  name: string;
  category: string;
  frequency?: RoutineHabitFrequency;
  time?: string;
  notes?: string;
  completedDates: string[];
  active: boolean;
  createdAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function isValidRoutineTask(value: unknown): value is RoutineTask {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "number" &&
    Number.isFinite(value.id) &&
    typeof value.description === "string" &&
    typeof value.done === "boolean" &&
    (value.date === undefined || typeof value.date === "string") &&
    (value.time === undefined || typeof value.time === "string") &&
    (value.priority === undefined ||
      value.priority === "Baixa" ||
      value.priority === "Média" ||
      value.priority === "Alta" ||
      value.priority === "Urgente") &&
    (value.category === undefined || typeof value.category === "string") &&
    (value.notes === undefined || typeof value.notes === "string") &&
    (value.createdAt === undefined || typeof value.createdAt === "string")
  );
}

export function isValidRoutineHabit(value: unknown): value is RoutineHabit {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "number" &&
    Number.isFinite(value.id) &&
    typeof value.name === "string" &&
    typeof value.category === "string" &&
    Array.isArray(value.completedDates) &&
    value.completedDates.every((date) => typeof date === "string") &&
    typeof value.active === "boolean" &&
    (value.frequency === undefined ||
      value.frequency === "Diário" ||
      value.frequency === "Dias úteis" ||
      value.frequency === "3 vezes por semana") &&
    (value.createdAt === undefined || typeof value.createdAt === "string")
  );
}

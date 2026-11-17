import type { RoutineTask, RoutinePriority } from "@/lib/routine/types";

export type RoutineTaskFilter = "Todas" | "Hoje" | "Pendentes" | "Concluídas" | "Atrasadas";

export interface RoutineTaskMetrics {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  today: number;
  percentage: number;
}

export interface RoutineTaskQuery {
  filter: RoutineTaskFilter;
  categoryFilter: string;
  priorityFilter: string;
  search: string;
  today: string;
}

const PRIORITY_ORDER: Record<RoutinePriority, number> = {
  Urgente: 0,
  Alta: 1,
  Média: 2,
  Baixa: 3,
};

export function getRoutineTaskMetrics(tasks: RoutineTask[], today: string): RoutineTaskMetrics {
  const completed = tasks.filter((task) => task.done).length;
  const pending = tasks.length - completed;
  const overdue = tasks.filter((task) => !task.done && !!task.date && task.date < today).length;
  const todayCount = tasks.filter((task) => task.date === today).length;

  return {
    total: tasks.length,
    completed,
    pending,
    overdue,
    today: todayCount,
    percentage: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
  };
}

export function filterAndSortRoutineTasks(tasks: RoutineTask[], query: RoutineTaskQuery): RoutineTask[] {
  const normalizedSearch = query.search.trim().toLowerCase();

  return tasks
    .filter((task) => {
      if (query.filter === "Hoje" && task.date !== query.today) return false;
      if (query.filter === "Pendentes" && task.done) return false;
      if (query.filter === "Concluídas" && !task.done) return false;
      if (query.filter === "Atrasadas" && (task.done || !task.date || task.date >= query.today)) return false;
      if (query.categoryFilter !== "Todas" && task.category !== query.categoryFilter) return false;
      if (query.priorityFilter !== "Todas" && task.priority !== query.priorityFilter) return false;

      if (normalizedSearch) {
        const description = task.description.toLowerCase();
        const notes = (task.notes || "").toLowerCase();
        if (!description.includes(normalizedSearch) && !notes.includes(normalizedSearch)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;

      const dateA = a.date || "9999-12-31";
      const dateB = b.date || "9999-12-31";
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      return PRIORITY_ORDER[a.priority || "Média"] - PRIORITY_ORDER[b.priority || "Média"];
    });
}

export function getRoutineTasksForDate(tasks: RoutineTask[], selectedDate: string): RoutineTask[] {
  return tasks
    .filter((task) => task.date === selectedDate)
    .sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
}

export function getUpcomingRoutineTasks(tasks: RoutineTask[], selectedDate: string, limit = 5): RoutineTask[] {
  return tasks
    .filter((task) => !!task.date && task.date > selectedDate && !task.done)
    .sort((a, b) => {
      const dateComparison = (a.date || "").localeCompare(b.date || "");
      if (dateComparison !== 0) return dateComparison;
      return (a.time || "99:99").localeCompare(b.time || "99:99");
    })
    .slice(0, limit);
}

export function getOverdueRoutineTasks(tasks: RoutineTask[], today: string): RoutineTask[] {
  return tasks.filter((task) => !!task.date && task.date < today && !task.done);
}

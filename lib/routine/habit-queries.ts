import type { RoutineHabit, RoutineHabitFrequency } from "@/lib/routine/types";
import { addDaysToDateKey, getWeekdayFromDateKey } from "@/lib/utils/date";

export function getHabitWeeklyTarget(frequency?: RoutineHabitFrequency): number {
  if (frequency === "Dias úteis") return 5;
  if (frequency === "3 vezes por semana") return 3;
  return 7;
}

export function getHabitWeekProgress(habit: RoutineHabit, today: string): number {
  const weekday = getWeekdayFromDateKey(today);
  if (weekday < 0) return 0;

  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  const monday = addDaysToDateKey(today, -mondayOffset);
  const weekDates = new Set(
    Array.from({ length: 7 }, (_, index) => addDaysToDateKey(monday, index))
  );
  const completedDates = new Set(habit.completedDates);

  return [...weekDates].filter((date) => {
    if (!completedDates.has(date)) return false;
    if (habit.frequency !== "Dias úteis") return true;

    const completedWeekday = getWeekdayFromDateKey(date);
    return completedWeekday >= 1 && completedWeekday <= 5;
  }).length;
}

/** Indica se o hábito deve ser cobrado hoje, respeitando sua frequência semanal. */
export function isHabitDueToday(habit: RoutineHabit, today: string): boolean {
  if (!habit.active) return false;
  if (habit.completedDates.includes(today)) return true;

  if (habit.frequency === "Dias úteis") {
    const weekday = getWeekdayFromDateKey(today);
    return weekday >= 1 && weekday <= 5;
  }

  if (habit.frequency === "3 vezes por semana") {
    return getHabitWeekProgress(habit, today) < getHabitWeeklyTarget(habit.frequency);
  }

  return true;
}

export function getHabitsDueToday(habits: RoutineHabit[], today: string): RoutineHabit[] {
  return habits.filter((habit) => isHabitDueToday(habit, today));
}

import { expect, test } from "@playwright/test";
import {
  getHabitWeekProgress,
  getHabitWeeklyTarget,
  isHabitDueToday,
} from "@/lib/routine/habit-queries";
import type { RoutineHabit } from "@/lib/routine/types";

function habit(overrides: Partial<RoutineHabit> = {}): RoutineHabit {
  return {
    id: 1,
    name: "Hábito de teste",
    category: "Pessoal",
    frequency: "Diário",
    completedDates: [],
    active: true,
    ...overrides,
  };
}

test.describe("NEXO - Frequência semanal dos hábitos", () => {
  test("considera somente dias úteis para a frequência correspondente", () => {
    const weekdayHabit = habit({ frequency: "Dias úteis" });

    expect(isHabitDueToday(weekdayHabit, "2026-11-26")).toBe(true);
    expect(isHabitDueToday(weekdayHabit, "2026-11-28")).toBe(false);
  });

  test("encerra a meta de três vezes após três conclusões na mesma semana", () => {
    const threeTimesHabit = habit({
      frequency: "3 vezes por semana",
      completedDates: ["2026-11-23", "2026-11-24", "2026-11-25"],
    });

    expect(getHabitWeekProgress(threeTimesHabit, "2026-11-26")).toBe(3);
    expect(getHabitWeeklyTarget(threeTimesHabit.frequency)).toBe(3);
    expect(isHabitDueToday(threeTimesHabit, "2026-11-26")).toBe(false);
  });

  test("mantém visível um hábito já concluído hoje, mesmo após atingir a meta semanal", () => {
    const completedHabit = habit({
      frequency: "3 vezes por semana",
      completedDates: ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26"],
    });

    expect(isHabitDueToday(completedHabit, "2026-11-26")).toBe(true);
  });
});

import { expect, test } from "@playwright/test";
import {
  addDaysToDateKey,
  formatDateKey,
  getSaoPauloDateKey,
  getWeekdayFromDateKey,
} from "../lib/utils/date";

test.describe("NEXO - Datas no fuso de São Paulo", () => {
  test("resolve corretamente a virada de dia no fuso oficial", () => {
    expect(getSaoPauloDateKey(new Date("2026-11-26T02:30:00.000Z"))).toBe("2026-11-25");
    expect(getSaoPauloDateKey(new Date("2026-11-26T03:30:00.000Z"))).toBe("2026-11-26");
  });

  test("soma dias e identifica o dia da semana sem depender do navegador", () => {
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateKey("2027-01-01", -1)).toBe("2026-12-31");
    expect(getWeekdayFromDateKey("2026-11-26")).toBe(4);
  });

  test("formata uma data civil sem deslocar o dia", () => {
    expect(formatDateKey("2026-11-26", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    })).toContain("26");
  });
});

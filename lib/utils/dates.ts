/** Datas civis do NEXO no fuso de São Paulo, sem depender do fuso do navegador. */
const TIME_ZONE = "America/Sao_Paulo";

export function localISODate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function formatDateBR(value: string): string {
  if (!isValidISODate(value)) return value;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function addDaysISO(value: string, days: number): string {
  if (!isValidISODate(value) || !Number.isInteger(days)) throw new Error("Data ou quantidade de dias inválida.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function isOverdue(value: string, today = localISODate()): boolean {
  return isValidISODate(value) && value < today;
}

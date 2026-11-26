const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

function getDateParts(date: Date, timeZone = SAO_PAULO_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
}

/** Retorna a data civil atual no fuso oficial do NEXO. */
export function getSaoPauloDateKey(date = new Date()): string {
  const parts = getDateParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Soma dias a uma data YYYY-MM-DD sem depender do fuso do navegador. */
export function addDaysToDateKey(dateKey: string, amount: number): string {
  const date = parseDateKey(dateKey);
  if (!date || !Number.isInteger(amount)) return dateKey;

  date.setUTCDate(date.getUTCDate() + amount);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** Converte uma data civil em Date UTC ao meio-dia para evitar mudança de dia. */
function parseDateKey(dateKey: string): Date | null {
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(dateKey);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

/** Formata uma data YYYY-MM-DD sem deslocamento causado pelo fuso local. */
export function formatDateKey(
  dateKey: string,
  options: Intl.DateTimeFormatOptions
): string {
  const date = parseDateKey(dateKey);
  if (!date) return "Data inválida";

  return new Intl.DateTimeFormat("pt-BR", {
    ...options,
    timeZone: "UTC",
  }).format(date);
}

/** Retorna o dia da semana: 0 domingo, 1 segunda, ... 6 sábado. */
export function getWeekdayFromDateKey(dateKey: string): number {
  return parseDateKey(dateKey)?.getUTCDay() ?? -1;
}

/** Hora atual no fuso de São Paulo (formato 0–23). */
export function getSaoPauloHour(date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: SAO_PAULO_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);

  return Number(hour);
}

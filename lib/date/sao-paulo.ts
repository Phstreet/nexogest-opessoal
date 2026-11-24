const TIME_ZONE = "America/Sao_Paulo";

export function getSaoPauloDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function getSaoPauloHour(date: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date));
}

/** Representa o dia civil de São Paulo ao meio-dia local, evitando mudança de data por UTC. */
export function getSaoPauloCalendarDate(date: Date = new Date()): Date {
  const [year, month, day] = getSaoPauloDateKey(date).split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** Utilitários monetários: cálculos em centavos para evitar erros binários. */
export function toCents(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Valor monetário inválido.");
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  if (!Number.isSafeInteger(cents)) throw new Error("Quantidade de centavos inválida.");
  return cents / 100;
}

export function parseCurrencyToCents(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!normalized) return null;
  let decimal: string;
  if (normalized.includes(",")) decimal = normalized.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(normalized)) decimal = normalized.replace(/\./g, "");
  else decimal = normalized;
  const parsed = Number(decimal);
  if (!Number.isFinite(parsed)) return null;
  return toCents(parsed);
}

export function formatBRL(value: number): string {
  return (Number.isFinite(value) ? value : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatCentsBRL(cents: number): string {
  return formatBRL(fromCents(cents));
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => total + toCents(value), 0);
}

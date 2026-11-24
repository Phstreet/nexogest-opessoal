/** Operações monetárias em centavos para evitar acumulação de ponto flutuante. */
export function toCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Math.sign(value) * Number.EPSILON) * 100);
}

export function fromCents(value: number): number {
  return (Number.isSafeInteger(value) ? value : Math.round(value)) / 100;
}

export function sumMoney(values: readonly number[]): number {
  return fromCents(values.reduce((total, value) => total + toCents(value), 0));
}

export function addMoney(left: number, right: number): number {
  return fromCents(toCents(left) + toCents(right));
}

export function subtractMoney(left: number, right: number): number {
  return fromCents(toCents(left) - toCents(right));
}

export function averageMoney(values: readonly number[]): number {
  if (!values.length) return 0;
  const totalCents = values.reduce((total, value) => total + toCents(value), 0);
  return fromCents(Math.round(totalCents / values.length));
}

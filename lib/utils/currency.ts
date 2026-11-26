/** Utilitários monetários para cálculos seguros em centavos. */
export function toCents(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Valor monetário inválido.");

  const sign = value < 0 ? -1 : 1;
  const [wholePart, fractionPart = ""] = Math.abs(value).toFixed(8).split(".");
  const cents =
    Number(wholePart) * 100 +
    Number(fractionPart.slice(0, 2).padEnd(2, "0")) +
    (Number(fractionPart[2] ?? "0") >= 5 ? 1 : 0);

  if (!Number.isSafeInteger(cents)) {
    throw new Error("Valor monetário excede o limite seguro de cálculo.");
  }
  return sign * cents;
}
export function fromCents(cents: number): number {
  if (!Number.isSafeInteger(cents)) throw new Error("Centavos inválidos.");
  return cents / 100;
}
export function parseCurrencyToCents(value: string): number | null {
  const normalized=value.trim().replace(/\s/g,"").replace(/^R\$/i,"");
  if(!normalized)return null;
  const decimal=normalized.includes(",")?normalized.replace(/\./g,"").replace(",","."):/^-?\d{1,3}(\.\d{3})+$/.test(normalized)?normalized.replace(/\./g,""):normalized;
  const n=Number(decimal); return Number.isFinite(n)?toCents(n):null;
}
export function formatBRL(value:number):string{return (Number.isFinite(value)?value:0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
export function formatCentsBRL(cents:number):string{return formatBRL(fromCents(cents));}
export function sumCents(values:readonly number[]):number{return values.reduce((s,v)=>s+toCents(v),0);}

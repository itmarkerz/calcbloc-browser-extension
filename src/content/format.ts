import type { Period } from "../shared/parser";

export function money(value: number, currency: string, decimals = 0): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString()}`;
  }
}

export function moneyRange(lo: number, hi: number, currency: string, decimals = 0): string {
  const a = money(lo, currency, decimals);
  const b = money(hi, currency, decimals);
  return a === b ? a : `${a}–${b}`;
}

export const PERIOD_SHORT: Record<Period, string> = { year: "/yr", month: "/mo", week: "/wk", hour: "/hr", day: "/day" };
export const PERIOD_LONG: Record<Period, string> = { year: "a year", month: "a month", week: "a week", hour: "an hour", day: "a day" };

export function percent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

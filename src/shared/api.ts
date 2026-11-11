/**
 * CalcBloc public API (https://calcbloc.com/developers): request building and response checking.
 * Only GET /api/v1/net-salary and GET /api/v1/countries are used. What is sent: the country, the salary figure,
 * the region and the filing basics from the options page, and the API key if the user added one.
 */
import { safeCalcblocUrl } from "./calculator-links";

export const API_BASE = "https://calcbloc.com/api/v1";
export const KEY_SIGNUP_URL = "https://calcbloc.com/developers/keys";
export const DATA_URL = "https://calcbloc.com/data";

export type ParamValue = string | number | boolean;

export interface EstimateRequest {
  country: string;
  /** In the API's basis: annual, except Singapore (monthly). */
  salary: number;
  params: Record<string, ParamValue>;
}

export interface Estimate {
  netAnnual: number;
  grossAnnual: number | null;
  effectiveRate: number | null;
  currency: string;
  year: string;
  calculatorUrl: string;
  attributionText: string;
  attributionUrl: string;
}

export type ErrorCode =
  | "rate_limited"
  | "daily_limit"
  | "api_key_required"
  | "invalid_key"
  | "unsupported_country"
  | "bad_request"
  | "server_error"
  | "network";

export type EstimateResult =
  | { ok: true; estimate: Estimate; cached?: boolean }
  | { ok: false; error: ErrorCode; message: string; retryAfterMs?: number; docs?: string };

/** Stable cache key: same country, salary and settings give the same key. */
export function requestKey(r: EstimateRequest): string {
  const p = Object.keys(r.params)
    .sort()
    .map((k) => `${k}=${String(r.params[k])}`)
    .join("&");
  return `${r.country}|${Math.round(r.salary)}|${p}`;
}

export function netSalaryUrl(r: EstimateRequest): string {
  const u = new URL(`${API_BASE}/net-salary`);
  u.searchParams.set("country", r.country);
  u.searchParams.set("salary", String(Math.round(r.salary)));
  for (const k of Object.keys(r.params).sort()) {
    const v = r.params[k];
    u.searchParams.set(k, typeof v === "boolean" ? String(v) : String(v));
  }
  return u.toString();
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Validates a /net-salary response body. Returns null if it does not look like one. */
export function parseEstimate(body: unknown): Estimate | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const summary = (b.summary ?? {}) as Record<string, unknown>;
  const results = (b.results ?? {}) as Record<string, unknown>;
  const netAnnual = num(summary.netAnnual) ?? num(results.netAnnual);
  if (netAnnual === null || typeof b.currency !== "string") return null;
  const attribution = (b.attribution ?? {}) as Record<string, unknown>;
  let rate = num(summary.effectiveRate);
  if (rate !== null && rate > 1 && rate <= 100) rate = rate / 100;
  if (rate !== null && (rate < 0 || rate > 1)) rate = null;
  return {
    netAnnual,
    grossAnnual: num(summary.grossAnnual),
    effectiveRate: rate,
    currency: b.currency,
    year: typeof b.year === "string" ? b.year : "",
    calculatorUrl: safeCalcblocUrl(typeof b.calculatorUrl === "string" ? b.calculatorUrl : undefined),
    attributionText: typeof attribution.text === "string" ? attribution.text : "Data by CalcBloc (calcbloc.com)",
    attributionUrl: safeCalcblocUrl(typeof attribution.url === "string" ? attribution.url : undefined, DATA_URL),
  };
}

/** Maps an error response to a result. */
export function parseError(status: number, body: unknown, retryAfterHeader: string | null): EstimateResult {
  const e = ((body as { error?: Record<string, unknown> } | null)?.error ?? {}) as Record<string, unknown>;
  const code = typeof e.code === "string" ? e.code : "";
  const message = typeof e.message === "string" ? e.message.slice(0, 300) : `HTTP ${status}`;
  const docs = typeof e.docs === "string" ? safeCalcblocUrl(e.docs) : undefined;
  const retry = Number(retryAfterHeader);
  const retryAfterMs = Number.isFinite(retry) && retry > 0 ? retry * 1000 : undefined;
  if (status === 429) {
    // A wait of more than a few minutes means the daily allowance is used up.
    const daily = retryAfterMs !== undefined && retryAfterMs > 5 * 60_000;
    return { ok: false, error: daily ? "daily_limit" : "rate_limited", message, retryAfterMs: retryAfterMs ?? 60_000, docs };
  }
  if (status === 401) return { ok: false, error: code === "invalid_key" ? "invalid_key" : "api_key_required", message, docs };
  if (code === "unsupported_country") return { ok: false, error: "unsupported_country", message, docs };
  if (status >= 500) return { ok: false, error: "server_error", message, retryAfterMs: retryAfterMs ?? 60_000, docs };
  return { ok: false, error: "bad_request", message, docs };
}

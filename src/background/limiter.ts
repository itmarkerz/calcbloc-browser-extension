/**
 * Client-side request pacing that mirrors the CalcBloc API limits, so the extension never hammers the API:
 * without a key 5 requests a minute and 50 a day per IP address; with a free key 60 a minute and 5,000 a day.
 * The server's X-RateLimit-* headers and 429 responses always win over the local count.
 */
export interface Limits {
  perMinute: number;
  perDay: number;
}

export const ANONYMOUS: Limits = { perMinute: 5, perDay: 50 };
export const WITH_KEY: Limits = { perMinute: 60, perDay: 5_000 };

export interface LimiterState {
  /** Timestamps (ms) of requests in the last minute. */
  minute: number[];
  /** Requests sent today (UTC date). */
  day: { date: string; count: number };
  /** No requests before this time (ms), from a 429 or X-RateLimit-Remaining: 0. */
  blockedUntil: number;
  /** True when the block is for the rest of the day. */
  blockedDaily: boolean;
}

export const emptyState = (): LimiterState => ({ minute: [], day: { date: "", count: 0 }, blockedUntil: 0, blockedDaily: false });

const utcDate = (now: number) => new Date(now).toISOString().slice(0, 10);

export type Check = { ok: true } | { ok: false; retryAfterMs: number; daily: boolean };

export function check(state: LimiterState, now: number, limits: Limits): Check {
  if (state.blockedUntil > now) return { ok: false, retryAfterMs: state.blockedUntil - now, daily: state.blockedDaily };
  const today = utcDate(now);
  if (state.day.date === today && state.day.count >= limits.perDay) {
    const midnight = Date.parse(`${today}T00:00:00Z`) + 86_400_000;
    return { ok: false, retryAfterMs: midnight - now, daily: true };
  }
  const recent = state.minute.filter((t) => now - t < 60_000);
  if (recent.length >= limits.perMinute) {
    const oldest = Math.min(...recent);
    return { ok: false, retryAfterMs: Math.max(250, 60_000 - (now - oldest) + 50), daily: false };
  }
  return { ok: true };
}

export function record(state: LimiterState, now: number): LimiterState {
  const today = utcDate(now);
  return {
    ...state,
    minute: [...state.minute.filter((t) => now - t < 60_000), now],
    day: state.day.date === today ? { date: today, count: state.day.count + 1 } : { date: today, count: 1 },
  };
}

/** Applies the server's view: remaining requests today and seconds until the daily window resets. */
export function applyServerHeaders(state: LimiterState, now: number, remaining: string | null, reset: string | null, limit: string | null): LimiterState {
  const rem = Number(remaining);
  const lim = Number(limit);
  const resetS = Number(reset);
  const next = { ...state };
  if (remaining !== null && Number.isFinite(rem) && Number.isFinite(lim) && lim > 0) {
    next.day = { date: utcDate(now), count: Math.max(next.day.date === utcDate(now) ? next.day.count : 0, lim - rem) };
  }
  if (remaining !== null && rem === 0 && Number.isFinite(resetS) && resetS > 0) {
    next.blockedUntil = now + resetS * 1000;
    next.blockedDaily = true;
  }
  return next;
}

export function block(state: LimiterState, now: number, retryAfterMs: number, daily: boolean): LimiterState {
  return { ...state, blockedUntil: Math.max(state.blockedUntil, now + retryAfterMs), blockedDaily: daily };
}

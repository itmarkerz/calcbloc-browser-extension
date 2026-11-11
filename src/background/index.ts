/**
 * Background worker (service worker in Chrome and Edge, event page in Firefox).
 * Owns every network request: content scripts never talk to the network themselves. It caches estimates,
 * merges identical requests, paces requests to the API limits and refreshes the country list weekly.
 */
import { ext } from "../shared/browser";
import { API_BASE, netSalaryUrl, parseError, parseEstimate, requestKey, type Estimate, type EstimateRequest, type EstimateResult } from "../shared/api";
import { BUNDLED_COUNTRIES, normalizeCountries, type ApiCountry, type CountryInfo } from "../shared/countries";
import type { Message, Usage } from "../shared/messages";
import { loadSettings, SETTINGS_KEY } from "../shared/settings";
import { ANONYMOUS, WITH_KEY, applyServerHeaders, block, check, emptyState, record, type LimiterState } from "./limiter";

const api = ext();

const CACHE_KEY = "estimateCache";
const LIMITER_KEY = "limiter";
const COUNTRIES_KEY = "countries";
const CACHE_TTL = 7 * 86_400_000;
const NEGATIVE_TTL = 86_400_000;
const CACHE_MAX = 400;
const COUNTRIES_TTL = 7 * 86_400_000;

type CacheEntry = { t: number; e?: Estimate; err?: EstimateResult };
type Cache = Record<string, CacheEntry>;

// One queue for every read-modify-write of storage, so concurrent messages don't overwrite each other.
let lock: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

async function getCache(): Promise<Cache> {
  const got = await api.storage.local.get(CACHE_KEY);
  return (got?.[CACHE_KEY] as Cache) ?? {};
}

async function putCache(key: string, entry: CacheEntry): Promise<void> {
  await serial(async () => {
    const cache = await getCache();
    cache[key] = entry;
    const keys = Object.keys(cache);
    if (keys.length > CACHE_MAX) {
      keys.sort((a, b) => cache[a].t - cache[b].t);
      for (const k of keys.slice(0, keys.length - CACHE_MAX)) delete cache[k];
    }
    await api.storage.local.set({ [CACHE_KEY]: cache });
  });
}

async function getLimiter(): Promise<LimiterState> {
  const got = await api.storage.local.get(LIMITER_KEY);
  return { ...emptyState(), ...((got?.[LIMITER_KEY] as LimiterState) ?? {}) };
}

/** Reserves one request slot, or says how long to wait. */
async function reserve(hasKey: boolean): Promise<{ ok: true } | { ok: false; retryAfterMs: number; daily: boolean }> {
  return serial(async () => {
    const now = Date.now();
    const state = await getLimiter();
    const c = check(state, now, hasKey ? WITH_KEY : ANONYMOUS);
    if (!c.ok) return c;
    await api.storage.local.set({ [LIMITER_KEY]: record(state, now) });
    return { ok: true as const };
  });
}

async function updateLimiter(fn: (s: LimiterState, now: number) => LimiterState): Promise<void> {
  await serial(async () => {
    const state = await getLimiter();
    await api.storage.local.set({ [LIMITER_KEY]: fn(state, Date.now()) });
  });
}

async function apiFetch(url: string, apiKey: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["X-API-Key"] = apiKey;
  // No cookies, no referrer: the API only ever sees the query string and the optional key.
  return fetch(url, { headers, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
}

const inflight = new Map<string, Promise<EstimateResult>>();

async function estimate(req: EstimateRequest): Promise<EstimateResult> {
  const key = requestKey(req);
  const cached = (await getCache())[key];
  if (cached) {
    const age = Date.now() - cached.t;
    if (cached.e && age < CACHE_TTL) return { ok: true, estimate: cached.e, cached: true };
    if (cached.err && age < NEGATIVE_TTL) return cached.err;
  }
  const running = inflight.get(key);
  if (running) return running;
  const p = fetchEstimate(req, key).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function fetchEstimate(req: EstimateRequest, key: string): Promise<EstimateResult> {
  const settings = await loadSettings();
  const hasKey = Boolean(settings.apiKey);
  const slot = await reserve(hasKey);
  if (!slot.ok) {
    return {
      ok: false,
      error: slot.daily ? "daily_limit" : "rate_limited",
      message: slot.daily ? "Today's free estimates are used up." : "Waiting to stay within the API's per-minute limit.",
      retryAfterMs: slot.retryAfterMs,
    };
  }
  let res: Response;
  try {
    res = await apiFetch(netSalaryUrl(req), settings.apiKey);
  } catch {
    return { ok: false, error: "network", message: "Could not reach calcbloc.com.", retryAfterMs: 30_000 };
  }
  const h = res.headers;
  await updateLimiter((s, now) => applyServerHeaders(s, now, h.get("X-RateLimit-Remaining"), h.get("X-RateLimit-Reset"), h.get("X-RateLimit-Limit")));
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.ok) {
    const e = parseEstimate(body);
    if (!e) return { ok: false, error: "server_error", message: "Unexpected response from calcbloc.com.", retryAfterMs: 60_000 };
    await putCache(key, { t: Date.now(), e });
    return { ok: true, estimate: e };
  }
  const err = parseError(res.status, body, h.get("Retry-After"));
  if (!err.ok && (err.error === "rate_limited" || err.error === "daily_limit") && err.retryAfterMs) {
    const wait = err.retryAfterMs;
    const daily = err.error === "daily_limit";
    await updateLimiter((s, now) => block(s, now, wait, daily));
  }
  if (!err.ok && (err.error === "unsupported_country" || err.error === "bad_request")) await putCache(key, { t: Date.now(), err });
  return err;
}

async function countries(refresh = false): Promise<CountryInfo[]> {
  const got = await api.storage.local.get(COUNTRIES_KEY);
  const stored = got?.[COUNTRIES_KEY] as { t: number; list: ApiCountry[] } | undefined;
  const fresh = stored && Date.now() - stored.t < COUNTRIES_TTL;
  if (stored && fresh && !refresh) return normalizeCountries(stored.list);
  const settings = await loadSettings();
  const slot = await reserve(Boolean(settings.apiKey));
  if (slot.ok) {
    try {
      const res = await apiFetch(`${API_BASE}/countries`, settings.apiKey);
      if (res.ok) {
        const body = (await res.json()) as { countries?: ApiCountry[] };
        if (Array.isArray(body.countries) && body.countries.length > 0) {
          const list = normalizeCountries(body.countries);
          if (list.length > 0) {
            await api.storage.local.set({ [COUNTRIES_KEY]: { t: Date.now(), list: body.countries } });
            return list;
          }
        }
      }
    } catch {
      /* offline: fall back below */
    }
  }
  return stored ? normalizeCountries(stored.list) : BUNDLED_COUNTRIES;
}

async function usage(): Promise<Usage> {
  const [settings, state, cache] = await Promise.all([loadSettings(), getLimiter(), getCache()]);
  const today = new Date().toISOString().slice(0, 10);
  const limits = settings.apiKey ? WITH_KEY : ANONYMOUS;
  const usedToday = state.day.date === today ? state.day.count : 0;
  const blockedForToday = state.blockedDaily && state.blockedUntil > Date.now();
  return {
    hasKey: Boolean(settings.apiKey),
    usedToday,
    perDay: limits.perDay,
    cachedEstimates: Object.values(cache).filter((c) => c.e).length,
    limitReached: !settings.apiKey && (blockedForToday || usedToday >= limits.perDay),
  };
}

function handle(msg: Message): Promise<unknown> {
  switch (msg?.type) {
    case "estimate":
      return estimate(msg.request);
    case "countries":
      return countries(Boolean(msg.refresh));
    case "usage":
      return usage();
    case "clearCache":
      return api.storage.local.remove([CACHE_KEY, LIMITER_KEY]).then(() => ({ ok: true }));
    case "openOptions":
      return api.runtime.openOptionsPage().then(() => ({ ok: true }));
    default:
      return Promise.resolve({ ok: false });
  }
}

api.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
  // Only this extension's own pages and content scripts can message it.
  if (sender.id !== api.runtime.id) return false;
  handle(msg).then(sendResponse, () => sendResponse({ ok: false, error: "server_error", message: "Internal error" }));
  return true;
});

// A new or removed API key has its own limits: forget the local count and any block from the old one, so adding a
// key after the free daily estimates ran out works at once.
api.storage.onChanged.addListener((changes, area) => {
  const change = area === "local" ? changes[SETTINGS_KEY] : undefined;
  if (!change) return;
  const before = (change.oldValue as { apiKey?: string } | undefined)?.apiKey ?? "";
  const after = (change.newValue as { apiKey?: string } | undefined)?.apiKey ?? "";
  if (before !== after) void serial(() => api.storage.local.remove(LIMITER_KEY));
});

api.action.onClicked.addListener(() => {
  void api.runtime.openOptionsPage();
});

api.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") void api.runtime.openOptionsPage();
});

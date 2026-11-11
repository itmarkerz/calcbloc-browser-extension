/**
 * Content script. Runs only on the supported job sites (see src/shared/sites.ts). Finds salary figures,
 * adds a badge next to each and asks the background worker for the estimate. It reads nothing else from
 * the page and stores nothing about it. Any failure ends quietly: the page is left as it was.
 */
import { ext } from "../shared/browser";
import { BUNDLED_COUNTRIES, regionName, type CountryInfo } from "../shared/countries";
import type { EstimateRequest, EstimateResult } from "../shared/api";
import { requestKey } from "../shared/api";
import type { Message } from "../shared/messages";
import { currencyHintsForHost, siteForHost } from "../shared/sites";
import { loadSettings, SETTINGS_KEY, type Settings } from "../shared/settings";
import { ADAPTERS, type Adapter } from "./adapters";
import { Badge, placeLabel } from "./badge";
import { findCandidates } from "./scan";
import { planFor, type Plan } from "./plan";

const api = ext();
const SIG = "data-calcbloc-sig";

interface Item {
  el: Element;
  badge: Badge;
  plan: Extract<Plan, { kind: "estimate" }>;
  started: boolean;
}

let settings: Settings | null = null;
let countries: CountryInfo[] = BUNDLED_COUNTRIES;
let adapter: Adapter | null = null;
let hints = {};
const items = new Map<Element, Item>();
const results = new Map<string, Promise<EstimateResult>>();
let observer: IntersectionObserver | null = null;

function send<T>(msg: Message): Promise<T> {
  try {
    return Promise.resolve(api.runtime.sendMessage(msg) as Promise<T>);
  } catch (e) {
    // "Extension context invalidated" after an update: give up quietly.
    return Promise.reject(e);
  }
}

const openOptions = () => void send({ type: "openOptions" }).catch(() => undefined);

/** One message per distinct request on the page; retried after the wait the background asks for. */
function requestEstimate(req: EstimateRequest, attempt = 0): Promise<EstimateResult> {
  const key = requestKey(req);
  const known = results.get(key);
  if (known) return known;
  const p: Promise<EstimateResult> = send<EstimateResult>({ type: "estimate", request: req }).then(
    (r) => (r && typeof r === "object" ? r : { ok: false, error: "server_error", message: "No response", retryAfterMs: 15_000 }),
    () => ({ ok: false, error: "network", message: "Extension unavailable", retryAfterMs: 10_000 * (attempt + 1) }),
  );
  results.set(key, p);
  void p.then((r) => {
    // Rate limited or offline: forget this attempt so the next try sends a fresh message.
    if (!r.ok && (r.error === "rate_limited" || r.error === "network" || r.error === "server_error")) results.delete(key);
  });
  return p;
}

async function run(item: Item, attempt = 0): Promise<void> {
  if (!item.el.isConnected) return;
  item.badge.pending();
  const out = await Promise.all(item.plan.requests.map((r) => requestEstimate(r, attempt)));
  if (!item.el.isConnected) return;
  const failed = out.find((r) => !r.ok);
  if (failed && !failed.ok) {
    if ((failed.error === "rate_limited" || failed.error === "network" || failed.error === "server_error") && attempt < 20) {
      item.badge.waiting(failed.error === "rate_limited" ? "Waiting to stay within the free API limit." : "Will try again shortly.");
      setTimeout(() => run(item, attempt + 1).catch(() => undefined), Math.min(failed.retryAfterMs ?? 15_000, 120_000));
      return;
    }
    if (failed.error === "daily_limit" || failed.error === "api_key_required" || failed.error === "invalid_key") return item.badge.limit(failed.error, Boolean(settings?.apiKey));
    if (failed.error === "unsupported_country") return item.badge.tablesOnly(item.plan.country.name, item.plan.country.year, item.plan.country.taxTablesUrl);
    return item.badge.unavailable(failed.message);
  }
  const s = settings!;
  const region = item.plan.requests[0].params.region;
  item.badge.result({
    estimates: out.map((r) => (r as Extract<EstimateResult, { ok: true }>).estimate),
    period: item.plan.match.period,
    annual: item.plan.annual,
    hoursPerWeek: s.hoursPerWeek,
    placeLabel: placeLabel(item.plan.country.name, typeof region === "string" ? regionName(item.plan.country.code, region) : undefined),
    calculatorUrl: item.plan.calculatorUrl,
    convertedFromHourly: item.plan.match.period === "hour",
  });
}

function onVisible(entries: IntersectionObserverEntry[]) {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const item = items.get(e.target);
    observer?.unobserve(e.target);
    if (item && !item.started) {
      item.started = true;
      run(item).catch(() => undefined);
    }
  }
}

function attach(el: Element, text: string) {
  const old = el.querySelector(":scope > [data-calcbloc-badge]");
  const plan = planFor(text, { settings: settings!, countries, hints });
  el.setAttribute(SIG, text);
  old?.remove();
  items.delete(el);
  if (!plan) return;
  const badge = new Badge({ openOptions });
  el.appendChild(badge.host);
  if (plan.kind === "setup") return badge.setup(plan.reason);
  if (plan.kind === "tables") return badge.tablesOnly(plan.country.name, plan.country.year, plan.country.taxTablesUrl);
  badge.pending();
  const item: Item = { el, badge, plan, started: false };
  items.set(el, item);
  // Only fetch estimates for salaries that come into view: saves the user's daily allowance.
  if (observer) observer.observe(el);
  else {
    item.started = true;
    run(item).catch(() => undefined);
  }
}

function scan() {
  if (!settings?.enabled || !adapter) return;
  if (!adapter.isJobPage(new URL(location.href))) return;
  for (const { el, text } of findCandidates(document, adapter)) {
    if (el.getAttribute(SIG) === text) continue;
    try {
      attach(el, text);
    } catch {
      /* leave this element alone */
    }
  }
}

let scheduled = 0;
function scheduleScan() {
  if (scheduled) return;
  scheduled = window.setTimeout(() => {
    scheduled = 0;
    scan();
  }, 350);
}

function resetAll() {
  for (const b of document.querySelectorAll("[data-calcbloc-badge]")) b.remove();
  for (const e of document.querySelectorAll(`[${SIG}]`)) e.removeAttribute(SIG);
  items.clear();
  results.clear();
  scheduleScan();
}

async function main() {
  const site = siteForHost(location.hostname);
  if (!site) return;
  adapter = ADAPTERS[site.id] ?? null;
  if (!adapter) return;
  hints = currencyHintsForHost(location.hostname);
  settings = await loadSettings();
  try {
    const list = await send<CountryInfo[]>({ type: "countries" });
    if (Array.isArray(list) && list.length) countries = list;
  } catch {
    /* use the bundled list */
  }
  if (typeof IntersectionObserver === "function") observer = new IntersectionObserver(onVisible, { rootMargin: "200px" });
  Badge.installGlobalClose();
  scan();
  new MutationObserver((records) => {
    // Ignore our own badge insertions.
    if (records.every((r) => [...r.addedNodes].every((n) => n instanceof Element && n.hasAttribute("data-calcbloc-badge")))) return;
    scheduleScan();
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[SETTINGS_KEY]) return;
    void loadSettings().then((s) => {
      settings = s;
      resetAll();
    });
  });
}

main().catch(() => undefined);

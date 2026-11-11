/**
 * The badge shown next to a salary. Rendered in a shadow root so the job site's styles cannot change
 * it and it cannot change the site. All text is set with textContent; links only ever point to calcbloc.com.
 */
import type { Estimate } from "../shared/api";
import type { Period } from "../shared/parser";
import { money, moneyRange, percent, PERIOD_LONG, PERIOD_SHORT } from "./format";

const CSS = `
:host { all: initial; display: inline-block; vertical-align: middle; margin: 0 0 0 6px; }
* { box-sizing: border-box; }
.pill {
  font: 600 12px/1.25 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  display: inline-flex; align-items: center; gap: 5px; max-width: 320px;
  padding: 3px 9px 3px 4px; border-radius: 999px; border: 1px solid #c9d3fb;
  background: #eef2ff; color: #1238b8; cursor: pointer; white-space: nowrap; text-align: left;
}
.pill:hover, .pill:focus-visible { background: #e1e8ff; outline: 2px solid #1f4fe0; outline-offset: 1px; }
.pill.muted { color: #4b4b57; background: #f4f4f6; border-color: #dcdce2; font-weight: 500; }
.pill.warn { color: #7a2a00; background: #fff4e5; border-color: #f3d2a8; }
.logo { width: 16px; height: 16px; border-radius: 4px; background: #1f4fe0; position: relative; flex: none; }
.logo::before { content: ""; position: absolute; left: 3px; top: 3px; width: 5px; height: 2px; border-radius: 1px; background: #f4f2ea; box-shadow: 0 3px 0 -0.2px #f4f2ea; }
.logo::after { content: ""; position: absolute; right: 2.5px; bottom: 2.5px; width: 5px; height: 5px; border-radius: 1.5px; background: #f4f2ea; }
.text { overflow: hidden; text-overflow: ellipsis; }
.panel {
  position: fixed; z-index: 2147483647; top: 0; left: 0; width: 300px; max-width: calc(100vw - 16px); padding: 12px 14px;
  font: 400 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #111114;
  background: #fff; border: 1px solid #d9d9e3; border-radius: 10px; box-shadow: 0 8px 24px rgb(17 17 20 / 0.16);
  white-space: normal; cursor: default;
}
.panel[hidden] { display: none; }
.panel h2 { font: 700 13px/1.3 inherit; font-family: inherit; margin: 0 0 6px; }
.panel dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0 0 8px; }
.panel dt { color: #5b5b66; }
.panel dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
.panel p { margin: 0 0 8px; color: #5b5b66; font-size: 12px; }
.panel a { color: #1f4fe0; text-decoration: underline; text-underline-offset: 2px; }
.panel .cta { display: block; margin: 0 0 8px; font-weight: 600; }
.panel .foot { display: flex; justify-content: space-between; gap: 8px; border-top: 1px solid #ececf1; padding-top: 8px; font-size: 12px; }
.panel button.link { all: unset; color: #1f4fe0; text-decoration: underline; cursor: pointer; font-size: 12px; }
@media (prefers-color-scheme: dark) {
  .pill { background: #1c2350; color: #c9d4ff; border-color: #34408a; }
  .pill:hover { background: #242d63; }
  .pill.muted { background: #26262c; color: #c7c7d1; border-color: #3a3a44; }
  .pill.warn { background: #3a2410; color: #ffd8a8; border-color: #6b4419; }
  .panel { background: #161731; color: #f4f2ea; border-color: #2c2e52; }
  .panel dt, .panel p { color: #a6a6b5; }
  .panel a, .panel button.link { color: #8fa8ff; }
  .panel .foot { border-color: #2c2e52; }
}
`;

export interface Detail {
  estimates: Estimate[];
  period: Period;
  /** Gross annual figures used for the requests. */
  annual: [number, number];
  hoursPerWeek: number;
  placeLabel: string;
  calculatorUrl: string;
  convertedFromHourly: boolean;
}

export interface BadgeActions {
  openOptions(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

function stop(e: Event) {
  // The salary often sits inside a job card that is itself a link: keep clicks on the badge to the badge.
  e.stopPropagation();
}

export class Badge {
  readonly host: HTMLSpanElement;
  private root: ShadowRoot;
  private pill: HTMLButtonElement;
  private label: HTMLSpanElement;
  private panel: HTMLDivElement;
  private onPillClick: () => void = () => {};

  constructor(private actions: BadgeActions) {
    this.host = document.createElement("span");
    this.host.setAttribute("data-calcbloc-badge", "");
    this.root = this.host.attachShadow({ mode: "open" });
    const style = el("style");
    style.textContent = CSS;
    this.pill = el("button", { type: "button", class: "pill", part: "pill" });
    this.pill.append(el("span", { class: "logo", "aria-hidden": "true" }));
    this.label = el("span", { class: "text" });
    this.pill.append(this.label);
    this.panel = el("div", { class: "panel", role: "dialog", hidden: "" });
    this.root.append(style, this.pill, this.panel);
    for (const t of ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "keydown"]) this.host.addEventListener(t, stop);
    this.pill.addEventListener("click", (e) => {
      e.preventDefault();
      this.onPillClick();
    });
  }

  private set(text: string, title: string, tone: "" | "muted" | "warn" = "") {
    this.label.textContent = text;
    this.pill.title = title;
    this.pill.className = `pill${tone ? " " + tone : ""}`;
    this.host.setAttribute("data-state", tone || "ok");
  }

  pending() {
    this.set("Take-home…", "Working out the take-home pay. Data by CalcBloc (calcbloc.com)", "muted");
    this.host.setAttribute("data-state", "pending");
    this.onPillClick = () => {};
  }

  waiting(reason: string) {
    this.set("Take-home: queued", `${reason} Data by CalcBloc (calcbloc.com)`, "muted");
    this.host.setAttribute("data-state", "queued");
  }

  setup(reason: "country" | "region") {
    const text = reason === "country" ? "Take-home: choose your country" : "Take-home: choose your region";
    this.set(text, "Open CalcBloc settings to show take-home pay for salaries", "warn");
    this.host.setAttribute("data-state", "setup");
    this.onPillClick = () => this.actions.openOptions();
  }

  limit(kind: "daily_limit" | "api_key_required" | "invalid_key") {
    const text = kind === "invalid_key" ? "Take-home: check your API key" : "Take-home: daily limit reached";
    this.set(text, "Add a free CalcBloc API key in the settings for up to 5,000 estimates a day", "warn");
    this.host.setAttribute("data-state", kind);
    this.onPillClick = () => this.actions.openOptions();
  }

  unavailable(message: string) {
    this.set("Take-home unavailable", message, "muted");
    this.host.setAttribute("data-state", "error");
    this.onPillClick = () => {};
  }

  /** Countries with tax tables only: link to the tables instead of an estimate. */
  tablesOnly(countryName: string, year: string | undefined, url: string) {
    this.set(`${countryName} tax tables`, `No take-home estimate for ${countryName} yet. Open the ${year ?? ""} tax tables on calcbloc.com. Data by CalcBloc`, "muted");
    this.host.setAttribute("data-state", "tables");
    this.onPillClick = () => window.open(url, "_blank", "noopener,noreferrer");
  }

  result(d: Detail) {
    const cur = d.estimates[0].currency;
    const scale = (annual: number) => (d.period === "year" ? annual : d.period === "month" ? annual / 12 : d.period === "week" ? annual / 52 : annual / (d.hoursPerWeek * 52));
    const nets = d.estimates.map((e) => e.netAnnual);
    const lo = Math.min(...nets);
    const hi = Math.max(...nets);
    const decimals = d.period === "hour" ? 2 : 0;
    this.set(`≈ ${moneyRange(scale(lo), scale(hi), cur, decimals)}${PERIOD_SHORT[d.period]} take-home`, `Estimated take-home pay ${PERIOD_LONG[d.period]}. Click for details. Data by CalcBloc (calcbloc.com)`);
    this.host.setAttribute("data-state", "result");

    // Details panel
    this.panel.replaceChildren();
    this.panel.append(el("h2", {}, "Estimated take-home pay"));
    const dl = el("dl");
    const row = (k: string, v: string) => dl.append(el("dt", {}, k), el("dd", {}, v));
    row("Gross a year", moneyRange(d.annual[0], d.annual[1], cur));
    row("Take-home a year", moneyRange(lo, hi, cur));
    row("Take-home a month", moneyRange(lo / 12, hi / 12, cur));
    if (d.period === "hour" || d.period === "week") row(`Take-home ${PERIOD_LONG[d.period]}`, moneyRange(scale(lo), scale(hi), cur, decimals));
    const rate = d.estimates[0].effectiveRate;
    if (rate !== null && d.estimates.length === 1) row("Effective rate", percent(rate));
    this.panel.append(dl);
    const year = d.estimates[0].year;
    let basis = `${d.placeLabel}${year ? `, tax year ${year}` : ""}, using your settings.`;
    if (d.convertedFromHourly) basis += ` Hourly pay counted at ${d.hoursPerWeek} hours a week, 52 weeks.`;
    this.panel.append(el("p", {}, `${basis} An estimate, not tax advice.`));
    const cta = el("a", { class: "cta", href: d.calculatorUrl, target: "_blank", rel: "noopener noreferrer" }, "Open the full calculator on calcbloc.com →");
    this.panel.append(cta);
    const foot = el("div", { class: "foot" });
    const credit = el("a", { href: d.estimates[0].attributionUrl, target: "_blank", rel: "noopener noreferrer" }, "Data by CalcBloc");
    const settings = el("button", { type: "button", class: "link" }, "Settings");
    settings.addEventListener("click", (e) => {
      e.preventDefault();
      this.actions.openOptions();
    });
    foot.append(credit, settings);
    this.panel.append(foot);
    this.onPillClick = () => this.toggle();
  }

  toggle(open?: boolean) {
    const show = open ?? this.panel.hidden;
    if (show) {
      // Fixed position so a job card with overflow: hidden cannot clip the panel.
      const r = this.pill.getBoundingClientRect();
      const width = Math.min(300, window.innerWidth - 16);
      this.panel.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - width - 8))}px`;
      this.panel.style.top = `${Math.min(r.bottom + 6, Math.max(8, window.innerHeight - 330))}px`;
      Badge.openBadge?.toggle(false);
      Badge.openBadge = this;
    } else if (Badge.openBadge === this) {
      Badge.openBadge = null;
    }
    this.panel.hidden = !show;
    this.pill.setAttribute("aria-expanded", String(show));
  }

  /** Only one panel open at a time; it closes on scroll, Escape or a click elsewhere. */
  static openBadge: Badge | null = null;

  static installGlobalClose() {
    const close = () => Badge.openBadge?.toggle(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close, { passive: true });
    document.addEventListener("click", (e) => {
      if (Badge.openBadge && !e.composedPath().includes(Badge.openBadge.host)) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  /** For tests and the demo: the badge's visible text. */
  get text(): string {
    return this.label.textContent ?? "";
  }
}

/** Small helper for the panel's place line, e.g. "United Kingdom (England and Northern Ireland)". */
export function placeLabel(countryName: string, regionName?: string): string {
  return regionName ? `${countryName} (${regionName})` : countryName;
}

export { money };

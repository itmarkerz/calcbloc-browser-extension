/** Options page: country, region, tax basics, hours, optional API key. Everything is saved on change. */
import { ext } from "../shared/browser";
import { appLink } from "../shared/calculator-links";
import { BUNDLED_COUNTRIES, findCountry, type ApiParameter, type CountryInfo } from "../shared/countries";
import type { Message, Usage } from "../shared/messages";
import { SITES } from "../shared/sites";
import { API_KEY_PATTERN, loadSettings, saveSettings, type Settings } from "../shared/settings";

const api = ext();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const REGION_LABEL: Record<string, string> = {
  us: "State",
  canada: "Province or territory",
  uk: "Where you live",
  germany: "Federal state (Bundesland)",
  spain: "Region (comunidad autónoma)",
  india: "State you work in",
};

/** Friendlier labels for common parameter values; anything else is shown as given. */
const VALUE_LABEL: Record<string, string> = {
  single: "Single",
  mfj: "Married filing jointly",
  hoh: "Head of household",
  netpay: "Net pay arrangement",
  ras: "Relief at source",
  sacrifice: "Salary sacrifice",
  none: "None",
  plan1: "Plan 1",
  plan2: "Plan 2",
  plan4: "Plan 4",
  plan5: "Plan 5",
  plus: "Super paid on top of salary",
  package: "Salary includes super",
  resident: "Resident",
  foreign: "Foreign resident",
  whm: "Working holiday maker",
  citizen: "Citizen or PR",
  nonResident: "Non-resident",
  permanent: "Permanent",
  temporary: "Temporary (fixed-term)",
  other: "Other",
  spouseLowIncome: "Spouse with low income",
  singleParent: "Single parent",
  under65: "Under 65",
  "65to74": "65 to 74",
  "75plus": "75 or over",
  new: "New regime",
  old: "Old regime",
  below60: "Below 60",
  senior: "60 to 79",
  superSenior: "80 or over",
  capped: "Capped (on the wage ceiling)",
  full: "On full basic pay",
  "single-parent": "Single parent",
  widowed: "Widowed",
  "married-one": "Married, one income",
  "married-two": "Married, two incomes",
};

function labelFor(p: ApiParameter): string {
  const words = p.name.replace(/_pct$/, "").replace(/_/g, " ");
  const base = words.charAt(0).toUpperCase() + words.slice(1);
  return p.name.endsWith("_pct") ? `${base} (%)` : base;
}

let settings: Settings;
let countries: CountryInfo[] = BUNDLED_COUNTRIES;

function send<T>(msg: Message): Promise<T> {
  return api.runtime.sendMessage(msg) as Promise<T>;
}

let statusTimer = 0;
function status(text: string, warn = false) {
  const el = $("status");
  el.textContent = text;
  el.className = `status${warn ? " warn" : ""}`;
  clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => (el.textContent = ""), 2500);
}

async function persist(message = "Saved") {
  await saveSettings(settings);
  status(message);
  void refreshUsage();
}

function renderCountries() {
  const sel = $<HTMLSelectElement>("country");
  sel.length = 1;
  const withEstimates = countries.filter((c) => c.netSalary);
  const tablesOnly = countries.filter((c) => !c.netSalary);
  const group = (label: string, list: CountryInfo[]) => {
    const g = document.createElement("optgroup");
    g.label = label;
    for (const c of list) g.append(new Option(`${c.name} (${c.currency})`, c.code));
    sel.append(g);
  };
  group("Take-home estimates", withEstimates);
  if (tablesOnly.length) group("Tax tables only (link, no estimate yet)", tablesOnly);
  sel.value = settings.country;
}

function renderCountryDetails() {
  const c = findCountry(countries, settings.country);
  const note = $("country-note");
  const regionField = $("region-field");
  const basicsSection = $("basics-section");
  const basics = $("basics");
  basics.replaceChildren();
  regionField.hidden = true;
  basicsSection.hidden = true;
  note.hidden = true;
  if (!c) return;
  if (!c.netSalary) {
    note.hidden = false;
    note.replaceChildren();
    note.append(`CalcBloc has tax tables for ${c.name} but no take-home calculator yet. Salaries will show a link to the `);
    const a = document.createElement("a");
    a.href = appLink(c.taxTablesUrl);
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = `${c.name} tax tables`;
    note.append(a, " instead of an estimate.");
    return;
  }
  const ns = c.netSalary;
  if (ns.region) {
    regionField.hidden = false;
    $("region-label").textContent = REGION_LABEL[c.code] ?? "Region";
    const sel = $<HTMLSelectElement>("region");
    sel.length = 0;
    if (ns.region.required) sel.append(new Option("Choose…", ""));
    for (const o of ns.region.options) sel.append(new Option(o.name, o.code));
    sel.value = settings.region && ns.region.options.some((o) => o.code === settings.region) ? settings.region : (ns.region.default ?? "");
  }
  if (ns.params.length) {
    basicsSection.hidden = false;
    for (const p of ns.params) basics.append(control(p));
  }
}

function control(p: ApiParameter): HTMLElement {
  const current = settings.params[p.name] ?? p.default;
  const help = p.description ?? "";
  if (p.type === "boolean") {
    const wrap = document.createElement("label");
    wrap.className = "check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = current === true;
    input.dataset.param = p.name;
    const text = document.createElement("span");
    text.textContent = help || labelFor(p);
    wrap.append(input, text);
    input.addEventListener("change", () => setParam(p, input.checked));
    return wrap;
  }
  const wrap = document.createElement("label");
  wrap.className = "field";
  const title = document.createElement("span");
  title.textContent = labelFor(p);
  wrap.append(title);
  if (p.type === "enum") {
    const sel = document.createElement("select");
    sel.dataset.param = p.name;
    for (const v of p.values ?? []) sel.append(new Option(VALUE_LABEL[v] ?? v, v));
    sel.value = String(current ?? "");
    sel.addEventListener("change", () => setParam(p, sel.value));
    wrap.append(sel);
  } else {
    const input = document.createElement("input");
    input.type = "number";
    input.dataset.param = p.name;
    if (p.min !== undefined) input.min = String(p.min);
    if (p.max !== undefined) input.max = String(p.max);
    input.step = p.type === "integer" ? "1" : "any";
    input.value = current === undefined ? "" : String(current);
    input.addEventListener("change", () => {
      const n = Number(input.value);
      if (input.value === "" || !Number.isFinite(n)) return setParam(p, undefined);
      const clamped = Math.min(p.max ?? Infinity, Math.max(p.min ?? -Infinity, p.type === "integer" ? Math.round(n) : n));
      input.value = String(clamped);
      setParam(p, clamped);
    });
    wrap.append(input);
  }
  if (help) {
    const small = document.createElement("small");
    small.textContent = help;
    wrap.append(small);
  }
  return wrap;
}

function setParam(p: ApiParameter, value: string | number | boolean | undefined) {
  if (value === undefined || value === p.default) delete settings.params[p.name];
  else settings.params[p.name] = value;
  void persist();
}

async function refreshUsage() {
  try {
    const u = await send<Usage>({ type: "usage" });
    $("usage").textContent = `Estimates looked up today: ${u.usedToday} of ${u.perDay.toLocaleString()} ${u.hasKey ? "(with your key)" : "(no key)"}. Cached on this device: ${u.cachedEstimates}.`;
    // Out of free estimates without a key: ask for the free key, next to the field it goes in.
    $("key-needed").hidden = !u.limitReached;
  } catch {
    $("usage").textContent = "";
  }
}

function renderSites() {
  const ul = $("sites");
  for (const s of SITES) {
    const li = document.createElement("li");
    const hosts = [...new Set(s.matches.map((m) => m.replace(/^https:\/\/(\*\.)?/, "").replace(/\/\*$/, "")))];
    li.textContent = `${s.name} (${hosts.join(", ")})`;
    ul.append(li);
  }
}

async function init() {
  settings = await loadSettings();
  renderSites();
  renderCountries();
  renderCountryDetails();
  $<HTMLInputElement>("hours").value = String(settings.hoursPerWeek);
  $<HTMLInputElement>("apikey").value = settings.apiKey;
  $<HTMLInputElement>("enabled").checked = settings.enabled;
  void refreshUsage();

  $("country").addEventListener("change", () => {
    settings.country = $<HTMLSelectElement>("country").value;
    settings.region = "";
    settings.params = {};
    renderCountryDetails();
    const c = findCountry(countries, settings.country);
    if (c?.netSalary?.region && !c.netSalary.region.required) settings.region = c.netSalary.region.default ?? "";
    void persist(c?.netSalary?.region?.required ? `Saved. Now choose your ${(REGION_LABEL[c.code] ?? "region").toLowerCase()}.` : "Saved");
  });
  $("region").addEventListener("change", () => {
    settings.region = $<HTMLSelectElement>("region").value;
    void persist();
  });
  $("hours").addEventListener("change", () => {
    const n = Number($<HTMLInputElement>("hours").value);
    if (Number.isFinite(n) && n >= 1 && n <= 80) {
      settings.hoursPerWeek = n;
      void persist();
    } else status("Hours must be between 1 and 80", true);
  });
  $("apikey").addEventListener("change", () => {
    const key = $<HTMLInputElement>("apikey").value.trim();
    if (key && !API_KEY_PATTERN.test(key)) {
      status("That doesn't look like a CalcBloc key (cb_ followed by 32 letters and digits)", true);
      return;
    }
    settings.apiKey = key;
    void persist(settings.apiKey ? "Key saved" : "Key removed");
  });
  $("enabled").addEventListener("change", () => {
    settings.enabled = $<HTMLInputElement>("enabled").checked;
    void persist(settings.enabled ? "Turned on" : "Turned off");
  });
  $("clear").addEventListener("click", async () => {
    await send({ type: "clearCache" });
    status("Cached estimates cleared");
    void refreshUsage();
  });
  $("form").addEventListener("submit", (e) => e.preventDefault());

  // Newer country list from the API (at most weekly; falls back to the bundled list).
  try {
    const list = await send<CountryInfo[]>({ type: "countries" });
    if (Array.isArray(list) && list.length) {
      countries = list;
      renderCountries();
      renderCountryDetails();
    }
  } catch {
    /* keep the bundled list */
  }
}

void init();

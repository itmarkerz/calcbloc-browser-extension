/**
 * Links from a badge to the matching calculator on calcbloc.com, pre-filled with the salary, region and
 * filing basics. Calculator pages read their inputs from the query string; the query keys differ from the API
 * parameter names, so this table maps one to the other (taken from the calculator configurations on
 * calcbloc.com). A calculator missing from the table is linked without pre-filled values.
 */
import type { CountryInfo } from "./countries";
import type { Settings } from "./settings";

type QueryMap = Record<string, string>;

/** Calculator path -> { API parameter name: calculator query key }. "salary" and "region" included. */
export const PREFILL: Record<string, QueryMap> = {
  "/us/paycheck-calculator": {
    salary: "salary", region: "state", filing_status: "status", multiple_jobs: "w4s2", children: "kids",
    other_dependents: "deps", retirement_pct: "401k",
  },
  "/uk/take-home-pay-calculator": {
    salary: "salary", region: "region", pension_pct: "pension", pension_method: "pmethod", student_loan: "loan",
    postgraduate_loan: "pgl", over_state_pension_age: "spa",
  },
  "/australia/pay-calculator": {
    salary: "salary", super_mode: "super", residency: "res", tax_free_threshold: "tft", help_debt: "help",
    salary_sacrifice: "ss", private_hospital_cover: "cover",
  },
  "/new-zealand/paye-calculator": { salary: "salary", tax_code: "code", student_loan: "sl", kiwisaver_rate: "ks" },
  "/canada/canada-income-tax-calculator": { salary: "salary", region: "prov", rrsp: "rrsp", dependants: "deps" },
  "/ireland/ireland-salary-calculator": {
    salary: "salary", status: "status", pension_pct: "pension", age_band: "age", medical_card: "medcard",
  },
  "/india/ctc-to-in-hand-salary-calculator": {
    salary: "ctc", region: "state", regime: "regime", age: "age", basic_pct: "basic", pf_mode: "pf", gratuity_in_ctc: "grat",
  },
  "/germany/germany-net-salary-calculator": {
    salary: "salary", region: "state", tax_class: "class", church: "church", children: "kids", over_23: "age23",
    health_add_on_pct: "kvz",
  },
  "/spain/spain-net-salary-calculator": {
    salary: "gross", region: "region", payments: "pagas", contract: "contract", under_one_year: "lt1y", situation: "sit",
    children: "kids", children_under_3: "u3", age: "age",
  },
  "/france/france-net-salary-calculator": { salary: "gross", cadre: "cadre", children: "kids" },
  "/netherlands/netherlands-net-salary-calculator": {
    salary: "salary", holiday_allowance: "hol", pension_pct: "pens", expat_ruling: "ruling", under_30_masters: "u30",
  },
  "/singapore/singapore-take-home-pay-calculator": { salary: "salary", status: "status", age: "age" },
};

const ALLOWED_ORIGIN = "https://calcbloc.com";

/** Only calcbloc.com links are ever produced, whatever the country data says. */
export function safeCalcblocUrl(url: string | undefined, fallback = `${ALLOWED_ORIGIN}/`): string {
  try {
    const u = new URL(url ?? "");
    if (u.origin === ALLOWED_ORIGIN) return u.toString();
  } catch {
    /* fall through */
  }
  return fallback;
}

/** Referral tag on every calcbloc.com link the extension shows (badge, details panel, settings page). */
const APP_UTM: Record<string, string> = { utm_source: "calcbloc-browser-extension", utm_medium: "app", utm_campaign: "itmarkerz-oss" };

/**
 * A calcbloc.com link as shown to the user: safeCalcblocUrl() plus the referral tag, which names this extension and
 * nothing about the user or the page they are on. API requests never carry it.
 */
export function appLink(url: string | undefined, fallback?: string): string {
  const u = new URL(safeCalcblocUrl(url, fallback));
  if (u.searchParams.has("utm_source")) return u.toString();
  for (const [k, v] of Object.entries(APP_UTM)) u.searchParams.set(k, v);
  return u.toString();
}

const serialize = (v: string | number | boolean) => (typeof v === "boolean" ? (v ? "1" : "0") : String(v));

/** Calculator link for an API request (salary in the API's basis: annual, or monthly for Singapore). */
export function calculatorLink(country: CountryInfo, apiParams: Record<string, string | number | boolean>): string {
  if (!country.netSalary) return safeCalcblocUrl(country.taxTablesUrl);
  const base = safeCalcblocUrl(country.netSalary.calculatorUrl);
  const u = new URL(base);
  const map = PREFILL[u.pathname];
  if (!map) return base;
  for (const [name, value] of Object.entries(apiParams)) {
    const key = map[name];
    if (key && value !== undefined && value !== "") u.searchParams.set(key, serialize(value));
  }
  return u.toString();
}

/** The API parameters for the user's settings (without the salary). */
export function settingsParams(country: CountryInfo, s: Settings): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  const ns = country.netSalary;
  if (!ns) return out;
  if (ns.region) {
    const region = s.region && ns.region.options.some((o) => o.code === s.region) ? s.region : ns.region.default;
    if (region) out.region = region;
  }
  for (const p of ns.params) {
    const v = s.params?.[p.name];
    if (v === undefined || v === "") continue;
    if (p.type === "enum" && !(p.values ?? []).includes(String(v))) continue;
    if ((p.type === "number" || p.type === "integer") && (typeof v !== "number" || !Number.isFinite(v))) continue;
    if (p.type === "boolean" && typeof v !== "boolean") continue;
    if (v === p.default) continue;
    out[p.name] = v;
  }
  return out;
}

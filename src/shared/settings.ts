/** User settings, stored only on this device (storage.local). */
import { ext } from "./browser";

export interface Settings {
  /** CalcBloc country code, e.g. "uk", "us", "germany". Empty until the user picks one. */
  country: string;
  /** Region code where the country has one (US state, Canadian province, UK nation...). */
  region: string;
  /** Filing basics, keyed by API parameter name (e.g. filing_status, tax_class, student_loan). */
  params: Record<string, string | number | boolean>;
  /** Used to turn hourly pay into a yearly salary. */
  hoursPerWeek: number;
  /** Optional free CalcBloc API key (raises the limit from 50 to 5,000 estimates a day). */
  apiKey: string;
  /** Master switch. */
  enabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  country: "",
  region: "",
  params: {},
  hoursPerWeek: 40,
  apiKey: "",
  enabled: true,
};

const KEY = "settings";

/** Free CalcBloc API keys: cb_ followed by 32 letters and digits. */
export const API_KEY_PATTERN = /^cb_[A-Za-z0-9]{32}$/;

export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Settings>;
  const hours = Number(r.hoursPerWeek);
  const params: Settings["params"] = {};
  if (r.params && typeof r.params === "object") {
    for (const [k, v] of Object.entries(r.params)) {
      if (/^[a-z0-9_]{1,40}$/.test(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) params[k] = v;
    }
  }
  return {
    country: typeof r.country === "string" && /^[a-z-]{2,30}$/.test(r.country) ? r.country : "",
    region: typeof r.region === "string" && /^[a-z0-9-]{1,30}$/.test(r.region) ? r.region : "",
    params,
    hoursPerWeek: Number.isFinite(hours) && hours >= 1 && hours <= 80 ? hours : DEFAULT_SETTINGS.hoursPerWeek,
    apiKey: typeof r.apiKey === "string" ? r.apiKey.trim().slice(0, 200) : "",
    enabled: r.enabled !== false,
  };
}

export async function loadSettings(): Promise<Settings> {
  const got = await ext().storage.local.get(KEY);
  return sanitizeSettings(got?.[KEY]);
}

export async function saveSettings(s: Settings): Promise<void> {
  await ext().storage.local.set({ [KEY]: sanitizeSettings(s) });
}

export const SETTINGS_KEY = KEY;

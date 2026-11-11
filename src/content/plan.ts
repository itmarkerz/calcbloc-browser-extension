/**
 * Decides what to show for one salary figure, given the user's settings. Pure logic (no DOM, no network),
 * so it is unit-tested directly.
 */
import type { EstimateRequest } from "../shared/api";
import { calculatorLink, settingsParams } from "../shared/calculator-links";
import { findCountry, type CountryInfo } from "../shared/countries";
import { findSalaries, toAnnual, type ParseOptions, type SalaryMatch } from "../shared/parser";
import type { Settings } from "../shared/settings";

export type Plan =
  | {
      kind: "estimate";
      match: SalaryMatch;
      country: CountryInfo;
      /** One request for a single figure, two for a range (low, high). */
      requests: EstimateRequest[];
      annual: [number, number];
      calculatorUrl: string;
    }
  | { kind: "tables"; match: SalaryMatch; country: CountryInfo }
  | { kind: "setup"; match: SalaryMatch; reason: "country" | "region" };

const DOLLARS = new Set(["USD", "CAD", "AUD", "NZD", "SGD"]);
const KRONER = new Set(["SEK", "NOK", "DKK"]);

/** True when a figure in `found` currency can be read as the user's country's currency. */
export function currencyFits(found: string, countryCurrency: string): boolean {
  if (found === countryCurrency) return true;
  if (found === "$") return DOLLARS.has(countryCurrency);
  if (found === "kr") return KRONER.has(countryCurrency);
  return false;
}

export interface PlanContext {
  settings: Settings;
  countries: CountryInfo[];
  hints: ParseOptions;
}

export function planFor(text: string, ctx: PlanContext): Plan | null {
  const country = ctx.settings.country ? findCountry(ctx.countries, ctx.settings.country) : undefined;
  // Read a bare "$" as the user's dollar when the site gives no hint of its own.
  const hints: ParseOptions = { ...ctx.hints };
  if (!hints.dollarHint && country && (DOLLARS.has(country.currency) || KRONER.has(country.currency))) hints.dollarHint = country.currency;
  const match = findSalaries(text, hints)[0];
  if (!match) return null;
  if (!country) return { kind: "setup", match, reason: "country" };
  if (!currencyFits(match.currency, country.currency)) return null;
  if (!country.netSalary) return { kind: "tables", match, country };

  const ns = country.netSalary;
  const params = settingsParams(country, ctx.settings);
  if (ns.region?.required && !params.region) return { kind: "setup", match, reason: "region" };

  const o = { hoursPerWeek: ctx.settings.hoursPerWeek };
  const lo = toAnnual(match.min, match.period, o);
  const hi = toAnnual(match.max, match.period, o);
  if (lo === null || hi === null) return null;

  const basis = (annual: number, raw: number) => (ns.salaryBasis === "month" ? (match.period === "month" ? raw : annual / 12) : annual);
  const values = [Math.round(basis(lo, match.min))];
  if (match.max !== match.min) values.push(Math.round(basis(hi, match.max)));
  const requests = values.map((salary) => ({ country: country.code, salary, params }));
  return {
    kind: "estimate",
    match,
    country,
    requests,
    annual: [lo, hi],
    calculatorUrl: calculatorLink(country, { salary: values[0], ...params }),
  };
}

/**
 * Country list and per-country take-home parameters, as published by GET https://calcbloc.com/api/v1/countries.
 * A snapshot ships with the extension (src/data, refreshed by `npm run sync:countries`); the background worker
 * replaces it with the live list at most once a week.
 */
import snapshot from "../data/countries.snapshot.json";
import regionNames from "../data/region-names.json";

export interface ApiParameter {
  name: string;
  type: "number" | "integer" | "boolean" | "enum" | string;
  required?: boolean;
  min?: number;
  max?: number;
  default?: string | number | boolean;
  values?: string[];
  unit?: string;
  description?: string;
}

export interface ApiCountry {
  code: string;
  name: string;
  currency: string;
  current_year?: string;
  tables_only?: boolean;
  endpoints: {
    "net-salary"?: { path?: string; calculatorUrl: string; parameters: ApiParameter[] };
    "tax-tables"?: { pageUrl?: string };
  };
}

export interface CountryInfo {
  code: string;
  name: string;
  currency: string;
  year?: string;
  /** Null for countries that have tax tables only (no take-home engine yet). */
  netSalary: {
    calculatorUrl: string;
    /** How the API wants the salary: annual for every country except Singapore (monthly). */
    salaryBasis: "year" | "month";
    region?: { required: boolean; default?: string; options: { code: string; name: string }[] };
    /** Filing basics shown in the options page (everything except salary, year, region and display-only fields). */
    params: ApiParameter[];
  } | null;
  taxTablesUrl: string;
}

/** Parameters that only change how the calculator displays results, or are not "filing basics". */
const HIDDEN_PARAMS = new Set(["salary", "year", "region", "frequency", "bonus", "spouse_income"]);

const NAMES = regionNames as Record<string, Record<string, string>>;

export function regionName(country: string, code: string): string {
  return NAMES[country]?.[code] ?? code.toUpperCase();
}

export function normalizeCountries(list: ApiCountry[]): CountryInfo[] {
  return list
    .filter((c) => c && typeof c.code === "string" && typeof c.currency === "string")
    .map((c) => {
      const ns = c.endpoints?.["net-salary"];
      let netSalary: CountryInfo["netSalary"] = null;
      if (ns && Array.isArray(ns.parameters) && typeof ns.calculatorUrl === "string") {
        const salary = ns.parameters.find((p) => p.name === "salary");
        const region = ns.parameters.find((p) => p.name === "region");
        netSalary = {
          calculatorUrl: ns.calculatorUrl,
          salaryBasis: salary?.description && /^monthly/i.test(salary.description) ? "month" : "year",
          region: region?.values
            ? {
                required: Boolean(region.required),
                default: typeof region.default === "string" ? region.default : undefined,
                options: region.values.map((code) => ({ code, name: regionName(c.code, code) })).sort((a, b) => a.name.localeCompare(b.name)),
              }
            : undefined,
          params: ns.parameters.filter((p) => !HIDDEN_PARAMS.has(p.name)),
        };
      }
      return {
        code: c.code,
        name: c.name,
        currency: c.currency,
        year: c.current_year,
        netSalary,
        taxTablesUrl: c.endpoints?.["tax-tables"]?.pageUrl ?? `https://calcbloc.com/${c.code}/tax-tables`,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const BUNDLED_COUNTRIES: CountryInfo[] = normalizeCountries((snapshot as { countries: ApiCountry[] }).countries);

export function findCountry(list: CountryInfo[], code: string): CountryInfo | undefined {
  return list.find((c) => c.code === code);
}

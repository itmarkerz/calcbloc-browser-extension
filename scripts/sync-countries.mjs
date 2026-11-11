#!/usr/bin/env node
/**
 * Refreshes the bundled country snapshot that the extension uses until (and if) it can fetch a newer list
 * from https://calcbloc.com/api/v1/countries at run time.
 *
 *   node scripts/sync-countries.mjs                       # fetch the live list (uses 1 API request)
 *   node scripts/sync-countries.mjs --from countries.json # use a saved /api/v1/countries response
 *   node scripts/sync-countries.mjs --manifest ../calcbloc-data/tables/manifest.json
 *
 * Writes src/data/countries.snapshot.json (the API's country list, unchanged apart from dropping fields the
 * extension does not use) and src/data/region-names.json (region code -> name, from the calcbloc-data
 * manifest plus the few regions the manifest does not name).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const from = arg("--from");
const manifestPath = arg("--manifest") ?? resolve(root, "..", "calcbloc-data", "tables", "manifest.json");

let api;
if (from) {
  api = JSON.parse(readFileSync(from, "utf8"));
} else {
  const res = await fetch("https://calcbloc.com/api/v1/countries", { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`GET /api/v1/countries: HTTP ${res.status}`);
  api = await res.json();
}
if (!Array.isArray(api.countries) || api.countries.length === 0) throw new Error("No countries in the API response");

const countries = api.countries.map((c) => {
  const ns = c.endpoints?.["net-salary"];
  const tt = c.endpoints?.["tax-tables"];
  return {
    code: c.code,
    name: c.name,
    currency: c.currency,
    current_year: c.current_year,
    tables_only: Boolean(c.tables_only),
    endpoints: {
      ...(ns ? { "net-salary": { path: ns.path, calculatorUrl: ns.calculatorUrl, parameters: ns.parameters } } : {}),
      ...(tt ? { "tax-tables": { pageUrl: tt.pageUrl } } : {}),
    },
  };
});

// Region names: the calcbloc-data manifest names the regions it publishes tables for.
const names = {};
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const c of manifest.countries ?? []) {
    for (const r of c.regions ?? []) (names[c.country] ??= {})[r.code] = r.name;
  }
} else {
  console.warn(`calcbloc-data manifest not found at ${manifestPath}; using the supplementary names only`);
}

// Regions the calculators use that have no table of their own in the manifest (names as on calcbloc.com).
const SUPPLEMENT = {
  uk: { england: "England and Northern Ireland", scotland: "Scotland", wales: "Wales" },
  germany: {
    bw: "Baden-Württemberg", by: "Bavaria (Bayern)", be: "Berlin", bb: "Brandenburg", hb: "Bremen", hh: "Hamburg",
    he: "Hesse (Hessen)", mv: "Mecklenburg-Western Pomerania", ni: "Lower Saxony (Niedersachsen)",
    nw: "North Rhine-Westphalia (NRW)", rp: "Rhineland-Palatinate", sl: "Saarland", sn: "Saxony (Sachsen)",
    st: "Saxony-Anhalt", sh: "Schleswig-Holstein", th: "Thuringia (Thüringen)",
  },
  india: {
    mh: "Maharashtra", ka: "Karnataka", wb: "West Bengal", tn: "Tamil Nadu", tg: "Telangana", ap: "Andhra Pradesh",
    gj: "Gujarat", mp: "Madhya Pradesh", as: "Assam", kl: "Kerala", br: "Bihar", pb: "Punjab", od: "Odisha",
    hr: "Haryana", ga: "Goa", dl: "Delhi", ch: "Chandigarh", none: "Other state without professional tax",
  },
  spain: { bi: "Bizkaia", gi: "Gipuzkoa", al: "Álava" },
};
for (const [country, map] of Object.entries(SUPPLEMENT)) {
  names[country] = { ...map, ...(names[country] ?? {}) };
  if (country === "uk") names[country].england = SUPPLEMENT.uk.england;
}

mkdirSync(resolve(root, "src/data"), { recursive: true });
writeFileSync(
  resolve(root, "src/data/countries.snapshot.json"),
  JSON.stringify({ source: "https://calcbloc.com/api/v1/countries", savedAt: new Date().toISOString().slice(0, 10), countries }, null, 1) + "\n",
);
writeFileSync(resolve(root, "src/data/region-names.json"), JSON.stringify(names, null, 1) + "\n");
const calc = countries.filter((c) => c.endpoints["net-salary"]).map((c) => c.code);
console.log(`${countries.length} countries (${calc.length} with take-home estimates: ${calc.join(", ")})`);

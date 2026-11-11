// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADAPTERS } from "../src/content/adapters";
import { planFor } from "../src/content/plan";
import { findCandidates } from "../src/content/scan";
import { BUNDLED_COUNTRIES } from "../src/shared/countries";
import { DEFAULT_SETTINGS, type Settings } from "../src/shared/settings";
import { currencyHintsForHost, siteForHost, SITES } from "../src/shared/sites";

const fixture = (name: string) => readFileSync(resolve(__dirname, "../e2e/fixtures", name), "utf8");

function load(name: string): Document {
  return new DOMParser().parseFromString(fixture(name), "text/html");
}

interface Case {
  file: string;
  host: string;
  path: string;
  settings: Partial<Settings>;
  /** Salary texts that must get an estimate badge, in page order. */
  expected: string[];
}

const CASES: Case[] = [
  {
    file: "linkedin.html",
    host: "www.linkedin.com",
    path: "/jobs/search/",
    settings: { country: "us", region: "ca" },
    expected: ["$120K/yr - $150K/yr", "$45/hr - $55/hr", "$95,000/yr", "$120K/yr - $150K/yr · Full-time · Mid-Senior level"],
  },
  {
    file: "indeed.html",
    host: "uk.indeed.com",
    path: "/jobs",
    settings: { country: "uk", region: "england" },
    expected: ["£35,000 - £42,000 a year", "£13.50 an hour", "£28,000 a year", "£35,000 - £42,000 a year"],
  },
  {
    file: "glassdoor.html",
    host: "www.glassdoor.ca",
    path: "/Job/toronto-jobs.htm",
    settings: { country: "canada", region: "on" },
    expected: [
      "$80K - $100K (Employer provided)",
      "CA$40.00 - CA$45.00 Per Hour (Employer provided)",
      "$55K - $65K (Glassdoor est.)",
      "Base pay range: $80K - $100K (Employer provided)",
    ],
  },
  {
    file: "reed.html",
    host: "www.reed.co.uk",
    path: "/jobs/manchester",
    settings: { country: "uk", region: "england" },
    expected: ["£40,000 - £50,000 per annum", "£25 - £30 per hour", "£40,000 - £50,000 per annum, inc benefits"],
  },
  {
    file: "totaljobs.html",
    host: "www.totaljobs.com",
    path: "/jobs/in-birmingham",
    settings: { country: "uk", region: "england" },
    expected: ["£30,000 - £35,000 per annum", "From £28,000 to £32,000 per annum", "£25,000 basic, £45,000 OTE", "£30,000 - £35,000 per annum"],
  },
  {
    file: "seek.html",
    host: "www.seek.com.au",
    path: "/jobs-in-sydney",
    settings: { country: "australia" },
    expected: ["$110,000 – $130,000 + super", "$32 – $36 per hour", "$75k - $85k p.a. + Super", "$110,000 – $130,000 + super"],
  },
  {
    file: "stepstone.html",
    host: "www.stepstone.de",
    path: "/jobs/in-berlin",
    settings: { country: "germany", region: "be" },
    expected: ["55.000 – 65.000 €", "4.500 € brutto/Monat", "55.000 – 65.000 € / Jahr"],
  },
];

describe("site adapters on fixture pages", () => {
  it("every supported site has an adapter and a fixture case", () => {
    for (const s of SITES) {
      expect(ADAPTERS[s.id], s.id).toBeDefined();
      expect(CASES.some((c) => siteForHost(c.host)?.id === s.id), s.id).toBe(true);
    }
  });

  for (const c of CASES) {
    it(`${c.file}: finds the salaries and plans an estimate for each`, () => {
      const site = siteForHost(c.host);
      expect(site, c.host).toBeDefined();
      const adapter = ADAPTERS[site!.id];
      expect(adapter.isJobPage(new URL(`https://${c.host}${c.path}`))).toBe(true);
      const doc = load(c.file);
      const settings = { ...DEFAULT_SETTINGS, ...c.settings };
      const ctx = { settings, countries: BUNDLED_COUNTRIES, hints: currencyHintsForHost(c.host) };
      const planned = findCandidates(doc, adapter)
        .map((cand) => ({ cand, plan: planFor(cand.text, ctx) }))
        .filter((x) => x.plan?.kind === "estimate");
      expect(planned.map((x) => x.cand.text)).toEqual(c.expected);
      for (const { plan } of planned) {
        if (plan?.kind !== "estimate") continue;
        expect(plan.country.code).toBe(c.settings.country);
        expect(plan.calculatorUrl.startsWith("https://calcbloc.com/")).toBe(true);
        for (const r of plan.requests) expect(r.salary).toBeGreaterThan(1000);
      }
    });
  }

  it("LinkedIn pages outside /jobs are ignored", () => {
    expect(ADAPTERS.linkedin.isJobPage(new URL("https://www.linkedin.com/feed/"))).toBe(false);
  });

  it("hosts that are not supported have no adapter", () => {
    for (const h of ["example.com", "www.linkedin.com.evil.test", "indeed.com.evil.test", "jobs.example.org", "www.monster.com"]) expect(siteForHost(h), h).toBeUndefined();
  });

  it("a salary in another currency than the user's country gets no badge", () => {
    const doc = load("indeed.html");
    const settings = { ...DEFAULT_SETTINGS, country: "us", region: "ny" };
    const ctx = { settings, countries: BUNDLED_COUNTRIES, hints: currencyHintsForHost("uk.indeed.com") };
    const plans = findCandidates(doc, ADAPTERS.indeed).map((cand) => planFor(cand.text, ctx));
    expect(plans.every((p) => p === null)).toBe(true);
  });

  it("a $ salary on SEEK is not read as US dollars", () => {
    const doc = load("seek.html");
    const settings = { ...DEFAULT_SETTINGS, country: "us", region: "ny" };
    const ctx = { settings, countries: BUNDLED_COUNTRIES, hints: currencyHintsForHost("www.seek.com.au") };
    const plans = findCandidates(doc, ADAPTERS.seek).map((cand) => planFor(cand.text, ctx));
    expect(plans.every((p) => p === null)).toBe(true);
  });
});

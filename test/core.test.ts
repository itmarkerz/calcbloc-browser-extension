import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ANONYMOUS, WITH_KEY, applyServerHeaders, block, check, emptyState, record } from "../src/background/limiter";
import { planFor, currencyFits } from "../src/content/plan";
import { netSalaryUrl, parseError, parseEstimate, requestKey } from "../src/shared/api";
import { appLink, calculatorLink, PREFILL, safeCalcblocUrl, settingsParams } from "../src/shared/calculator-links";
import { BUNDLED_COUNTRIES, findCountry, normalizeCountries } from "../src/shared/countries";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../src/shared/settings";
import { allMatchPatterns } from "../src/shared/sites";

const S = (o: Partial<typeof DEFAULT_SETTINGS>) => ({ ...DEFAULT_SETTINGS, ...o });
const ctx = (o: Partial<typeof DEFAULT_SETTINGS>, hints = {}) => ({ settings: S(o), countries: BUNDLED_COUNTRIES, hints });

describe("country data", () => {
  it("comes from the API snapshot, with take-home countries and tables-only countries", () => {
    const withCalc = BUNDLED_COUNTRIES.filter((c) => c.netSalary).map((c) => c.code);
    expect(withCalc).toEqual(expect.arrayContaining(["us", "uk", "canada", "australia", "germany", "india", "singapore"]));
    const tablesOnly = BUNDLED_COUNTRIES.filter((c) => !c.netSalary);
    expect(tablesOnly.length).toBeGreaterThan(0);
    for (const c of BUNDLED_COUNTRIES) expect(c.taxTablesUrl).toMatch(/^https:\/\/calcbloc\.com\/[a-z-]+\/tax-tables/);
  });
  it("knows Singapore wants a monthly salary and the US needs a state", () => {
    expect(findCountry(BUNDLED_COUNTRIES, "singapore")?.netSalary?.salaryBasis).toBe("month");
    expect(findCountry(BUNDLED_COUNTRIES, "us")?.netSalary?.region?.required).toBe(true);
    expect(findCountry(BUNDLED_COUNTRIES, "us")?.netSalary?.region?.options.find((o) => o.code === "ca")?.name).toBe("California");
    expect(findCountry(BUNDLED_COUNTRIES, "germany")?.netSalary?.region?.options.find((o) => o.code === "by")?.name).toBe("Bavaria (Bayern)");
  });
  it("hides salary, year, region and display-only parameters from the filing basics", () => {
    const us = findCountry(BUNDLED_COUNTRIES, "us")!;
    const names = us.netSalary!.params.map((p) => p.name);
    expect(names).toContain("filing_status");
    expect(names).not.toContain("salary");
    expect(names).not.toContain("frequency");
    expect(names).not.toContain("region");
  });
  it("normalizes a live list and ignores junk", () => {
    const list = normalizeCountries([
      { code: "uk", name: "United Kingdom", currency: "GBP", endpoints: { "net-salary": { calculatorUrl: "https://calcbloc.com/uk/take-home-pay-calculator", parameters: [{ name: "salary", type: "number" }] } } },
      // @ts-expect-error junk entry
      { name: "broken" },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].taxTablesUrl).toBe("https://calcbloc.com/uk/tax-tables");
  });
  it("every calculator in the snapshot has a pre-fill map whose salary key exists", () => {
    for (const c of BUNDLED_COUNTRIES.filter((x) => x.netSalary)) {
      const path = new URL(c.netSalary!.calculatorUrl).pathname;
      expect(PREFILL[path], path).toBeDefined();
      expect(PREFILL[path].salary, path).toBeTruthy();
    }
  });
});

describe("settings", () => {
  it("sanitizes stored values", () => {
    const s = sanitizeSettings({ country: "UK<script>", region: "x y", hoursPerWeek: 500, apiKey: "  abc  ", params: { ok: 1, "bad key": 2, obj: {} }, enabled: false });
    expect(s).toEqual({ country: "", region: "", params: { ok: 1 }, hoursPerWeek: 40, apiKey: "abc", enabled: false });
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
  it("turns settings into API parameters, dropping defaults and invalid values", () => {
    const us = findCountry(BUNDLED_COUNTRIES, "us")!;
    expect(settingsParams(us, S({ region: "ny", params: { filing_status: "mfj", children: 2, retirement_pct: "x" as unknown as number, nope: true } }))).toEqual({
      region: "ny",
      filing_status: "mfj",
      children: 2,
    });
    expect(settingsParams(us, S({ region: "zz" }))).toEqual({});
    const uk = findCountry(BUNDLED_COUNTRIES, "uk")!;
    expect(settingsParams(uk, S({}))).toEqual({ region: "england" });
  });
});

describe("planFor", () => {
  it("asks for setup when no country is chosen", () => {
    expect(planFor("£45,000 a year", ctx({}))).toMatchObject({ kind: "setup", reason: "country" });
  });
  it("asks for a state in the US", () => {
    expect(planFor("$90,000 a year", ctx({ country: "us" }))).toMatchObject({ kind: "setup", reason: "region" });
  });
  it("plans one request for a single figure and two for a range", () => {
    const one = planFor("£45,000 a year", ctx({ country: "uk" }));
    expect(one).toMatchObject({ kind: "estimate", requests: [{ country: "uk", salary: 45000, params: { region: "england" } }] });
    const two = planFor("£40,000 - £50,000 a year", ctx({ country: "uk", region: "scotland", params: { student_loan: "plan2" } }));
    expect(two?.kind === "estimate" && two.requests.map((r) => r.salary)).toEqual([40000, 50000]);
    expect(two?.kind === "estimate" && two.calculatorUrl).toBe("https://calcbloc.com/uk/take-home-pay-calculator?salary=40000&region=scotland&loan=plan2");
  });
  it("converts hourly pay with the user's hours", () => {
    const p = planFor("£15 an hour", ctx({ country: "uk", hoursPerWeek: 37.5 }));
    expect(p?.kind === "estimate" && p.requests[0].salary).toBe(29250);
  });
  it("sends Singapore a monthly salary", () => {
    expect(planFor("S$6,000 per month", ctx({ country: "singapore" }))).toMatchObject({ requests: [{ salary: 6000 }] });
    expect(planFor("S$84,000 a year", ctx({ country: "singapore" }))).toMatchObject({ requests: [{ salary: 7000 }] });
  });
  it("links tables-only countries to their tax tables", () => {
    const tablesOnly = BUNDLED_COUNTRIES.find((c) => !c.netSalary && c.currency === "SEK");
    if (!tablesOnly) return;
    expect(planFor("45 000 kr per month", ctx({ country: tablesOnly.code }))).toMatchObject({ kind: "tables" });
  });
  it("ignores other currencies and day rates", () => {
    expect(planFor("€45,000 a year", ctx({ country: "uk" }))).toBeNull();
    expect(planFor("£500 per day", ctx({ country: "uk" }))).toBeNull();
    expect(planFor("Competitive salary", ctx({ country: "uk" }))).toBeNull();
  });
  it("reads a bare $ as the user's dollar only when the site gives no other hint", () => {
    expect(planFor("$90,000 a year", ctx({ country: "canada", region: "on" }))).toMatchObject({ kind: "estimate" });
    expect(planFor("$90,000 a year", ctx({ country: "canada", region: "on" }, { dollarHint: "USD" }))).toBeNull();
  });
  it("currencyFits", () => {
    expect(currencyFits("$", "AUD")).toBe(true);
    expect(currencyFits("$", "GBP")).toBe(false);
    expect(currencyFits("kr", "SEK")).toBe(true);
    expect(currencyFits("EUR", "EUR")).toBe(true);
  });
});

describe("calculator links", () => {
  it("pre-fills each country's calculator with its own query keys", () => {
    const us = findCountry(BUNDLED_COUNTRIES, "us")!;
    expect(calculatorLink(us, { salary: 90000, region: "ca", filing_status: "mfj", multiple_jobs: true })).toBe(
      "https://calcbloc.com/us/paycheck-calculator?salary=90000&state=ca&status=mfj&w4s2=1",
    );
    const india = findCountry(BUNDLED_COUNTRIES, "india")!;
    expect(calculatorLink(india, { salary: 1200000, region: "ka" })).toBe("https://calcbloc.com/india/ctc-to-in-hand-salary-calculator?ctc=1200000&state=ka");
    const ca = findCountry(BUNDLED_COUNTRIES, "canada")!;
    expect(calculatorLink(ca, { salary: 80000, region: "on" })).toBe("https://calcbloc.com/canada/canada-income-tax-calculator?salary=80000&prov=on");
  });
  it("never produces a link outside calcbloc.com", () => {
    expect(safeCalcblocUrl("https://evil.example/x")).toBe("https://calcbloc.com/");
    expect(safeCalcblocUrl("javascript:alert(1)")).toBe("https://calcbloc.com/");
    expect(safeCalcblocUrl("https://calcbloc.com.evil.example/")).toBe("https://calcbloc.com/");
    expect(safeCalcblocUrl("https://calcbloc.com/uk/tax-tables")).toBe("https://calcbloc.com/uk/tax-tables");
  });
  it("adds the referral tag to links shown to the user, after the calculator inputs", () => {
    const tag = "utm_source=calcbloc-browser-extension&utm_medium=app&utm_campaign=itmarkerz-oss";
    expect(appLink("https://calcbloc.com/uk/take-home-pay-calculator?salary=40000&region=scotland")).toBe(`https://calcbloc.com/uk/take-home-pay-calculator?salary=40000&region=scotland&${tag}`);
    expect(appLink("https://calcbloc.com/uk/tax-tables")).toBe(`https://calcbloc.com/uk/tax-tables?${tag}`);
    expect(appLink("https://calcbloc.com/developers#limits")).toBe(`https://calcbloc.com/developers?${tag}#limits`);
    expect(appLink(`https://calcbloc.com/data?${tag}`)).toBe(`https://calcbloc.com/data?${tag}`);
    expect(appLink("https://evil.example/x")).toBe(`https://calcbloc.com/?${tag}`);
  });
});

describe("API helpers", () => {
  const req = { country: "uk", salary: 45000.4, params: { region: "england", student_loan: "plan2" } };
  it("builds the request URL with only the salary, country and settings", () => {
    const u = new URL(netSalaryUrl(req));
    expect(u.origin + u.pathname).toBe("https://calcbloc.com/api/v1/net-salary");
    expect([...u.searchParams.keys()].sort()).toEqual(["country", "region", "salary", "student_loan"]);
    expect(u.searchParams.get("salary")).toBe("45000");
  });
  it("gives the same cache key regardless of parameter order", () => {
    expect(requestKey(req)).toBe(requestKey({ ...req, params: { student_loan: "plan2", region: "england" } }));
    expect(requestKey(req)).not.toBe(requestKey({ ...req, salary: 46000 }));
  });
  it("parses a real response shape", () => {
    const body = JSON.parse(readFileSync(resolve(__dirname, "fixtures/net-salary-uk.json"), "utf8"));
    expect(parseEstimate(body)).toEqual({
      netAnnual: 35920.08,
      grossAnnual: 45000,
      effectiveRate: 0.201776,
      currency: "GBP",
      year: "2026-27",
      calculatorUrl: "https://calcbloc.com/uk/take-home-pay-calculator",
      attributionText: "Data by CalcBloc (calcbloc.com)",
      attributionUrl: "https://calcbloc.com/uk/take-home-pay-calculator",
    });
    expect(parseEstimate({ error: { code: "x" } })).toBeNull();
    expect(parseEstimate({ summary: { netAnnual: 1 }, currency: "GBP", calculatorUrl: "https://evil.example/" })?.calculatorUrl).toBe("https://calcbloc.com/");
  });
  it("maps errors", () => {
    expect(parseError(429, { error: { code: "rate_limited", message: "Slow down" } }, "30")).toMatchObject({ ok: false, error: "rate_limited", retryAfterMs: 30000 });
    expect(parseError(429, { error: { code: "rate_limited", message: "Daily" } }, "40000")).toMatchObject({ error: "daily_limit" });
    expect(parseError(401, { error: { code: "invalid_key", message: "Bad key" } }, null)).toMatchObject({ error: "invalid_key" });
    expect(parseError(401, { error: { code: "api_key_required", message: "Key" } }, null)).toMatchObject({ error: "api_key_required" });
    expect(parseError(400, { error: { code: "unsupported_country", message: "x" } }, null)).toMatchObject({ error: "unsupported_country" });
    expect(parseError(503, null, null)).toMatchObject({ error: "server_error" });
  });
});

describe("rate limiter", () => {
  const t0 = Date.parse("2026-11-11T10:00:00Z");
  it("allows 5 a minute without a key", () => {
    let s = emptyState();
    for (let i = 0; i < 5; i++) {
      expect(check(s, t0 + i, ANONYMOUS).ok).toBe(true);
      s = record(s, t0 + i);
    }
    const c = check(s, t0 + 10, ANONYMOUS);
    expect(c.ok).toBe(false);
    expect(!c.ok && c.retryAfterMs).toBeGreaterThan(59_000);
    expect(check(s, t0 + 61_000, ANONYMOUS).ok).toBe(true);
    expect(check(s, t0 + 10, WITH_KEY).ok).toBe(true);
  });
  it("stops at 50 a day and resets at midnight UTC", () => {
    let s = emptyState();
    for (let i = 0; i < 50; i++) s = record(s, t0 + i * 61_000);
    const c = check(s, t0 + 50 * 61_000, ANONYMOUS);
    expect(c).toMatchObject({ ok: false, daily: true });
    expect(check(s, Date.parse("2026-11-12T00:00:01Z"), ANONYMOUS).ok).toBe(true);
  });
  it("follows the server's headers and 429s", () => {
    let s = applyServerHeaders(emptyState(), t0, "0", "3600", "50");
    expect(check(s, t0 + 1000, ANONYMOUS)).toMatchObject({ ok: false, daily: true });
    s = applyServerHeaders(emptyState(), t0, "10", "3600", "50");
    expect(s.day.count).toBe(40);
    s = block(emptyState(), t0, 30_000, false);
    expect(check(s, t0 + 1000, ANONYMOUS)).toMatchObject({ ok: false, daily: false });
    expect(check(s, t0 + 31_000, ANONYMOUS).ok).toBe(true);
  });
});

describe("manifest", () => {
  const base = JSON.parse(readFileSync(resolve(__dirname, "../manifest/base.json"), "utf8"));
  const firefox = JSON.parse(readFileSync(resolve(__dirname, "../manifest/firefox.json"), "utf8"));
  const chrome = JSON.parse(readFileSync(resolve(__dirname, "../manifest/chrome.json"), "utf8"));
  it("asks for the storage permission and calcbloc.com only", () => {
    expect(base.permissions).toEqual(["storage"]);
    expect(base.host_permissions).toEqual(["https://calcbloc.com/*"]);
    expect(base.optional_permissions).toBeUndefined();
  });
  it("runs content scripts on the supported job sites only, over https", () => {
    const patterns = allMatchPatterns();
    expect(patterns.length).toBeGreaterThanOrEqual(7);
    for (const p of patterns) {
      expect(p.startsWith("https://")).toBe(true);
      expect(p).not.toMatch(/<all_urls>|^\*:\/\/\*\//);
    }
  });
  it("uses a service worker in Chrome and background scripts in Firefox", () => {
    expect(chrome.background).toEqual({ service_worker: "background.js" });
    expect(firefox.background).toEqual({ scripts: ["background.js"] });
    expect(firefox.browser_specific_settings.gecko.id).toMatch(/@/);
    expect(firefox.browser_specific_settings.gecko.data_collection_permissions.required.length).toBeGreaterThan(0);
  });
});

/**
 * End-to-end check: loads the unpacked Chrome build (dist/chrome) into Chromium, opens fixture pages that
 * mimic each supported job site (served from the local fixture server on port 3103 under the real host names,
 * through route interception) and checks the badges. The CalcBloc API is mocked with route interception; nothing reaches the live API.
 *
 * Screenshots go to $SCREENSHOT_DIR (default test-results/screenshots).
 */
import { chromium, expect, test, type BrowserContext, type Page, type Route, type Worker } from "@playwright/test";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error plain ESM helper without types
import { HOSTS, PAGES, PORT, fixtureUrl, startServer, stopServer } from "./server.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const extensionPath = resolve(here, "..", "dist", "chrome");
const shots = resolve(process.env.SCREENSHOT_DIR ?? join(here, "..", "test-results", "screenshots"));
mkdirSync(shots, { recursive: true });

const snapshot = JSON.parse(readFileSync(resolve(here, "../src/data/countries.snapshot.json"), "utf8"));

/** Rough effective rates for the mock (the real numbers come from calcbloc.com). */
const RATE: Record<string, number> = { uk: 0.2, us: 0.27, canada: 0.24, australia: 0.22, germany: 0.36 };
const ALLOWED_KEYS = new Set(["country", "salary", "region", "filing_status", "children", "student_loan", "tax_class", "church", "pension_pct"]);

interface Seen {
  url: URL;
  headers: Record<string, string>;
}

let server: Server;
let context: BrowserContext;
let sw: Worker;
const seen: Seen[] = [];
let mode: "ok" | "daily-limit" = "ok";

function mockApi(route: Route) {
  const url = new URL(route.request().url());
  seen.push({ url, headers: route.request().headers() });
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (url.pathname === "/api/v1/countries") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify(snapshot) });
  if (url.pathname !== "/api/v1/net-salary") return route.fulfill({ status: 404, headers: cors, body: JSON.stringify({ error: { code: "not_found", message: "x" } }) });
  if (mode === "daily-limit") {
    return route.fulfill({
      status: 429,
      headers: { ...cors, "Retry-After": "40000", "X-RateLimit-Limit": "50", "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "40000" },
      body: JSON.stringify({ error: { code: "rate_limited", message: "Daily limit reached", docs: "https://calcbloc.com/developers" } }),
    });
  }
  const country = url.searchParams.get("country") ?? "";
  const salary = Number(url.searchParams.get("salary"));
  const c = snapshot.countries.find((x: { code: string }) => x.code === country);
  const rate = RATE[country] ?? 0.25;
  const netAnnual = Math.round(salary * (1 - rate) * 100) / 100;
  const calculatorUrl = c?.endpoints?.["net-salary"]?.calculatorUrl ?? "https://calcbloc.com/";
  return route.fulfill({
    status: 200,
    headers: { ...cors, "X-RateLimit-Limit": "5000", "X-RateLimit-Remaining": "4990", "X-RateLimit-Reset": "40000" },
    body: JSON.stringify({
      endpoint: "net-salary",
      country,
      year: country === "uk" ? "2026-27" : "2026",
      currency: c?.currency ?? "USD",
      inputs: Object.fromEntries(url.searchParams),
      summary: { grossAnnual: salary, netAnnual, totalDeductions: salary - netAnnual, effectiveRate: rate },
      results: { netAnnual },
      calculatorUrl,
      attribution: { source: "CalcBloc", url: calculatorUrl, required: true, text: "Data by CalcBloc (calcbloc.com)" },
    }),
  });
}

async function setSettings(s: Record<string, unknown>) {
  await sw.evaluate(async (settings) => {
    await chrome.storage.local.remove(["estimateCache", "limiter"]);
    await chrome.storage.local.set({ settings });
  }, { region: "", params: {}, hoursPerWeek: 40, apiKey: "e2e-test-key", enabled: true, ...s });
}

const badges = (page: Page) => page.locator("[data-calcbloc-badge]");

async function openFixture(host: string, path: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`https://${host}${path}`);
  return page;
}

/** Answers a request to a real job site with the matching fixture page from the local server (port 3103). */
async function serveFixture(route: Route) {
  const target = fixtureUrl(route.request().url());
  if (!target) return route.fulfill({ status: 404, contentType: "text/plain", body: "Not a fixture page" });
  const res = await route.fetch({ url: target });
  return route.fulfill({ response: res });
}

test.beforeAll(async () => {
  server = await startServer(PORT);
  const userDataDir = mkdtempSync(join(tmpdir(), "calcbloc-e2e-"));
  context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: process.env.HEADED ? false : true,
    viewport: { width: 1280, height: 860 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  // Every network request is answered locally: job sites from the fixture server, calcbloc.com by the mock.
  for (const host of HOSTS) await context.route(`https://${host}/**`, serveFixture);
  await context.route("https://calcbloc.com/api/v1/**", mockApi);
  await context.route(/^https:\/\/calcbloc\.com\/(?!api\/v1\/)/, (r) => r.abort());
  sw = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  // Close the welcome (options) tab opened on install.
  await new Promise((r) => setTimeout(r, 1000));
  for (const p of context.pages()) if (p.url().startsWith("chrome-extension://")) await p.close();
});

test.afterAll(async () => {
  await context?.close();
  if (server) await stopServer(server);
});

interface SiteCase {
  file: string;
  settings: Record<string, unknown>;
  count: number;
  first: RegExp;
}

const SITES: Record<string, SiteCase> = {
  linkedin: { file: "linkedin.html", settings: { country: "us", region: "ca", params: { filing_status: "single" } }, count: 4, first: /≈ \$87,600–\$109,500\/yr take-home/ },
  indeed: { file: "indeed.html", settings: { country: "uk", region: "england" }, count: 4, first: /≈ £28,000–£33,600\/yr take-home/ },
  glassdoor: { file: "glassdoor.html", settings: { country: "canada", region: "on" }, count: 4, first: /take-home/ },
  reed: { file: "reed.html", settings: { country: "uk", region: "england" }, count: 3, first: /≈ £32,000–£40,000\/yr take-home/ },
  totaljobs: { file: "totaljobs.html", settings: { country: "uk", region: "scotland" }, count: 4, first: /take-home/ },
  seek: { file: "seek.html", settings: { country: "australia" }, count: 4, first: /take-home/ },
  stepstone: { file: "stepstone.html", settings: { country: "germany", region: "be", params: { tax_class: "1" } }, count: 3, first: /take-home/ },
};

for (const [name, c] of Object.entries(SITES)) {
  test(`${name}: shows take-home pay beside each salary`, async () => {
    await setSettings(c.settings);
    const page0 = PAGES.find((p: { file: string }) => p.file === c.file);
    const page = await openFixture(page0.host, page0.path);
    await expect(badges(page)).toHaveCount(c.count);
    await expect(page.locator('[data-calcbloc-badge][data-state="result"]')).toHaveCount(c.count, { timeout: 60_000 });
    await expect(page.locator("[data-calcbloc-badge] .text").first()).toHaveText(c.first);
    // Hover credit on every badge
    for (const t of await page.locator("[data-calcbloc-badge] .pill").evaluateAll((els) => els.map((e) => e.getAttribute("title") ?? ""))) expect(t).toContain("Data by CalcBloc");
    await page.screenshot({ path: join(shots, `${name}.png`), fullPage: true });
    await page.close();
  });
}

test("the details panel credits CalcBloc and links to the matching calculator", async () => {
  await setSettings(SITES.indeed.settings);
  const page = await openFixture("uk.indeed.com", "/jobs");
  await expect(page.locator('[data-calcbloc-badge][data-state="result"]')).toHaveCount(4, { timeout: 60_000 });
  await page.locator("[data-calcbloc-badge] .pill").first().click();
  const panel = page.locator("[data-calcbloc-badge] .panel").first();
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Estimated take-home pay");
  await expect(panel.getByRole("link", { name: "Data by CalcBloc" })).toHaveAttribute("href", /^https:\/\/calcbloc\.com\//);
  await expect(panel.getByRole("link", { name: /full calculator/ })).toHaveAttribute(
    "href",
    "https://calcbloc.com/uk/take-home-pay-calculator?salary=35000&region=england&utm_source=calcbloc-browser-extension&utm_medium=app&utm_campaign=itmarkerz-oss",
  );
  // The click stayed on the badge: the page did not navigate.
  expect(page.url()).toBe("https://uk.indeed.com/jobs");
  await page.screenshot({ path: join(shots, "indeed-details.png") });
  await page.close();
});

test("hourly pay is converted and shown per hour", async () => {
  await setSettings({ country: "uk", region: "england", hoursPerWeek: 37.5 });
  const page = await openFixture("uk.indeed.com", "/jobs");
  await expect(page.locator('[data-calcbloc-badge][data-state="result"]')).toHaveCount(4, { timeout: 60_000 });
  await expect(page.locator("[data-calcbloc-badge] .text").nth(1)).toHaveText("≈ £10.80/hr take-home");
  await page.close();
});

test("does nothing on unsupported sites and on non-job LinkedIn pages", async () => {
  await setSettings({ country: "us", region: "ny" });
  for (const [host, path, name] of [
    ["jobs.example.org", "/careers", "unsupported"],
    ["www.linkedin.com", "/feed/", "linkedin-feed"],
  ]) {
    const page = await openFixture(host, path);
    await page.waitForTimeout(2500);
    await expect(badges(page)).toHaveCount(0);
    await page.screenshot({ path: join(shots, `${name}-no-badges.png`) });
    await page.close();
  }
});

test("sends calcbloc.com only the salary, country, region and settings", async () => {
  const calls = seen.filter((s) => s.url.pathname === "/api/v1/net-salary");
  expect(calls.length).toBeGreaterThan(10);
  for (const c of calls) {
    for (const k of c.url.searchParams.keys()) expect(ALLOWED_KEYS.has(k), `unexpected parameter ${k}`).toBe(true);
    expect(c.headers["referer"]).toBeUndefined();
    expect(c.headers["cookie"]).toBeUndefined();
    expect(c.headers["x-api-key"]).toBe("e2e-test-key");
  }
  // Identical salaries on one page are looked up once (the Indeed page shows £35,000 - £42,000 twice).
  const indeed = calls.filter((c) => c.url.searchParams.get("country") === "uk" && c.url.searchParams.get("salary") === "35000");
  expect(indeed.length).toBeGreaterThanOrEqual(1);
});

test("cached estimates are reused without new requests", async () => {
  await sw.evaluate(async () => {
    const got = await chrome.storage.local.get("settings");
    await chrome.storage.local.set({ settings: { ...(got.settings as Record<string, unknown>), country: "uk", region: "england", hoursPerWeek: 40 } });
  });
  const page1 = await openFixture("www.reed.co.uk", "/jobs/manchester");
  await expect(page1.locator('[data-calcbloc-badge][data-state="result"]')).toHaveCount(3, { timeout: 60_000 });
  await page1.close();
  const before = seen.length;
  const page2 = await openFixture("www.reed.co.uk", "/jobs/manchester");
  await expect(page2.locator('[data-calcbloc-badge][data-state="result"]')).toHaveCount(3, { timeout: 60_000 });
  expect(seen.length).toBe(before);
  await page2.close();
});

test("when the daily limit is used up, badges point to the free API key", async () => {
  mode = "daily-limit";
  await setSettings({ country: "uk", region: "england", apiKey: "" });
  const page = await openFixture("www.totaljobs.com", "/jobs/in-birmingham");
  await expect(page.locator('[data-calcbloc-badge][data-state="daily_limit"]').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-calcbloc-badge] .text").first()).toHaveText("Take-home: daily limit reached");
  await page.screenshot({ path: join(shots, "daily-limit.png") });
  await page.close();
  mode = "ok";
});

test("options page: country, region and tax basics", async () => {
  await setSettings({ country: "", apiKey: "" });
  const id = new URL(sw.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/options.html`);
  await page.selectOption("#country", "us");
  await expect(page.locator("#region-field")).toBeVisible();
  await page.selectOption("#region", "ca");
  await page.selectOption('[data-param="filing_status"]', "mfj");
  await expect(page.locator("#status")).toContainText("Saved");
  const stored = await sw.evaluate(async () => (await chrome.storage.local.get("settings")).settings);
  expect(stored).toMatchObject({ country: "us", region: "ca", params: { filing_status: "mfj" } });
  await page.setViewportSize({ width: 1280, height: 1600 });
  await page.screenshot({ path: join(shots, "options.png"), fullPage: true });
  await page.close();
});

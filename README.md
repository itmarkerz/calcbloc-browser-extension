# Take-Home Pay for Job Listings: CalcBloc browser extension (Chrome, Firefox, Edge)

A browser extension that shows the **estimated take-home pay next to salaries on job sites**. Set your country and region once; every salary on LinkedIn Jobs, Indeed, Glassdoor, Reed, Totaljobs, SEEK and StepStone then gets a small badge with the pay after income tax and social security, worked out by the [CalcBloc](https://calcbloc.com/?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss) public API. Click a badge for the yearly and monthly figures and a link to the full calculator on calcbloc.com.

CalcBloc is a product of [itmarkerz technologies](https://itmarkerz.co.in/?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss).

No tracking, no analytics, no browsing data collected. See [PRIVACY.md](PRIVACY.md).

> **Status:** version 1.0.0, ready for store review. Not yet published in any store.

## What it does

- Finds salary figures in job listings: single figures and ranges, yearly, monthly, weekly and hourly pay, currency symbols and codes, "k" amounts, lakh/LPA, and European formats such as `55.000 €` or `45 000 €`.
- Skips anything it cannot read with confidence: day rates, bonuses, commission and OTE figures, amounts in a currency other than your country's, and figures with no period that are too small to be a yearly salary.
- Asks the CalcBloc API (`GET /api/v1/net-salary`) for the take-home pay with your settings: region (US state, Canadian province, UK nation, German state, Spanish region, Indian state) and tax basics (US filing status, UK student loan and pension, German tax class, Indian tax regime, and so on).
- Shows the result beside the salary in the same period as the ad (per year, month, week or hour). The details panel shows yearly and monthly take-home, the effective rate, the tax year, a "Data by CalcBloc" credit and a link to the matching calculator on calcbloc.com, pre-filled with that salary and your settings.
- For countries where CalcBloc has tax tables but no take-home calculator yet, the badge links to that country's tax tables (`https://calcbloc.com/<country>/tax-tables/<year>`) instead of showing an estimate.
- Does nothing on any other website, and nothing on LinkedIn pages outside `/jobs/`.

### Countries with take-home estimates

United States (50 states and DC), United Kingdom, Canada, Australia, New Zealand, Ireland, Germany, France, Spain, the Netherlands, India and Singapore. The list comes from [`/api/v1/countries`](https://calcbloc.com/developers?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss): a snapshot ships with the extension and is refreshed from the API at most once a week, so new countries appear without an update.

| Country | Calculator the badge links to |
|---|---|
| United States | [Paycheck calculator](https://calcbloc.com/us/paycheck-calculator?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss) |
| United Kingdom | [Take-home pay calculator](https://calcbloc.com/uk/take-home-pay-calculator?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss) |
| Canada | [Canada income tax calculator](https://calcbloc.com/canada/canada-income-tax-calculator?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss) |
| Australia | [Pay calculator](https://calcbloc.com/australia/pay-calculator?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss) |
| New Zealand | [PAYE calculator](https://calcbloc.com/new-zealand/paye-calculator?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss) |
| Ireland | [Ireland salary calculator](https://calcbloc.com/ireland/ireland-salary-calculator?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss) |
| Germany | [Germany net salary calculator](https://calcbloc.com/germany/germany-net-salary-calculator?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss) |
| France | [France net salary calculator](https://calcbloc.com/france/france-net-salary-calculator?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss) |
| Spain | [Spain net salary calculator](https://calcbloc.com/spain/spain-net-salary-calculator?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss) |
| Netherlands | [Netherlands net salary calculator](https://calcbloc.com/netherlands/netherlands-net-salary-calculator?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss) |
| India | [CTC to in-hand salary calculator](https://calcbloc.com/india/ctc-to-in-hand-salary-calculator?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss) |
| Singapore | [Singapore take-home pay calculator](https://calcbloc.com/singapore/singapore-take-home-pay-calculator?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss) |

### Supported job sites

| Site | Hosts |
|---|---|
| LinkedIn Jobs | www.linkedin.com (acts on /jobs/ only) |
| Indeed | *.indeed.com (all country sites, e.g. uk.indeed.com, ca.indeed.com) |
| Glassdoor | glassdoor.com, .co.uk, .ca, .com.au, .co.in, .co.nz, .ie, .de, .fr, .es, .nl, .sg |
| Reed | www.reed.co.uk |
| Totaljobs | www.totaljobs.com |
| SEEK | www.seek.com.au, www.seek.co.nz |
| StepStone | www.stepstone.de |

## API limits and the optional key

Without a key the CalcBloc API allows 50 requests a day and 5 a minute per IP address. A [free API key](https://calcbloc.com/developers/keys?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss) raises that to 5,000 a day and 60 a minute; paste it in the extension's settings. To stay well inside the limits the extension:

- only looks up salaries that come into view,
- sends one request per distinct salary on a page (two for a range),
- caches each estimate on the device for 7 days,
- paces requests to the per-minute limit and follows the API's `X-RateLimit-*` headers and `429` responses.

When the daily allowance is used up, badges say so and link to the settings page.

## Privacy and permissions

- Permissions: `storage` only, plus host access to `https://calcbloc.com/*` for the API.
- Content scripts are declared for the supported job sites only.
- Requests to calcbloc.com carry the salary figure, country, region and tax basics, and the optional API key. No page address, job title, employer, cookies or referrer.
- No analytics, no remote code. The extension pages have a content security policy that only allows connections to calcbloc.com.

Full policy: [PRIVACY.md](PRIVACY.md).

## Install from source

Requirements: Node.js 22 or later.

```sh
npm ci
npm run build          # dist/chrome, dist/firefox, dist/edge
```

- **Chrome:** `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome`
- **Edge:** `edge://extensions` → Developer mode → Load unpacked → `dist/edge`
- **Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist/firefox/manifest.json`

The settings page opens on install (or click the toolbar icon). Choose your country and, where asked, your region.

## Development

```sh
npm run typecheck      # TypeScript
npm test               # unit tests (parser, adapters on fixture pages, links, API, limiter, manifest)
npm run test:e2e       # builds dist/chrome and runs the Playwright check
npm run package        # zips for the three stores in dist/
npm run sync:countries # refresh the bundled country snapshot from the API (1 request)
npm run icons          # re-render icons/icon-*.png from icons/icon.svg
```

### End-to-end test

`npm run test:e2e` loads the unpacked Chrome build into Chromium with Playwright (`launchPersistentContext` with `--load-extension`). Local HTML pages that mimic each supported site's markup are served over HTTPS on port 3103, and Chromium's `--host-resolver-rules` maps the real host names (www.linkedin.com, uk.indeed.com, www.seek.com.au, ...) to that server, so the production manifest is tested unchanged. The CalcBloc API is mocked with Playwright route interception. Set `SCREENSHOT_DIR` to choose where screenshots go; `HEADED=1` shows the browser. The test needs `openssl` on the PATH (or Git for Windows) to create a throwaway certificate.

To browse the fixture pages by hand: `node e2e/server.mjs`, then start Chromium with the same `--host-resolver-rules` and `--ignore-certificate-errors`.

### Project layout

```
manifest/            base.json + per-browser overlays (chrome.json, firefox.json, edge.json)
scripts/             build.mjs (esbuild, manifest merge, zips), sync-countries.mjs, make-icons.mjs, zip.mjs
src/shared/          parser.ts (salary detection), sites.ts (supported sites), countries.ts, api.ts,
                     calculator-links.ts, settings.ts, browser.ts
src/background/      index.ts (API calls, cache, request pacing), limiter.ts
src/content/         index.ts (page scan and badges), adapters/ (one per site), scan.ts, plan.ts, badge.ts
src/options/         settings page
src/data/            country snapshot from /api/v1/countries and region names
e2e/                 Playwright test, fixture server and fixture pages
test/                Vitest unit tests
store/               Chrome Web Store, Firefox AMO and Edge Add-ons listing notes, publishing checklist
```

### Adding a job site

1. Add the site to `src/shared/sites.ts` (match patterns and host test). The manifests pick it up at build time.
2. Add an adapter in `src/content/adapters/` with the selectors of the elements that hold the salary, and register it in `adapters/index.ts`.
3. Add a fixture page in `e2e/fixtures/`, a case in `test/adapters.test.ts`, and a page in `e2e/server.mjs`.
4. Update the permission justification in `store/chrome-web-store.md`.

### Building for another browser

Each browser is a manifest overlay plus a build target in `scripts/build.mjs`. The code calls `browser.*` when it exists and `chrome.*` otherwise, and only uses APIs that behave the same in Chrome, Edge and Firefox (`storage.local`, `runtime` messaging, `action`).

## Data and licence

Estimates come from the [CalcBloc API](https://calcbloc.com/developers?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss), which runs the same engine and official tax data as the calculators on calcbloc.com. Every figure in the tax tables is taken from the government source named next to it; see [calcbloc.com/data](https://calcbloc.com/data?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss). Estimates are a guide, not tax advice.

- Code: MIT licence, copyright CalcBloc ([LICENSE](LICENSE)).
- Data: CC BY 4.0. Credit: Data by CalcBloc (calcbloc.com/data).

## Links

- Website: [calcbloc.com](https://calcbloc.com/?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss)
- API documentation: [calcbloc.com/developers](https://calcbloc.com/developers?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss)
- Free API key: [calcbloc.com/developers/keys](https://calcbloc.com/developers/keys?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss)
- Tax tables and downloads: [calcbloc.com/data](https://calcbloc.com/data?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss)

## About

This extension is published by [itmarkerz technologies](https://itmarkerz.co.in/?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss), a web and mobile app development company in Kerala, India, which builds and runs [CalcBloc](https://calcbloc.com/?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss): free salary, take-home pay and tax calculators with open tax data ([calcbloc.com/data](https://calcbloc.com/data?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss)) and a public API ([calcbloc.com/developers](https://calcbloc.com/developers?utm_source=calcbloc-browser-extension&utm_medium=readme&utm_campaign=itmarkerz-oss)).

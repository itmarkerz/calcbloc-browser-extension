# Publishing checklist

Nothing has been submitted to any store. Work through this list when the owner decides to publish.

## Before any store

- [ ] Owner decisions settled (see the list at the end of this file).
- [ ] `npm ci && npm run check` passes (typecheck, unit tests, all three builds).
- [ ] `npm run test:e2e` passes.
- [ ] Try the Chrome build by hand on the real sites with a real country set: LinkedIn Jobs, uk.indeed.com, glassdoor.ca, reed.co.uk, totaljobs.com, seek.com.au, stepstone.de. Site markup changes often; update selectors in `src/content/adapters/` if a site shows no badges (the generic pass still catches many salaries).
- [ ] `npm run sync:countries` to refresh the bundled country snapshot (uses 1 API request), then rebuild.
- [ ] Bump `version` in `package.json` (the manifests take it from there).
- [ ] `npm run package` → `dist/calcbloc-take-home-{chrome,firefox,edge}-<version>.zip`.
- [ ] Push the repository so the privacy policy URL works: https://github.com/itmarkerz/calcbloc-browser-extension/blob/main/PRIVACY.md (or host a copy on calcbloc.com and use that URL everywhere).
- [ ] Take the five store screenshots on the real sites (1280×800), as listed in `store/chrome-web-store.md`.

## Chrome Web Store

- [ ] Developer account (one-time USD 5 fee), publisher name "itmarkerz technologies", website https://itmarkerz.co.in (verified).
- [ ] Upload the Chrome zip.
- [ ] Fill the Store listing, Privacy practices and Distribution tabs from `store/chrome-web-store.md`.
- [ ] Submit for review. Broad host access to linkedin.com/indeed.com can lengthen review; the justifications cover it.

## Firefox Add-ons (AMO)

- [ ] Confirm the add-on ID `take-home-pay@calcbloc.com` (permanent after the first upload).
- [ ] Confirm the data collection categories in `manifest/firefox.json`.
- [ ] `npx web-ext lint --source-dir dist/firefox` shows no errors.
- [ ] Upload the Firefox zip; upload a source zip and the build steps from `store/firefox-amo.md` if asked.
- [ ] Paste `PRIVACY.md` as the privacy policy.

## Microsoft Edge Add-ons

- [ ] Partner Center account (free), publisher "itmarkerz technologies".
- [ ] Upload the Edge zip and fill the listing from `store/edge-addons.md`.

## After publishing

- [ ] Add the store links to the README and, if wanted, to calcbloc.com/developers.
- [ ] Revoke the test key used for manual testing, if any.
- [ ] Watch the CalcBloc API logs for 429s from extension traffic; consider a higher anonymous limit for the extension or nudge users to the free key.

## Owner decisions

1. **Store name.** Current: "Take-Home Pay for Job Listings – CalcBloc" (short name "Take-Home Pay").
2. **Tables-only countries.** Badges link to the tax tables instead of computing an estimate locally from the tables (a local estimate would be less accurate than the API engine). Keep, or hide badges for those countries?
3. **Firefox data categories.** `websiteContent` (salary figure) and `locationInfo` (chosen country/region) are declared. Keep both, or drop `locationInfo`? Same question for the Chrome "Location" disclosure.
4. **Firefox add-on ID** `take-home-pay@calcbloc.com`.
5. **Privacy policy URL**: GitHub (needs the repo pushed) or a page on calcbloc.com.
6. **Referral marker on calcbloc.com links.** Decided: links the user can click (calculator, credit, tax tables, settings page) carry the calculator's own inputs (salary, region, tax basics) plus a fixed referral tag, `utm_source=calcbloc-browser-extension&utm_medium=app&utm_campaign=itmarkerz-oss`, so calcbloc.com's analytics can count visits from the extension. The tag names the product only (nothing about the user, the page or the job site) and API requests never carry it; PRIVACY.md and the Chrome data disclosures say so.
7. **API key policy (decided 11 November 2026).** The extension works without a key (50 estimates a day per internet address, from the user's own IP). When that runs out (429 or `X-RateLimit-Remaining: 0`), badges show "Take-home: add your free API key" and the options page shows where to get and paste one; with a key every request carries it (60 a minute, 5,000 a day). This relies on anonymous access staying on for `/net-salary`; if it is switched off, badges show the same prompt.
8. **More job sites** (e.g. Naukri, Monster, Jobindex, ZipRecruiter): each needs a site entry, an adapter and a permission justification.

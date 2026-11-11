# Chrome Web Store listing

Everything needed to fill in the Chrome Web Store Developer Dashboard for this extension. Upload `dist/calcbloc-take-home-chrome-<version>.zip` (made by `npm run package`).

**Publisher / developer:** itmarkerz technologies ([itmarkerz.co.in](https://itmarkerz.co.in)). Set this as the developer (publisher) display name in the Developer Dashboard account settings, with https://itmarkerz.co.in as the website (verify the domain in Google Search Console to show it as verified).

## Store listing tab

**Name** (from the manifest, max 75 characters)

> Take-Home Pay for Job Listings – CalcBloc

**Summary / short description** (from the manifest, max 132 characters)

> See the estimated take-home pay next to salaries on LinkedIn, Indeed, Glassdoor, Reed, Totaljobs, SEEK and StepStone.

**Category:** Tools (alternative: Productivity)

**Language:** English

**Detailed description**

> Job ads show the salary before tax. This extension shows what you would actually take home.
>
> Set your country (and state, province or region) once. When you browse job listings on LinkedIn, Indeed, Glassdoor, Reed, Totaljobs, SEEK or StepStone, every salary gets a small badge with the estimated take-home pay after income tax and social security. Click the badge for the yearly and monthly figures, the effective tax rate and a link to the full calculator on calcbloc.com, already filled in with that salary.
>
> What it handles
> • Ranges ("£40,000 - £50,000 a year", "$120K/yr - $150K/yr") and single figures
> • Yearly, monthly, weekly and hourly pay (hourly is converted at the hours a week you choose)
> • Currency symbols and codes, "k" amounts, lakh and LPA, and European number formats (55.000 €)
> • Your tax basics: US filing status, UK student loan and pension, German tax class, Indian tax regime and more
>
> Countries with take-home estimates: United States (all states and DC), United Kingdom, Canada, Australia, New Zealand, Ireland, Germany, France, Spain, the Netherlands, India and Singapore. For other countries that CalcBloc covers, the badge links to that country's official tax tables instead.
>
> It stays out of the way: figures it cannot read with confidence (day rates, bonuses, commission, "OTE", amounts in another currency) get no badge, and on any other website the extension does nothing at all.
>
> Private by design
> • No tracking, no analytics, no ads
> • It does not collect your browsing history
> • To work out an estimate it sends calcbloc.com only the salary figure, your country, your region and your tax basics. Never the page address, the job title or the employer.
> • Your settings stay on your device
>
> Estimates come from the CalcBloc API, which runs the same engine and official tax data as the calculators on calcbloc.com. Free to use: 50 estimates a day without signing up, or 5,000 a day with a free API key from calcbloc.com/developers/keys. Estimates are cached on your device for a week, so the same salary is only looked up once.
>
> An estimate, not tax advice. Data by CalcBloc (calcbloc.com/data).
>
> CalcBloc is a product of itmarkerz technologies (https://itmarkerz.co.in).

**Icon:** `icons/icon-128.png` (128×128).

**Screenshots** (1280×800 or 640×400, PNG or JPEG, up to 5). Take them on the real sites with the extension installed (the e2e test pages are for testing; the store should show real use). Suggested set:

| # | What to show | Caption |
|---|---|---|
| 1 | LinkedIn Jobs search results with badges on several cards (US, California) | Take-home pay next to every salary on LinkedIn Jobs |
| 2 | A badge clicked open showing the details panel (yearly, monthly, effective rate, calculator link) | Click for yearly and monthly take-home, your tax rate and the full calculator |
| 3 | Indeed UK or Reed results with ranges and an hourly job | Works with ranges and hourly pay |
| 4 | SEEK (Australia) or StepStone (Germany) results | LinkedIn, Indeed, Glassdoor, Reed, Totaljobs, SEEK and StepStone |
| 5 | The settings page with country, region and tax basics | Set your country and tax basics once. Nothing is tracked |

Reference images of the same views (taken from the test pages) are produced by `npm run test:e2e` in `test-results/screenshots/` (or `$SCREENSHOT_DIR`).

**Small promo tile** (440×280, optional): CalcBloc logo, the words "Take-home pay on job listings" and one example badge "≈ £2,993/mo take-home".

**Official URL / homepage:** https://calcbloc.com
**Support URL:** https://github.com/itmarkerz/calcbloc-browser-extension/issues

## Privacy practices tab

**Single purpose description**

> Shows the estimated take-home pay (salary after tax) next to salary figures on supported job listing websites, using the CalcBloc tax calculation API.

**Permission justifications**

| Permission | Justification |
|---|---|
| `storage` | Saves the user's settings (country, region, tax basics, hours per week, optional API key) and a cache of recent estimates on the device, so the same salary is not looked up again. Nothing in storage is sent anywhere. |
| Host permission `https://calcbloc.com/*` | The background worker calls the CalcBloc API (`/api/v1/net-salary` and `/api/v1/countries`) to get the take-home estimate. No other server is contacted. |
| Content scripts on `www.linkedin.com`, `*.indeed.com`, `*.glassdoor.*` (11 country domains), `www.reed.co.uk`, `www.totaljobs.com`, `www.seek.com.au`, `www.seek.co.nz`, `www.stepstone.de` | Needed to find salary figures in job listings on these sites and show the estimate beside them. The script runs on these job sites only. On LinkedIn it is loaded for the whole site because LinkedIn opens the jobs section without a page load, but it only acts on pages under /jobs/. |

**Remote code:** No, I am not using remote code. (All JavaScript is bundled in the package; the API returns JSON data only.)

**Data usage disclosures** (what the extension collects, meaning: sends off the device)

| Category | Collected? | Notes |
|---|---|---|
| Personally identifiable information | No | |
| Health information | No | |
| Financial and payment information | No | The salary figure is taken from a public job ad, not the user's own finances. |
| Authentication information | No | The optional CalcBloc API key is sent only to calcbloc.com as the API's own credential. |
| Personal communications | No | |
| Location | Yes (owner to confirm) | The country and region the user chose in the settings (for example "uk", "scotland") are sent with each request, because tax depends on them. No GPS or detected location. |
| Web history | No | Page addresses are never sent or stored. |
| User activity | No | |
| Website content | Yes | The salary figure shown in a job listing is sent to calcbloc.com to calculate the estimate. |

Certifications to tick:
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://github.com/itmarkerz/calcbloc-browser-extension/blob/main/PRIVACY.md (or a copy hosted on calcbloc.com, if preferred)

## Distribution tab

- Visibility: Public (or Unlisted for a soft launch)
- Regions: All regions
- Pricing: Free, no in-app purchases

## Notes for the reviewer (optional field)

> To test: open the extension's options page (click the toolbar icon), choose United Kingdom, then visit https://uk.indeed.com/jobs?q=accountant&l=London or https://www.reed.co.uk/jobs/accountant-jobs-in-london. Salaries in the results get a "≈ … take-home" badge; click one for details. No account is needed. The extension calls only https://calcbloc.com/api/v1/.

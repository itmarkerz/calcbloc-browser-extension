# Privacy policy: Take-Home Pay for Job Listings (CalcBloc)

Last updated: 11 November 2026

This policy covers the browser extension "Take-Home Pay for Job Listings – CalcBloc" for Chrome, Firefox and Edge. The extension is published by [itmarkerz technologies](https://itmarkerz.co.in/?utm_source=calcbloc-browser-extension&utm_medium=docs&utm_campaign=itmarkerz-oss), the company behind [CalcBloc](https://calcbloc.com/?utm_source=calcbloc-browser-extension&utm_medium=docs&utm_campaign=itmarkerz-oss). It is written to be read in a couple of minutes.

## The short version

- The extension does not track you.
- It does not collect, store or sell your browsing history or any other browsing data.
- It has no analytics, no advertising and no third-party code.
- To work out an estimate, it sends calcbloc.com a salary figure, your country, your region and the tax basics you chose in the settings. Nothing else.

## Where the extension runs

It only runs on the job sites listed in the settings page: LinkedIn Jobs, Indeed, Glassdoor, Reed, Totaljobs, SEEK and StepStone. It does nothing on any other website. On LinkedIn it only acts on pages under `linkedin.com/jobs/`.

On those sites it reads the text of the salary shown in a job listing (for example "£40,000 - £50,000 a year") so it can put an estimate next to it. It does not read or keep anything else from the page.

## What is sent to calcbloc.com, and when

When a salary appears on your screen, the extension asks the CalcBloc API (`https://calcbloc.com/api/v1/net-salary`) for the take-home pay. The request contains only:

- the salary amount (for example 45000),
- your country (for example `uk`),
- your region, if your country has one (for example `scotland` or the US state you chose),
- the tax basics you set in the settings (for example filing status, tax class or student loan plan),
- your CalcBloc API key, if you chose to add one.

The request does **not** contain the address of the page, the job title, the employer, the job description, your search terms, cookies or any identifier for you or your browser. The extension sends no referrer.

About once a week the extension also downloads the public list of supported countries from `https://calcbloc.com/api/v1/countries`. That request contains nothing about you.

Like any website, calcbloc.com receives your IP address with each request. CalcBloc uses it only to apply the free usage limit (50 estimates a day without a key) and to keep the service running. See the [calcbloc.com privacy policy](https://calcbloc.com/privacy?utm_source=calcbloc-browser-extension&utm_medium=docs&utm_campaign=itmarkerz-oss).

## What is stored, and where

Everything the extension stores stays in your browser on your device (the browser's extension storage):

- your settings (country, region, tax basics, hours per week, the optional API key),
- recent estimates, so the same salary is not looked up twice (kept for up to 7 days, at most 400 entries; the stored entry is the salary, the settings and the result, not the page it came from),
- a count of today's requests, so the extension stays within the free limit.

None of this is sent anywhere. Removing the extension deletes it. You can also clear the cached estimates from the settings page at any time.

## What the extension does not do

- No tracking, analytics, telemetry or crash reporting.
- No ads, no affiliate links, no selling or sharing of data.
- No access to pages outside the supported job sites.
- No remote code: all of the extension's code is in the package you install.

Links from the extension to calcbloc.com (the calculator and credit links in the badge, the tax-table links and the links on the settings page) carry a referral tag naming the extension (utm_source=calcbloc-browser-extension, utm_medium=app, utm_campaign=itmarkerz-oss) so CalcBloc can see which product a visit came from; the tag contains no personal or browsing data, and requests to the API never carry it.

## Permissions and why they are needed

- **Storage**: to keep your settings and cached estimates on your device.
- **Access to calcbloc.com**: to ask the CalcBloc API for estimates.
- **Run on the supported job sites**: to find the salary on the page and show the estimate next to it.

## Children

The extension is a general-audience tool for job seekers and is not directed at children.

## Changes

If this policy changes, the new version will be published in this file with a new date. Any change that would send more information than described above would be announced in the extension's release notes before it takes effect.

## Contact

Publisher: [itmarkerz technologies](https://itmarkerz.co.in/?utm_source=calcbloc-browser-extension&utm_medium=docs&utm_campaign=itmarkerz-oss), Kerala, India.

Questions: open an issue at [github.com/itmarkerz/calcbloc-browser-extension](https://github.com/itmarkerz/calcbloc-browser-extension/issues) or use the [contact page on calcbloc.com](https://calcbloc.com/contact?utm_source=calcbloc-browser-extension&utm_medium=docs&utm_campaign=itmarkerz-oss).

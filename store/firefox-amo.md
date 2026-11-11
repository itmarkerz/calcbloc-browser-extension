# Firefox Add-ons (AMO) notes

Build: `npm run build:firefox` (folder `dist/firefox/`) or `npm run package` (zip `dist/calcbloc-take-home-firefox-<version>.zip`).

## How the Firefox build differs

Only the manifest overlay `manifest/firefox.json` changes:

- `background.scripts: ["background.js"]` instead of a service worker (Firefox runs Manifest V3 backgrounds as event pages).
- `browser_specific_settings.gecko.id`: `take-home-pay@calcbloc.com`. **This ID is permanent once the add-on is listed.** Change it before the first upload if a different one is preferred.
- `strict_min_version: "140.0"` (desktop) and `142.0` (Android), the first versions that show the built-in data collection consent.
- `data_collection_permissions.required: ["websiteContent", "locationInfo"]`: the salary figure from the page (website content) and the country and region chosen in the settings (location) are sent to calcbloc.com. Firefox shows these to the user at install. If the owner decides the user-chosen region is not "location" in Mozilla's sense, drop `locationInfo`.

The code is the same: it uses `browser.*` when present (Firefox) and `chrome.*` otherwise.

## Testing locally

1. `npm run build:firefox`
2. Firefox → `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `dist/firefox/manifest.json`.
3. Optional lint: `npx web-ext lint --source-dir dist/firefox`.

In Firefox, the user can withhold host permissions for Manifest V3 add-ons. If badges do not appear, check about:addons → this add-on → Permissions and allow calcbloc.com and the job sites. The settings page works without them; badges need them.

## Listing text

Use the same name, summary and description as `store/chrome-web-store.md`. AMO limits the summary to 250 characters.

- Category: **Other** (none of AMO's specific categories fits a job-search helper).
- Tags: salary, take-home pay, tax, jobs, net salary
- Developer: itmarkerz technologies, https://itmarkerz.co.in (also set in the manifest as `developer`; use it as the AMO developer profile name and homepage)
- Support site: https://github.com/itmarkerz/calcbloc-browser-extension/issues
- Homepage: https://calcbloc.com
- Licence: MIT
- Privacy policy: paste the text of `PRIVACY.md` (AMO hosts the policy text itself).

## Source code submission

The bundle is built with esbuild and is not minified, but AMO may still ask for source because it is bundled. Upload a zip of the repository (without `node_modules`, `dist`) and these build instructions:

```
Node.js 22 or later
npm ci
npm run build:firefox
# output: dist/firefox/
```

## Reviewer notes

> The add-on only runs on the listed job sites and only calls https://calcbloc.com/api/v1/. To test: open the add-on's options, choose United Kingdom, then visit https://uk.indeed.com/jobs?q=accountant&l=London. Salaries get a "≈ … take-home" badge.

# Microsoft Edge Add-ons notes

Build: `npm run build:edge` (folder `dist/edge/`) or `npm run package` (zip `dist/calcbloc-take-home-edge-<version>.zip`).

## How the Edge build differs

Edge uses the same Manifest V3 format as Chrome. `manifest/edge.json` is currently identical to `manifest/chrome.json` (service worker background, `minimum_chrome_version` 116); it exists so Edge-only keys can be added later without touching the Chrome build. Users can also install the Chrome Web Store version in Edge, but a Partner Center listing shows up in Edge's own store search.

## Testing locally

1. `npm run build:edge`
2. Edge → `edge://extensions` → turn on Developer mode → Load unpacked → pick `dist/edge/`.

## Partner Center listing

Submit at https://partner.microsoft.com/dashboard/microsoftedge (a free developer account is needed).

- **Publisher display name:** itmarkerz technologies (website https://itmarkerz.co.in), set in the Partner Center account profile.
- **Name, short description, description:** same text as `store/chrome-web-store.md`.
- **Category:** Productivity
- **Search terms (up to 7):** take-home pay, net salary, salary after tax, job search, paycheck calculator, income tax, CalcBloc
- **Privacy policy URL:** https://github.com/itmarkerz/calcbloc-browser-extension/blob/main/PRIVACY.md
- **Website:** https://calcbloc.com/?utm_source=calcbloc-browser-extension&utm_medium=listing&utm_campaign=itmarkerz-oss
- **Support contact:** https://github.com/itmarkerz/calcbloc-browser-extension/issues
- **Screenshots:** the same five as for the Chrome Web Store (1280×800).
- **Store logo:** 300×300 PNG (make from `icons/icon.svg`); 128×128 icon is in the package.
- **Availability:** Public, all markets, free.
- **Notes for certification:** the same reviewer note as for Chrome (choose United Kingdom, visit uk.indeed.com).

Permissions are justified in the package; Partner Center does not ask for per-permission text, but the certification team reads the description, so keep the "Private by design" section.

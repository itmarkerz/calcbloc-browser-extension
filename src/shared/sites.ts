/**
 * Supported job sites. This list is the single source for the content-script match patterns in every
 * browser's manifest (see scripts/build.mjs) and for picking a site adapter at run time.
 * The extension runs nowhere else.
 */

export interface SiteDef {
  id: string;
  name: string;
  /** Manifest match patterns (https only). */
  matches: string[];
  /** Hostname test used at run time. */
  host: RegExp;
}

export const SITES: SiteDef[] = [
  {
    id: "linkedin",
    name: "LinkedIn Jobs",
    // LinkedIn is a single-page app: users reach /jobs/ without a page load, so the script is loaded on
    // www.linkedin.com and only acts while the address is under /jobs/.
    matches: ["https://www.linkedin.com/*"],
    host: /^www\.linkedin\.com$/,
  },
  {
    id: "indeed",
    name: "Indeed",
    matches: ["https://*.indeed.com/*"],
    host: /(^|\.)indeed\.com$/,
  },
  {
    id: "glassdoor",
    name: "Glassdoor",
    matches: [
      "https://*.glassdoor.com/*",
      "https://*.glassdoor.co.uk/*",
      "https://*.glassdoor.ca/*",
      "https://*.glassdoor.com.au/*",
      "https://*.glassdoor.co.in/*",
      "https://*.glassdoor.ie/*",
      "https://*.glassdoor.de/*",
      "https://*.glassdoor.fr/*",
      "https://*.glassdoor.es/*",
      "https://*.glassdoor.nl/*",
      "https://*.glassdoor.sg/*",
      "https://*.glassdoor.co.nz/*",
    ],
    host: /(^|\.)glassdoor\.(com|co\.uk|ca|com\.au|co\.in|co\.nz|ie|de|fr|es|nl|sg)$/,
  },
  {
    id: "reed",
    name: "Reed",
    matches: ["https://www.reed.co.uk/*"],
    host: /^www\.reed\.co\.uk$/,
  },
  {
    id: "totaljobs",
    name: "Totaljobs",
    matches: ["https://www.totaljobs.com/*"],
    host: /^www\.totaljobs\.com$/,
  },
  {
    id: "seek",
    name: "SEEK",
    matches: ["https://www.seek.com.au/*", "https://www.seek.co.nz/*"],
    host: /^www\.seek\.(com\.au|co\.nz)$/,
  },
  {
    id: "stepstone",
    name: "StepStone",
    matches: ["https://www.stepstone.de/*"],
    host: /^www\.stepstone\.de$/,
  },
];

export function siteForHost(hostname: string): SiteDef | undefined {
  return SITES.find((s) => s.host.test(hostname));
}

export function allMatchPatterns(): string[] {
  return SITES.flatMap((s) => s.matches);
}

/**
 * Currency a bare "$" or "kr" means on this host, and the currency of figures written with no symbol at all
 * (only where the site's whole audience is in one currency).
 */
export function currencyHintsForHost(hostname: string): { dollarHint?: string; defaultCurrency?: string } {
  const h = hostname.toLowerCase();
  const tld: [RegExp, { dollarHint?: string; defaultCurrency?: string }][] = [
    [/\.com\.au$/, { dollarHint: "AUD" }],
    [/\.co\.nz$/, { dollarHint: "NZD" }],
    [/\.ca$/, { dollarHint: "CAD" }],
    [/\.sg$/, { dollarHint: "SGD" }],
    [/\.co\.uk$/, {}],
    [/^www\.totaljobs\.com$/, {}],
    [/^www\.stepstone\.de$/, { defaultCurrency: "EUR" }],
    [/\.de$/, {}],
    [/^ca\.indeed\.com$/, { dollarHint: "CAD" }],
    [/^au\.indeed\.com$/, { dollarHint: "AUD" }],
    [/^nz\.indeed\.com$/, { dollarHint: "NZD" }],
    [/^sg\.indeed\.com$/, { dollarHint: "SGD" }],
    [/^(www\.)?indeed\.com$/, { dollarHint: "USD" }],
    [/^www\.glassdoor\.com$/, { dollarHint: "USD" }],
  ];
  for (const [re, hint] of tld) if (re.test(h)) return hint;
  return {};
}

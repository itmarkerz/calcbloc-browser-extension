/**
 * Salary detection for job listings.
 *
 * Finds salary figures in a piece of text and returns them with currency, period and an annual equivalent.
 * Handles single figures and ranges, currency symbols and ISO codes (before or after the number), k / lakh /
 * crore suffixes, the common thousands and decimal separators (1,234.56 / 1.234,56 / 1 234 / 1'234 / 12,34,567)
 * and English, German, French, Spanish and Dutch period words. Anything it cannot read with confidence is
 * dropped: a missing currency, a figure that is too small or too large for its period, a day rate, a bonus,
 * commission or OTE figure.
 */

export type Period = "year" | "month" | "week" | "hour" | "day";

export interface SalaryMatch {
  /** The exact text that was read, e.g. "£40,000 - £50,000 a year". */
  raw: string;
  index: number;
  min: number;
  /** Same as min for a single figure. */
  max: number;
  /** ISO 4217 code, or "$" / "kr" when only the symbol was given and the context did not settle it. */
  currency: string;
  period: Period;
  /** True when the period was written out; false when it was inferred from the size of the figure. */
  periodStated: boolean;
}

export interface ParseOptions {
  /** Currency to assume for a bare "$" or "kr" (from the site's country), e.g. "AUD" on seek.com.au. */
  dollarHint?: string;
  /** Currency to assume when no currency is written at all (only used when the site states one, e.g. StepStone.de). */
  defaultCurrency?: string;
}

/** Rough size of one unit of each currency against USD, for plausibility checks only (not for conversion). */
const SCALE: Record<string, number> = {
  USD: 1, CAD: 1.4, AUD: 1.5, NZD: 1.7, SGD: 1.35, GBP: 0.8, EUR: 0.9, CHF: 0.9, AED: 3.7, INR: 85,
  SEK: 10.5, NOK: 10.5, DKK: 6.8, PLN: 4, CZK: 23, HUF: 360, RON: 4.6,
};

/** Plausible gross pay per period in USD-equivalent units: [min, max]. */
const RANGE: Record<Period, [number, number]> = {
  year: [6_000, 3_000_000],
  month: [500, 250_000],
  week: [120, 60_000],
  hour: [4, 1_500],
  day: [30, 10_000],
};

// Currency tokens, longest first so "US$" wins over "$".
const PREFIX_CURRENCIES: [string, string][] = [
  ["US$", "USD"], ["USD", "USD"], ["CA$", "CAD"], ["C$", "CAD"], ["CAD", "CAD"], ["AU$", "AUD"], ["A$", "AUD"], ["AUD", "AUD"],
  ["NZ$", "NZD"], ["NZD", "NZD"], ["SG$", "SGD"], ["S$", "SGD"], ["SGD", "SGD"], ["GBP", "GBP"], ["£", "GBP"], ["EUR", "EUR"],
  ["€", "EUR"], ["INR", "INR"], ["Rs.", "INR"], ["Rs", "INR"], ["₹", "INR"], ["CHF", "CHF"], ["Fr.", "CHF"], ["AED", "AED"],
  ["SEK", "SEK"], ["NOK", "NOK"], ["DKK", "DKK"], ["PLN", "PLN"], ["CZK", "CZK"], ["HUF", "HUF"], ["RON", "RON"], ["$", "$"],
];
const SUFFIX_CURRENCIES: [string, string][] = [
  ["EUR", "EUR"], ["€", "EUR"], ["GBP", "GBP"], ["£", "GBP"], ["USD", "USD"], ["CAD", "CAD"], ["AUD", "AUD"], ["NZD", "NZD"],
  ["SGD", "SGD"], ["INR", "INR"], ["CHF", "CHF"], ["AED", "AED"], ["SEK", "SEK"], ["NOK", "NOK"], ["DKK", "DKK"], ["PLN", "PLN"],
  ["zł", "PLN"], ["CZK", "CZK"], ["Kč", "CZK"], ["HUF", "HUF"], ["Ft", "HUF"], ["RON", "RON"], ["lei", "RON"], ["kr.", "kr"], ["kr", "kr"],
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PREFIX_RE = PREFIX_CURRENCIES.map(([t]) => esc(t)).join("|");
const SUFFIX_RE = SUFFIX_CURRENCIES.map(([t]) => esc(t)).join("|");

// Spaces used as thousands separators: normal, no-break, narrow no-break, thin.
const SP = "[ \\u00a0\\u202f\\u2009]";
// A number: digits with optional grouping (, . space ' ’) and an optional decimal part.
const NUM = `\\d{1,3}(?:(?:,|\\.|${SP}|'|’)\\d{2,3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?`;
// Magnitude suffixes. "L"/"lakh"/"lac"/"LPA" = 100,000; "Cr"/"crore" = 10,000,000. No "m" (clashes with "per m").
const MAG = `[kK](?![a-zA-Z])|thousand|Tsd\\.?|[lL]akhs?|[lL]acs?|LPA|L(?![a-zA-Z])|[cC]rores?|Cr(?![a-zA-Z])`;

// One amount: [currency] number [magnitude] [currency]
const AMOUNT = `(?:(${PREFIX_RE})${SP}?)?(${NUM})(?:${SP}?(${MAG}))?(?:${SP}?(${SUFFIX_RE})(?![A-Za-z]))?`;
// Range connector between two amounts.
const CONNECTOR = `${SP}*(?:-|–|—|−|~|to|bis|à|a|and|und|et|y|tot|tussen)${SP}*`;

const AMOUNT_RE = new RegExp(AMOUNT, "y");
const CONNECTOR_RE = new RegExp(CONNECTOR, "iy");
const START_RE = new RegExp(`(?:${PREFIX_RE})|\\d`, "g");

// Period words; each must end at a non-letter (Unicode-aware, so "año" and "jährlich" work).
const PERIOD_WORDS: [RegExp, Period][] = [
  [/^(?:hours?|hrs?|hourly|h|std\.?|stunde|stundenlohn|heure|hora|uur)(?!\p{L})/iu, "hour"],
  [/^(?:years?|yrs?|yearly|annum|annual|annually|jahr|jährlich|jahresgehalt|an|année|año|ano|jaar)(?!\p{L})/iu, "year"],
  [/^(?:months?|mos?|mths?|monthly|monat|monatlich|mois|mes|maand)(?!\p{L})/iu, "month"],
  [/^(?:weeks?|wks?|weekly|woche|wöchentlich|semaine|semana)(?!\p{L})/iu, "week"],
  [/^(?:days?|daily|tag|täglich|jour|día|dag)(?!\p{L})/iu, "day"],
];

/** Abbreviations that carry the period on their own: "p.a.", "pa", "pcm", "ph", "LPA". */
const PERIOD_ABBR: [RegExp, Period][] = [
  [/^(?:p\.?\s?a\.?|pa)(?![a-z])/i, "year"],
  [/^(?:p\.?\s?c\.?\s?m\.?|pcm|p\.?\s?m\.?)(?![a-z])/i, "month"],
  [/^(?:p\.?\s?h\.?|ph)(?![a-z])/i, "hour"],
  [/^(?:p\.?\s?w\.?|pw)(?![a-z])/i, "week"],
  [/^(?:p\.?\s?d\.?|pd)(?![a-z])/i, "day"],
];

/** Words that make a figure something other than base pay, when written right after it ("£5,000 bonus", "£45k OTE")... */
const NOT_BASE_PAY_AFTER = /^\s*(?:[-–(:]\s*)?(?:bonus|bonuses|sign[- ]?on|signing|commission|OTE|on[- ]target|relocation|referral|equity|in stock|shares|allowance|stipend|tips|budget|revenue|funding|raised|turnover|users|employees|customers|voucher|discount|gift card|cashback|fee|deposit|Prämie|Provision|Umsatz)(?!\p{L})/iu;
/** ...or right before it ("Signing bonus: $5,000", "OTE £60k", "raised $20M"). */
const NOT_BASE_PAY_BEFORE = /(?:bonus|bonuses|sign[- ]?on|signing|commission|OTE|on[- ]target|on target earnings|relocation|referral|equity|allowance|stipend|budget|revenue|funding|raised|turnover|Prämie|Provision|Umsatz)[^0-9]{0,12}$/iu;

export function parseNumber(s: string): number | null {
  const t = s.replace(/[\s'’]/g, "");
  // Decimal part: a final "." or "," followed by 1-2 digits.
  const dec = /^(.*?)[.,](\d{1,2})$/.exec(t);
  let intPart = t;
  let frac = "";
  if (dec && /[.,]/.test(t)) {
    intPart = dec[1];
    frac = dec[2];
  }
  // Remaining separators must be grouping separators.
  if (/[.,]/.test(intPart)) {
    const groups = intPart.split(/[.,]/);
    // Indian grouping 12,34,567 (2-digit groups before the last 3) or standard 3-digit groups.
    const last = groups[groups.length - 1];
    if (last.length !== 3) return null;
    const mid = groups.slice(1, -1);
    if (!mid.every((g) => g.length === 3) && !mid.every((g) => g.length === 2)) return null;
    if (groups[0].length === 0 || groups[0].length > 3) return null;
  }
  const n = Number(intPart.replace(/[.,]/g, "") + (frac ? "." + frac : ""));
  return Number.isFinite(n) ? n : null;
}

function magnitude(m: string | undefined): number {
  if (!m) return 1;
  const l = m.toLowerCase();
  if (l === "k" || l === "thousand" || l.startsWith("tsd")) return 1_000;
  if (l.startsWith("lakh") || l.startsWith("lac") || l === "lpa" || l === "l") return 100_000;
  if (l.startsWith("crore") || l === "cr") return 10_000_000;
  return 1;
}

const prefixCode = (t: string | undefined) => (t ? PREFIX_CURRENCIES.find(([k]) => k === t)?.[1] : undefined);
const suffixCode = (t: string | undefined) => (t ? SUFFIX_CURRENCIES.find(([k]) => k === t)?.[1] : undefined);

interface Amount {
  start: number;
  end: number;
  value: number;
  currency?: string;
  mag: number;
  hasMag: boolean;
  lpa: boolean;
}

function readAmount(text: string, at: number): Amount | null {
  AMOUNT_RE.lastIndex = at;
  const m = AMOUNT_RE.exec(text);
  if (!m || m[0].length === 0) return null;
  const [, pre, num, mag, suf] = m;
  const v = parseNumber(num);
  if (v === null) return null;
  // A bare digit run glued to letters (e.g. "B2B", "3rd") is not an amount; nor is "HRs 40".
  const before = text[at - 1];
  if (!pre && before && /[A-Za-z0-9]/.test(before)) return null;
  if (pre && /^[A-Za-z]/.test(pre) && before && /[A-Za-z]/.test(before)) return null;
  const after = text[at + m[0].length];
  if (after && /[0-9]/.test(after)) return null;
  if (after && /[A-Za-z]/.test(after) && !pre && !suf && !mag) return null;
  const mult = magnitude(mag);
  return {
    start: at,
    end: at + m[0].length,
    value: v * mult,
    currency: prefixCode(pre) ?? suffixCode(suf),
    mag: mult,
    hasMag: Boolean(mag),
    lpa: Boolean(mag && mag.toUpperCase() === "LPA"),
  };
}

/** Reads a period phrase right after an amount: "a year", "per hour", "/yr", "p.a.", "pro Monat", "brutto/Jahr". */
export function readPeriod(text: string, at: number): { period: Period; end: number } | null {
  const rest = text.slice(at, at + 40);
  const lead = /^\s*[(,:]?\s*(?:(?:gross|brutto|bruto|brut|before tax|vor Steuern)\s*)?(?:\/\s*|(?:per|an|a|each|every|pro|im|je|par|por|al|op|la|el|le)\s+|de l'|à l')?/i.exec(rest);
  const offset = lead ? lead[0].length : 0;
  const word = rest.slice(offset);
  const leadText = lead ? lead[0] : "";
  for (const [re, p] of PERIOD_WORDS) {
    const m = re.exec(word);
    if (!m) continue;
    // "an"/"h" alone are too short to trust without a connector ("/h", "per h", "par an").
    if ((m[0].toLowerCase() === "an" || m[0].toLowerCase() === "h") && !/\/|per|par|pro/i.test(leadText)) continue;
    return { period: p, end: at + offset + m[0].length };
  }
  for (const [re, p] of PERIOD_ABBR) {
    const m = re.exec(word);
    if (m) return { period: p, end: at + offset + m[0].length };
  }
  return null;
}

/** "Hourly", "Annual salary", "Monthly", "Stundenlohn" written just before the figure. */
function periodBefore(text: string, at: number): Period | null {
  const before = text.slice(Math.max(0, at - 30), at).toLowerCase();
  if (/(hourly|per hour|stundenlohn|pro stunde)\W*$/.test(before)) return "hour";
  if (/(monthly|per month|monatsgehalt|monatlich|mensuel)\W*$/.test(before)) return "month";
  if (/(annual|yearly|per year|per annum|jahresgehalt|annuel|anual)(\s+(salary|pay|base))?\W*$/.test(before)) return "year";
  if (/(weekly|per week)\W*$/.test(before)) return "week";
  if (/(daily|day rate|per day|tagessatz)\W*$/.test(before)) return "day";
  return null;
}

function resolveCurrency(c: string | undefined, opts: ParseOptions): string | undefined {
  if (!c) return opts.defaultCurrency;
  if (c === "$") return opts.dollarHint ?? "$";
  if (c === "kr") return opts.dollarHint && ["SEK", "NOK", "DKK"].includes(opts.dollarHint) ? opts.dollarHint : "kr";
  return c;
}

function plausible(value: number, period: Period, currency: string): boolean {
  const scale = SCALE[currency] ?? (currency === "$" ? 1.5 : currency === "kr" ? 10 : undefined);
  if (scale === undefined) return false;
  const [lo, hi] = RANGE[period];
  return value >= lo * scale * 0.5 && value <= hi * scale * 1.5;
}

/** Infer the period of a figure with no period written: only a clear annual figure is accepted. */
function inferPeriod(value: number, currency: string): Period | null {
  const scale = SCALE[currency] ?? (currency === "$" ? 1.5 : currency === "kr" ? 10 : undefined);
  if (scale === undefined) return null;
  if (value >= 12_000 * scale && value <= RANGE.year[1] * scale) return "year";
  return null;
}

/** All salary figures in `text`, left to right. */
export function findSalaries(text: string, opts: ParseOptions = {}): SalaryMatch[] {
  const out: SalaryMatch[] = [];
  if (!text || !/\d/.test(text)) return out;
  START_RE.lastIndex = 0;
  let pos = 0;
  for (;;) {
    START_RE.lastIndex = pos;
    const s = START_RE.exec(text);
    if (!s) break;
    const a = readAmount(text, s.index);
    if (!a) {
      pos = s.index + Math.max(1, s[0].length);
      // Skip the rest of a digit run so "B2B2" etc. don't produce partial matches.
      while (pos < text.length && /[\d.,]/.test(text[pos])) pos++;
      continue;
    }
    const lo = a;
    let hi: Amount | null = null;
    CONNECTOR_RE.lastIndex = a.end;
    const c = CONNECTOR_RE.exec(text);
    if (c) {
      const b = readAmount(text, c.index + c[0].length);
      if (b) hi = b;
    }
    // Period written after both ends: "$120K/yr - $150K/yr" (LinkedIn), "€50k p.a. – €60k p.a.".
    let innerPeriod: Period | null = null;
    if (!hi) {
      const p1 = readPeriod(text, a.end);
      if (p1) {
        CONNECTOR_RE.lastIndex = p1.end;
        const c2 = CONNECTOR_RE.exec(text);
        const b = c2 ? readAmount(text, c2.index + c2[0].length) : null;
        const p2 = b ? readPeriod(text, b.end) : null;
        if (b && p2 && p2.period === p1.period) {
          hi = b;
          innerPeriod = p1.period;
        }
      }
    }
    const last = hi ?? lo;
    let end = last.end;

    // Shared magnitude and currency across a range: "45-55k", "£40 - 50k", "50.000 – 60.000 €".
    let loVal = lo.value;
    let hiVal = hi ? hi.value : lo.value;
    if (hi && !lo.hasMag && hi.hasMag && lo.value < 1000) loVal = lo.value * hi.mag;
    const rawCurrency = lo.currency ?? hi?.currency;
    // Lakh / crore / LPA figures with no symbol are rupees.
    const indianUnits = !rawCurrency && [lo, hi].some((x) => x && (x.mag === 100_000 || x.mag === 10_000_000));
    const currency = indianUnits ? "INR" : resolveCurrency(rawCurrency, opts);

    let period: Period | null = null;
    let stated = false;
    const p = readPeriod(text, end);
    if (p) {
      period = p.period;
      stated = true;
      end = p.end;
    } else if (lo.lpa || hi?.lpa) {
      period = "year";
      stated = true;
    } else {
      const pb = periodBefore(text, lo.start);
      if (pb) {
        period = pb;
        stated = true;
      }
    }

    if (!period && innerPeriod) {
      period = innerPeriod;
      stated = true;
    }
    const raw = text.slice(lo.start, end);
    pos = end;

    // Must have a currency (written, or given by the site) unless it is an Indian lakh/LPA figure.
    if (!currency) continue;
    if (hiVal < loVal) continue;
    if (!period) period = inferPeriod(hiVal, currency);
    if (!period || period === "day") continue;
    if (!plausible(loVal, period, currency) || !plausible(hiVal, period, currency)) continue;
    // A range that spans more than 4x is more likely two different things.
    if (hiVal > loVal * 4) continue;
    // Bonus, commission, OTE, funding, etc. right before or after the figure.
    if (NOT_BASE_PAY_BEFORE.test(text.slice(Math.max(0, lo.start - 30), lo.start))) continue;
    if (NOT_BASE_PAY_AFTER.test(text.slice(end, end + 30))) continue;
    // Figures without any currency symbol need a stated period (or Indian units).
    if (!rawCurrency && !stated && !indianUnits) continue;

    out.push({ raw, index: lo.start, min: loVal, max: hiVal, currency, period, periodStated: stated });
  }
  return out;
}

export interface AnnualOptions {
  hoursPerWeek: number;
}

/** Annual equivalent of an amount in the given period. Day rates are never converted. */
export function toAnnual(value: number, period: Period, o: AnnualOptions): number | null {
  switch (period) {
    case "year":
      return value;
    case "month":
      return value * 12;
    case "week":
      return value * 52;
    case "hour":
      return value * o.hoursPerWeek * 52;
    default:
      return null;
  }
}

/** Converts an annual amount back to a period, for display next to the original figure. */
export function fromAnnual(annual: number, period: Period, o: AnnualOptions): number {
  switch (period) {
    case "month":
      return annual / 12;
    case "week":
      return annual / 52;
    case "hour":
      return annual / (o.hoursPerWeek * 52);
    default:
      return annual;
  }
}

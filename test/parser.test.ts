import { describe, expect, it } from "vitest";
import { findSalaries, fromAnnual, parseNumber, readPeriod, toAnnual } from "../src/shared/parser";

const NBSP = String.fromCharCode(0xa0);
const NNBSP = String.fromCharCode(0x202f);

const one = (text: string, opts = {}) => {
  const m = findSalaries(text, opts);
  expect(m, `expected one salary in "${text}"`).toHaveLength(1);
  return m[0];
};
const none = (text: string, opts = {}) => expect(findSalaries(text, opts), `expected no salary in "${text}"`).toEqual([]);

describe("parseNumber: locale separators", () => {
  it.each([
    ["45000", 45000],
    ["45,000", 45000],
    ["45.000", 45000],
    ["45 000", 45000],
    ["45" + NBSP + "000", 45000],
    ["45" + NNBSP + "000", 45000],
    ["45'000", 45000],
    ["1,234,567", 1234567],
    ["1.234.567", 1234567],
    ["12,34,567", 1234567],
    ["1,20,000", 120000],
    ["12.50", 12.5],
    ["18,50", 18.5],
    ["1,234.56", 1234.56],
    ["1.234,56", 1234.56],
  ])("%s -> %d", (s, n) => expect(parseNumber(s)).toBe(n));

  it("rejects malformed groupings", () => {
    expect(parseNumber("1,2345")).toBeNull();
    expect(parseNumber("1234,567")).toBeNull();
  });
});

describe("readPeriod", () => {
  it.each([
    [" a year", "year"],
    [" per annum", "year"],
    [" p.a.", "year"],
    [" pa", "year"],
    ["/yr", "year"],
    [" / year", "year"],
    [" annually", "year"],
    [" brutto/Jahr", "year"],
    [" pro Jahr", "year"],
    [" par an", "year"],
    [" al año", "year"],
    [" per jaar", "year"],
    [" a month", "month"],
    [" per month", "month"],
    [" pcm", "month"],
    ["/mo", "month"],
    [" monthly", "month"],
    [" pro Monat", "month"],
    [" an hour", "hour"],
    [" per hour", "hour"],
    ["/hr", "hour"],
    ["/h", "hour"],
    [" ph", "hour"],
    [" pro Stunde", "hour"],
    [" a week", "week"],
    [" per day", "day"],
  ])("%j -> %s", (s, p) => expect(readPeriod(s, 0)?.period).toBe(p));

  it("does not read unrelated words", () => {
    expect(readPeriod(" and benefits", 0)).toBeNull();
    expect(readPeriod(" annuity", 0)).toBeNull();
    expect(readPeriod(" anything", 0)).toBeNull();
    expect(readPeriod(" Hamburg", 0)).toBeNull();
  });
});

describe("findSalaries: single figures", () => {
  it("UK annual", () => {
    const m = one("£45,000 a year");
    expect(m).toMatchObject({ min: 45000, max: 45000, currency: "GBP", period: "year", periodStated: true });
  });
  it("US annual with no period is inferred as annual", () => {
    const m = one("Salary: $85,000", { dollarHint: "USD" });
    expect(m).toMatchObject({ min: 85000, currency: "USD", period: "year", periodStated: false });
  });
  it("hourly with decimals", () => {
    expect(one("£12.50 an hour")).toMatchObject({ min: 12.5, period: "hour", currency: "GBP" });
    expect(one("£12.50ph")).toMatchObject({ min: 12.5, period: "hour" });
    expect(one("18,50 € pro Stunde")).toMatchObject({ min: 18.5, period: "hour", currency: "EUR" });
  });
  it("monthly", () => {
    expect(one("S$6,500 per month")).toMatchObject({ min: 6500, currency: "SGD", period: "month" });
    expect(one("₹50,000 a month")).toMatchObject({ min: 50000, currency: "INR", period: "month" });
  });
  it("k suffix", () => {
    expect(one("$120K/yr", { dollarHint: "USD" })).toMatchObject({ min: 120000, period: "year" });
    expect(one("£45k")).toMatchObject({ min: 45000, period: "year", periodStated: false });
  });
  it("currency after the number (German, French)", () => {
    expect(one("60.000 € brutto/Jahr")).toMatchObject({ min: 60000, currency: "EUR", period: "year" });
    expect(one("55 000 € par an")).toMatchObject({ min: 55000, currency: "EUR", period: "year" });
    expect(one("65.000 EUR")).toMatchObject({ min: 65000, currency: "EUR", period: "year" });
  });
  it("ISO code before the number", () => {
    expect(one("USD 95,000 per year")).toMatchObject({ min: 95000, currency: "USD" });
    expect(one("AUD 110,000 + super")).toMatchObject({ min: 110000, currency: "AUD" });
  });
  it("from / up to", () => {
    expect(one("From £30,000 a year")).toMatchObject({ min: 30000, max: 30000 });
    expect(one("Up to £50,000 per annum")).toMatchObject({ min: 50000 });
  });
});

describe("findSalaries: ranges", () => {
  it("both ends with currency", () => {
    expect(one("£40,000 - £50,000 a year")).toMatchObject({ min: 40000, max: 50000, currency: "GBP", period: "year" });
  });
  it("en dash and K", () => {
    expect(one("$120K – $150K", { dollarHint: "USD" })).toMatchObject({ min: 120000, max: 150000, period: "year" });
  });
  it("shared k suffix", () => {
    expect(one("£45-55k")).toMatchObject({ min: 45000, max: 55000 });
    expect(one("£40 - 50k per annum")).toMatchObject({ min: 40000, max: 50000 });
  });
  it("currency only on the second figure", () => {
    expect(one("Gehalt: 55.000 – 65.000 €")).toMatchObject({ min: 55000, max: 65000, currency: "EUR" });
  });
  it("words as connector", () => {
    expect(one("$80,000 to $95,000 a year", { dollarHint: "CAD" })).toMatchObject({ min: 80000, max: 95000, currency: "CAD" });
    expect(one("50.000 bis 60.000 € pro Jahr")).toMatchObject({ min: 50000, max: 60000, currency: "EUR" });
  });
  it("hourly range", () => {
    expect(one("$25 - $32 an hour", { dollarHint: "USD" })).toMatchObject({ min: 25, max: 32, period: "hour" });
    expect(one("$25.50–$32.75 per hour", { dollarHint: "AUD" })).toMatchObject({ min: 25.5, max: 32.75, currency: "AUD" });
  });
  it("Indian lakh grouping and units", () => {
    expect(one("₹12,00,000 - ₹18,00,000 a year")).toMatchObject({ min: 1_200_000, max: 1_800_000, currency: "INR" });
    expect(one("₹8L - ₹12L")).toMatchObject({ min: 800_000, max: 1_200_000, currency: "INR", period: "year" });
    expect(one("10-15 Lacs P.A.")).toMatchObject({ min: 1_000_000, max: 1_500_000, currency: "INR", period: "year" });
    expect(one("12 LPA")).toMatchObject({ min: 1_200_000, currency: "INR", period: "year" });
  });
  it("Seek-style range with super", () => {
    expect(one("$110,000 – $130,000 + super", { dollarHint: "AUD" })).toMatchObject({ min: 110000, max: 130000, currency: "AUD" });
  });
  it("Indeed snippets", () => {
    expect(one("$70,000–$90,000 a year", { dollarHint: "USD" })).toMatchObject({ min: 70000, max: 90000 });
    expect(one("From $22 an hour", { dollarHint: "USD" })).toMatchObject({ min: 22, period: "hour" });
  });
  it("LinkedIn: period after both ends", () => {
    expect(one("$120K/yr - $150K/yr", { dollarHint: "USD" })).toMatchObject({ min: 120000, max: 150000, period: "year", raw: "$120K/yr - $150K/yr" });
    expect(one("$45/hr - $55/hr · Full-time", { dollarHint: "USD" })).toMatchObject({ min: 45, max: 55, period: "hour" });
    expect(one("£50K/yr - £60K/yr")).toMatchObject({ min: 50000, max: 60000, currency: "GBP" });
  });
  it("Glassdoor: estimate labels", () => {
    expect(one("$80K - $100K (Employer provided)", { dollarHint: "CAD" })).toMatchObject({ min: 80000, max: 100000, currency: "CAD", period: "year" });
    expect(one("CA$40.00 - CA$45.00 Per Hour (Employer provided)")).toMatchObject({ min: 40, max: 45, currency: "CAD", period: "hour" });
  });
  it("StepStone: euro ranges", () => {
    expect(one("55.000 € – 65.000 € / Jahr")).toMatchObject({ min: 55000, max: 65000, currency: "EUR", period: "year" });
    expect(one("4.500 € brutto/Monat")).toMatchObject({ min: 4500, period: "month" });
  });
  it("two salaries in one text", () => {
    const m = findSalaries("Junior: £28,000 a year. Senior: £45,000 a year.");
    expect(m.map((x) => x.min)).toEqual([28000, 45000]);
  });
});

describe("findSalaries: bare $ and kr", () => {
  it("keeps $ unresolved without a hint", () => {
    expect(one("$90,000 a year")).toMatchObject({ currency: "$" });
  });
  it("uses the site's hint", () => {
    expect(one("$90,000 a year", { dollarHint: "NZD" })).toMatchObject({ currency: "NZD" });
  });
  it("explicit dollar prefixes win over the hint", () => {
    expect(one("C$90,000 a year", { dollarHint: "USD" })).toMatchObject({ currency: "CAD" });
    expect(one("A$90,000 a year", { dollarHint: "USD" })).toMatchObject({ currency: "AUD" });
  });
  it("figures with no currency need the site's default currency and a stated period", () => {
    none("55.000 - 65.000");
    expect(one("55.000 - 65.000 pro Jahr", { defaultCurrency: "EUR" })).toMatchObject({ currency: "EUR" });
    none("55.000 - 65.000", { defaultCurrency: "EUR" });
  });
});

describe("findSalaries: ambiguous or non-salary figures are ignored", () => {
  it.each([
    "Posted 3 days ago",
    "2,500 employees",
    "4.5 out of 5 stars",
    "Raised $20M in Series B",
    "£500 per day", // day rate
    "£450 - £550 per day",
    "£2,000 sign-on bonus",
    "Signing bonus: $5,000",
    "£45k OTE",
    "£5,000 bonus",
    "Over 10,000 customers",
    "401k matching",
    "B2B SaaS",
    "$5,000", // no period, too small for an annual salary
    "₹50,000", // no period, could be monthly
    "S$5,000 - S$7,000", // no period, could be monthly
    "£9,500", // too small to be a yearly salary without a period
    "£10 - £100,000", // a range that wide is not one salary
    "Call 0800 123 456",
    "Job ID 1234567",
  ])("%s", (t) => none(t, { dollarHint: "USD" }));

  it("keeps the base pay next to an OTE figure", () => {
    const m = findSalaries("£30,000 basic, £45,000 OTE");
    expect(m.map((x) => x.min)).toEqual([30000]);
  });
  it("keeps a salary followed by '+ bonus'", () => {
    expect(one("£40,000 - £50,000 a year + bonus")).toMatchObject({ min: 40000, max: 50000 });
  });
});

describe("annual conversion", () => {
  const o = { hoursPerWeek: 40 };
  it("converts each period", () => {
    expect(toAnnual(50000, "year", o)).toBe(50000);
    expect(toAnnual(4000, "month", o)).toBe(48000);
    expect(toAnnual(1000, "week", o)).toBe(52000);
    expect(toAnnual(25, "hour", o)).toBe(52000);
    expect(toAnnual(25, "hour", { hoursPerWeek: 37.5 })).toBe(48750);
    expect(toAnnual(500, "day", o)).toBeNull();
  });
  it("round-trips", () => {
    expect(fromAnnual(52000, "hour", o)).toBe(25);
    expect(fromAnnual(48000, "month", o)).toBe(4000);
  });
});

/**
 * Finds the elements that hold a salary: first through the site adapter's selectors, then a generic pass
 * over short text on the same page (for salaries in places the adapter does not know, or after a site
 * redesign). The generic pass only runs on supported sites and only accepts short text that is clearly pay.
 */
import { findSalaries } from "../shared/parser";
import type { Adapter } from "./adapters";

export interface Candidate {
  el: Element;
  text: string;
  generic: boolean;
}

const MAX_TEXT = 200;
const MAX_GENERIC_TEXT = 120;
const MAX_TEXT_NODES = 4000;

export const normalize = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

const QUICK = /[$£€₹]|\b(?:USD|EUR|GBP|INR|CAD|AUD|NZD|SGD|CHF|Rs)\b|\d ?[kK]\b|lakh|lac|LPA/;
const PAY_WORDS = /salary|pay\b|compensation|wage|gehalt|vergütung|lohn|salaire|sueldo|salario|a year|an hour|a month|per (?:year|annum|hour|month|week)|\/ ?(?:yr|year|hr|hour|mo|month)|p\.? ?a\.?\b|pro (?:jahr|monat|stunde)/i;
const SKIP = "script,style,noscript,textarea,input,select,option,[contenteditable],[data-calcbloc-badge],code,pre";

function related(el: Element, seen: Set<Element>): boolean {
  for (const s of seen) if (s === el || s.contains(el) || el.contains(s)) return true;
  return false;
}

export function findCandidates(doc: Document, adapter: Adapter): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<Element>();

  for (const sel of adapter.salarySelectors) {
    let list: NodeListOf<Element>;
    try {
      list = doc.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const el of list) {
      if (related(el, seen) || el.closest(SKIP)) continue;
      const text = normalize(el.textContent);
      if (!text || text.length > MAX_TEXT || !/\d/.test(text)) continue;
      seen.add(el);
      out.push({ el, text, generic: false });
    }
  }

  // Generic pass: short text nodes that look like pay, anywhere on the (supported) page.
  const body = doc.body;
  if (!body) return inPageOrder(out);
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  let n = 0;
  const parents = new Set<Element>();
  for (let node = walker.nextNode(); node && n < MAX_TEXT_NODES; node = walker.nextNode(), n++) {
    const data = (node as Text).data;
    if (!data || !/\d/.test(data) || !QUICK.test(data)) continue;
    const parent = node.parentElement;
    if (parent) parents.add(parent);
  }
  for (const p of parents) {
    // Climb to the smallest element that holds the whole figure (a range is sometimes split across spans).
    let el: Element | null = p;
    for (let i = 0; i < 2 && el?.parentElement && normalize(el.parentElement.textContent).length <= MAX_GENERIC_TEXT; i++) {
      if (findSalaries(normalize(el.textContent)).length) break;
      el = el.parentElement;
    }
    if (!el || el === body || el.closest(SKIP) || related(el, seen)) continue;
    const text = normalize(el.textContent);
    if (!text || text.length > MAX_GENERIC_TEXT) continue;
    const m = findSalaries(text)[0];
    if (!m || !(m.periodStated || PAY_WORDS.test(text))) continue;
    seen.add(el);
    out.push({ el, text, generic: true });
  }
  return inPageOrder(out);
}

function inPageOrder(list: Candidate[]): Candidate[] {
  return list.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
}

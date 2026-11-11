import type { Adapter } from "./types";

/** Selectors shared by StepStone.de and Totaljobs, which run on the same job board platform. */
const SELECTORS = [
  '[data-at="job-item-salary-info"]',
  '[data-at="metadata-salary"]',
  '[data-at="job-ad-salary"]',
  '[data-testid="job-item-salary-info"]',
  '[data-genesis-element="BASE"] [data-at="salary"]',
];

/** Totaljobs (UK). */
export const totaljobs: Adapter = { id: "totaljobs", isJobPage: () => true, salarySelectors: SELECTORS };

/** StepStone (Germany). */
export const stepstone: Adapter = { id: "stepstone", isJobPage: () => true, salarySelectors: SELECTORS };

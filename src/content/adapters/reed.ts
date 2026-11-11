import type { Adapter } from "./types";

/** Reed.co.uk: search result cards and job pages. */
export const reed: Adapter = {
  id: "reed",
  isJobPage: () => true,
  salarySelectors: [
    '[data-qa="job-card-salary"]',
    '[data-qa="job-metadata-salary"]',
    '[data-qa="salaryLbl"]',
    "li.job-metadata__item--salary",
    ".job-card_jobMetadata__item___QNud--salary",
    '[itemprop="baseSalary"]',
  ],
};

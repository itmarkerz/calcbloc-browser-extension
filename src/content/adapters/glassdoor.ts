import type { Adapter } from "./types";

/** Glassdoor job search (all country domains): listing cards and the job details panel. */
export const glassdoor: Adapter = {
  id: "glassdoor",
  isJobPage: (url) => /\/(job|Job|Jobs|job-listing|Job-listing)/.test(url.pathname) || url.pathname === "/",
  salarySelectors: [
    '[data-test="detailSalary"]',
    '[data-test="salary-estimate"]',
    '[data-test="detailSalaryRange"]',
    ".salary-estimate",
    '[class*="SalaryEstimate_salaryRange"]',
    '[class*="JobCard_salaryEstimate"]',
  ],
};

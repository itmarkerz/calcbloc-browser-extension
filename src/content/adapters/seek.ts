import type { Adapter } from "./types";

/** SEEK (Australia and New Zealand): search results and job details. */
export const seek: Adapter = {
  id: "seek",
  isJobPage: () => true,
  salarySelectors: ['[data-automation="jobSalary"]', '[data-automation="job-detail-salary"]', '[data-automation="jobCardSalary"]'],
};

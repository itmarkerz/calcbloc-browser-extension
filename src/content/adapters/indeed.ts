import type { Adapter } from "./types";

/** Indeed (all country sites on *.indeed.com): result cards and the job view. */
export const indeed: Adapter = {
  id: "indeed",
  isJobPage: () => true,
  salarySelectors: [
    // Result cards
    '[data-testid="attribute_snippet_testid"]',
    ".salary-snippet-container",
    ".metadata.salary-snippet-container",
    ".estimated-salary",
    // Job view (side pane and full page)
    "#salaryInfoAndJobType > span:first-child",
    '[data-testid="jobsearch-OtherJobDetailsContainer"] #salaryInfoAndJobType span',
    '#jobDetailsSection [data-testid$="-tile"] [data-testid="list-item"]',
  ],
};

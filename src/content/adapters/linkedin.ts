import type { Adapter } from "./types";

/** LinkedIn Jobs: search results, recommended jobs and the job details pane (signed in and public pages). */
export const linkedin: Adapter = {
  id: "linkedin",
  isJobPage: (url) => url.pathname.startsWith("/jobs"),
  salarySelectors: [
    // Job cards in search results and collections
    ".job-card-container__metadata-item",
    ".job-card-container__metadata-wrapper li",
    ".artdeco-entity-lockup__metadata li",
    // Job details pane (top card "insights" and preference buttons)
    ".job-details-jobs-unified-top-card__job-insight",
    ".job-details-fit-level-preferences button",
    ".jobs-unified-top-card__job-insight",
    "#SALARY .jobs-details__salary-main-rail-card",
    // Public (signed-out) job pages
    ".job-search-card__salary-info",
    ".compensation__salary",
    ".salary.compensation__salary",
  ],
};

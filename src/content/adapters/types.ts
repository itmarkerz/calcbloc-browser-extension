/** A site adapter says where salaries appear on one job site. */
export interface Adapter {
  id: string;
  /** False on pages of the site that are not job listings (the extension then does nothing). */
  isJobPage(url: URL): boolean;
  /** CSS selectors for elements that hold a salary, on search results and on job pages. */
  salarySelectors: string[];
}

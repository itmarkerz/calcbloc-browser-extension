/**
 * The extension API object: `browser` in Firefox (promise-based), `chrome` in Chrome and Edge
 * (promise-based in Manifest V3). Only APIs that behave the same in all three are used.
 */
export type Ext = typeof chrome;

export function ext(): Ext {
  const g = globalThis as unknown as { browser?: Ext; chrome?: Ext };
  const api = g.browser ?? g.chrome;
  if (!api) throw new Error("Extension API not available");
  return api;
}

/** Build target, set by the bundler. */
declare const __BROWSER__: "chrome" | "firefox" | "edge";
export const BROWSER: "chrome" | "firefox" | "edge" = typeof __BROWSER__ === "string" ? __BROWSER__ : "chrome";

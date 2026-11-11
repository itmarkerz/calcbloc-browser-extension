/**
 * Local fixture server for the end-to-end test (http://127.0.0.1:3103 by default).
 *
 * It serves the test pages that mimic each supported job site. In the test, Playwright intercepts requests to
 * the real host names (www.linkedin.com, uk.indeed.com, www.seek.com.au, ...) and answers them with the
 * matching page fetched from this server, so the real extension build (unchanged manifest) runs exactly as it
 * would on the real sites, and no request leaves the machine.
 *
 *   node e2e/server.mjs            # serve until stopped, to look at the pages by hand
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const PORT = Number(process.env.E2E_PORT ?? 3103);
export const BASE = `http://127.0.0.1:${PORT}`;

/** Real host + path prefix -> fixture file. */
export const PAGES = [
  { host: "www.linkedin.com", path: "/jobs/search/", file: "linkedin.html" },
  { host: "www.linkedin.com", path: "/feed/", file: "linkedin-feed.html" },
  { host: "uk.indeed.com", path: "/jobs", file: "indeed.html" },
  { host: "www.glassdoor.ca", path: "/Job/toronto-jobs.htm", file: "glassdoor.html" },
  { host: "www.reed.co.uk", path: "/jobs/manchester", file: "reed.html" },
  { host: "www.totaljobs.com", path: "/jobs/in-birmingham", file: "totaljobs.html" },
  { host: "www.seek.com.au", path: "/jobs-in-sydney", file: "seek.html" },
  { host: "www.stepstone.de", path: "/jobs/in-berlin", file: "stepstone.html" },
  { host: "jobs.example.org", path: "/careers", file: "unsupported.html" },
];

export const HOSTS = [...new Set(PAGES.map((p) => p.host))];

/** The fixture URL on this server for a request to a real job-site URL, or null. */
export function fixtureUrl(realUrl) {
  const u = new URL(realUrl);
  if (u.pathname === "/_style.css") return `${BASE}/_style.css`;
  const page = PAGES.find((p) => p.host === u.hostname && u.pathname.startsWith(p.path));
  return page ? `${BASE}/${page.file}` : null;
}

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8" };

export function startServer(port = PORT) {
  const server = createServer((req, res) => {
    const name = (req.url ?? "/").split("?")[0].replace(/^\/+/, "");
    if (!/^[a-z_-]+\.(html|css)$/.test(name)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    try {
      const body = readFileSync(join(here, "fixtures", name));
      res.writeHead(200, { "Content-Type": TYPES[name.slice(name.lastIndexOf("."))] });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

export function stopServer(server) {
  return new Promise((ok) => {
    server.closeAllConnections?.();
    server.close(() => ok(undefined));
  });
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await startServer();
  console.log(`Fixture pages on ${BASE}`);
  for (const p of PAGES) console.log(`  ${BASE}/${p.file}   (stands in for https://${p.host}${p.path})`);
}

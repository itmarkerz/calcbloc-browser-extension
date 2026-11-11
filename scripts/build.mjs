#!/usr/bin/env node
/**
 * Builds the extension for one or more browsers from the same source.
 *
 *   node scripts/build.mjs chrome|firefox|edge|all [--zip]
 *
 * Output: dist/<browser>/ (load unpacked from there) and, with --zip, dist/calcbloc-take-home-<browser>-<version>.zip.
 * The manifest is manifest/base.json + manifest/<browser>.json (shallow merge per top-level key), with the
 * content-script match patterns filled in from src/shared/sites.ts and the version from package.json.
 */
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { zipDirectory } from "./zip.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BROWSERS = {
  chrome: { target: ["chrome116"] },
  edge: { target: ["edge116"] },
  firefox: { target: ["firefox128"] },
};

const args = process.argv.slice(2);
const which = args.find((a) => !a.startsWith("--")) ?? "all";
const zip = args.includes("--zip");
const targets = which === "all" ? Object.keys(BROWSERS) : [which];
for (const t of targets) if (!BROWSERS[t]) throw new Error(`Unknown browser "${t}". Use chrome, firefox, edge or all.`);

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

/** Reads the match patterns from sites.ts by bundling it to a temporary ESM module. */
async function siteMatches() {
  const out = resolve(root, "dist", ".sites.mjs");
  await build({ entryPoints: [resolve(root, "src/shared/sites.ts")], bundle: true, format: "esm", platform: "neutral", outfile: out, logLevel: "silent" });
  const mod = await import(pathToFileURL(out).href + `?t=${Date.now()}`);
  rmSync(out);
  return mod.allMatchPatterns();
}

export function manifestFor(browser, matches, version) {
  const base = JSON.parse(readFileSync(resolve(root, "manifest/base.json"), "utf8"));
  const overlay = JSON.parse(readFileSync(resolve(root, `manifest/${browser}.json`), "utf8"));
  const m = { ...base, ...overlay, version };
  m.content_scripts = base.content_scripts.map((cs) => ({ ...cs, matches }));
  return m;
}

async function buildOne(browser, matches) {
  const out = resolve(root, "dist", browser);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  await build({
    entryPoints: {
      background: resolve(root, "src/background/index.ts"),
      content: resolve(root, "src/content/index.ts"),
      options: resolve(root, "src/options/options.ts"),
    },
    outdir: out,
    bundle: true,
    format: "iife",
    target: BROWSERS[browser].target,
    minify: false, // readable code helps store review; the bundle is small
    sourcemap: false,
    legalComments: "none",
    charset: "utf8",
    define: { __BROWSER__: JSON.stringify(browser) },
    logLevel: "warning",
  });
  cpSync(resolve(root, "src/options/options.html"), resolve(out, "options.html"));
  cpSync(resolve(root, "src/options/options.css"), resolve(out, "options.css"));
  mkdirSync(resolve(out, "icons"), { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    const icon = resolve(root, `icons/icon-${size}.png`);
    if (!existsSync(icon)) throw new Error(`Missing ${icon}. Run npm run icons.`);
    cpSync(icon, resolve(out, `icons/icon-${size}.png`));
  }
  cpSync(resolve(root, "LICENSE"), resolve(out, "LICENSE"));
  writeFileSync(resolve(out, "manifest.json"), JSON.stringify(manifestFor(browser, matches, pkg.version), null, 2) + "\n");
  let note = "";
  if (zip) {
    const file = resolve(root, "dist", `calcbloc-take-home-${browser}-${pkg.version}.zip`);
    await zipDirectory(out, file);
    note = ` + ${file.replace(root + "\\", "").replace(root + "/", "")}`;
  }
  console.log(`built dist/${browser}${note}`);
}

const matches = await siteMatches();
for (const b of targets) await buildOne(b, matches);

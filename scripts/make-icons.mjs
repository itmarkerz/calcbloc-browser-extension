#!/usr/bin/env node
/** Renders icons/icon.svg to the PNG sizes the manifests use (16, 32, 48, 128) with headless Chromium. */
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(resolve(root, "icons/icon.svg"), "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: resolve(root, `icons/icon-${size}.png`), omitBackground: true });
  console.log(`icons/icon-${size}.png`);
}
await browser.close();

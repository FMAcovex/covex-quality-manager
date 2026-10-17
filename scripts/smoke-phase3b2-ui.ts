import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "./auth-fixtures/browser";
import { type Page, type Locator } from "playwright";
import { prisma } from "../src/lib/db";
import { createPhase3b2Fixtures } from "./phase3b2-fixtures";
import { readZip, getZipEntryText } from "../src/lib/ooxml/zip";

const base = process.env.PHASE3B2_UI_BASE_URL ?? "http://127.0.0.1:3000";
const captures = process.env.PHASE3B2_SCREENSHOT_DIR;
async function visit(page: Page, path: string) {
  const response = await page.goto(base + path);
  assert(response?.ok(), path);
  await page.locator("main h1").waitFor();
  await page.waitForLoadState("networkidle");
  assert.notEqual(await page.locator("main h1").innerText(), "No se ha podido completar la operación", "No application error screen: " + path);
  assert(await page.evaluate(() => document.body.scrollWidth <= innerWidth + 1), "No global horizontal overflow: " + path);
}
async function download(link: Locator, page: Page) {
  const pending = page.waitForEvent("download");
  await link.click();
  const artifact = await pending, path = await artifact.path();
  assert(path);
  return readFile(path);
}
async function main() {
  assert.equal(new URL(base).hostname, "127.0.0.1");
  const fixture = await createPhase3b2Fixtures(1000, true, true);
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ["--no-sandbox"] });
  const errors: string[] = [];
  let downloads = 0;
  if (captures) await mkdir(captures, { recursive: true });
  try {
    for (const width of [1440, 768, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, timezoneId: "Europe/Madrid" });
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error" && !message.location().url.endsWith("/favicon.ico")) errors.push(message.text()); });
      async function capture(name: string) { if (captures) await page.screenshot({ path: captures + "/" + width + "-" + name + ".png", fullPage: true }); }
      await visit(page, "/");
      assert.equal(await page.locator(".dashboard-summary article").count(), 5);
      assert.equal(await page.locator(".dashboard-module-grid article").count(), 8);
      await capture("dashboard");
      await visit(page, "/?module=CAPA&year=2026&department=" + fixture.departments[0] + "&state=OPEN&tasks=upcoming&page=2");
      await page.getByTestId("qms-dashboard").waitFor();
      await visit(page, "/?module=AUDIT&tasks=all&page=9999");
      const listing = "/controlled-documents?q=" + fixture.prefix;
      await visit(page, listing);
      assert.equal(await page.locator(".pnt-list-table tbody tr").count(), 25);
      const counts = await page.locator(".pnt-summary").innerText();
      await page.getByRole("link", { name: "Siguiente", exact: true }).click();
      await page.waitForLoadState("networkidle");
      assert.equal(new URL(page.url()).searchParams.get("page"), "2");
      assert.equal(await page.locator(".pnt-summary").innerText(), counts);
      await capture("pnt-page2");
      const rowLink = page.locator(".pnt-list-table tbody tr a").first();
      const href = await rowLink.getAttribute("href"); assert(href);
      assert.equal(new URL(new URL(href, base).searchParams.get("returnTo")!, base).searchParams.get("page"), "2");
      await rowLink.click();
      await page.locator("main h1").waitFor();
      const masterPath = new URL(page.url()).pathname;
      for (const tab of ["information", "revisions", "documents", "history"]) await visit(page, masterPath + "?tab=" + tab);
      await capture("pnt-detail");
      await visit(page, listing + "&page=9999");
      assert.equal(await page.locator(".pnt-summary").innerText(), counts);
      const xlsx = await download(page.getByRole("link", { name: "Descargar .xlsx", exact: true }), page);
      const zip = readZip(xlsx);
      const sheet = zip.filter(item => /^xl\/worksheets\/sheet\d+\.xml$/.test(item.name)).map(item => getZipEntryText(zip, item.name)).join("\n");
      assert.equal(new Set(sheet.match(/ZZ-\d{2}\/\d{3}/g) ?? []).size, fixture.masterSize, "XLSX exports every matching master/revision from last page");
      downloads++;
      const searchIndex = Array.from({ length: fixture.masterSize }, (_, i) => i).filter(i => i % 11 !== 0).at(-1)!;
      await visit(page, "/controlled-documents?q=" + fixture.prefix + "-source-" + searchIndex);
      assert(await page.locator(".pnt-list-table tbody tr").count() > 0, "Search finds rows beyond the initial page");
      await visit(page, listing + "&view=latest&revisionState=DRAFT&department=" + fixture.departments[1] + "&sort=reviewDueAt&direction=desc");
      assert(await page.locator(".pnt-list-table tbody tr").count() > 0);
      for (const [route, id] of [["complaints", fixture.ids[3][1]], ["returns", fixture.ids[4][1]]] as const) {
        await visit(page, "/" + route + "/" + id);
        await capture(route + "-detail");
        for (const tab of route === "complaints" ? ["part-i", "part-ii", "versions", "documents", "timeline"] : ["checks", "documents", "followups", "timeline"]) {
          await visit(page, "/" + route + "/" + id + "?tab=" + tab);
          if (tab === "versions" || (route === "returns" && tab === "documents")) {
            const links = page.locator(route === "complaints" ? 'a[href*="/signed-pdf"]' : 'a[href*="/documents/"], a[href*="/signed-pdf/"]');
            assert(await links.count() > 0, route + "/" + id + "/" + tab + ": signed/historical download links are present");
            for (const link of await links.all()) {
              const bytes = await download(link, page);
              assert.equal(createHash("sha256").update(bytes).digest("hex"), fixture.checksum);
              assert.deepEqual(bytes, fixture.bytes);
              downloads++;
            }
          }
          if (tab === "documents") for (const link of await page.locator('a[href*="/api/settings/templates/"]').all()) {
            const bytes = await download(link, page);
            assert.deepEqual(bytes, fixture.bytes);
            assert.equal(createHash("sha256").update(bytes).digest("hex"), fixture.checksum);
            downloads++;
          }
        }
      }
      await page.close();
      console.log("3B2 Chromium " + width + ": Dashboard, PNT first/middle/last/search/return/export/detail, complaint/return tabs and historical downloads passed.");
    }
    assert.deepEqual(errors, [], "No JavaScript/console/hydration errors");
    if (captures) await writeFile(captures + "/browser-integrity.json", JSON.stringify({ widths: [1440, 768, 390], downloads, javascriptErrors: errors, tested: ["Dashboard", "PNT list/detail/pages/search/return/full export", "Complaint/Return tabs/historical downloads/templates"] }, null, 2));
    console.log("3B2 browser: " + downloads + " verified downloads; no JavaScript or hydration errors.");
  } finally { await browser.close(); await fixture.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

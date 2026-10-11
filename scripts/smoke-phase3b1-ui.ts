import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { prisma } from "../src/lib/db";
import { readZip, getZipEntryText } from "../src/lib/ooxml/zip";
import { assertSyntheticDatabase, createListFixtures } from "./phase3b1-fixtures";

const base = process.env.PHASE3B1_UI_BASE_URL;
async function visit(page: Page, path: string) {
  await page.goto(base + path);
  await page.locator('main h1').waitFor();
  await page.waitForLoadState("networkidle");
}
async function main() {
  assertSyntheticDatabase(); assert(base, "PHASE3B1_UI_BASE_URL obligatorio");
  const fixture = await createListFixtures();
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ["--no-sandbox"] });
  const context = await browser.newContext({ timezoneId: "Europe/Madrid" });
  const page = await context.newPage(), errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && /hydration|React|Application error/i.test(message.text())) errors.push(message.text()); });
  const captureDir = process.env.PHASE3B1_SCREENSHOT_DIR;
  if (captureDir) await mkdir(captureDir, { recursive: true });
  try {
    for (const [m, root, table] of [[0, "/deviations", "deviation-list-table"], [1, "/capa", "capa-list-table"], [2, "/changes", "change-control-list-table"]] as const) {
      const query = new URLSearchParams({ q: fixture.prefix, page: "2" });
      fixture.departments.forEach(d => query.append("department", d));
      ["2025", "2026"].forEach(year => query.append("year", year));
      ["OPEN", "CLOSED"].forEach(status => query.append("status", status));
      const listing = root + "?" + query;
      for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: 1000 }); await visit(page, listing);
        const pagination = page.getByRole("navigation", { name: "Paginación de expedientes", exact: true });
        assert((await pagination.innerText()).includes("358 resultados · Página 2 de 15"));
        assert.equal(await page.locator(`#${table} tbody tr`).count(), 25);
        for (const link of await pagination.getByRole("link").all()) {
          const box = await link.boundingBox(); assert(box && box.x >= 0 && box.x + box.width <= width + 2, "Paginación visible en móvil");
        }
        if (captureDir) await page.screenshot({ path: `${captureDir}/${root.slice(1)}-${width}.png`, fullPage: true });
        const detail = page.locator(`#${table} td[data-column-key="code"] a`).first();
        const detailUrl: URL = new URL((await detail.getAttribute("href"))!, base);
        assert.equal(detailUrl.searchParams.get("returnTo"), listing);
        await detail.click(); await page.waitForURL(url => url.pathname.startsWith(root + "/"));
        const back = page.locator(".record-header .eyebrow a").first();
        assert.equal(await back.getAttribute("href"), listing);
        await back.click();
        await page.waitForURL(url => url.pathname === root && url.searchParams.get("page") === "2");
        assert.deepEqual(new URL(page.url()).searchParams.getAll("department"), fixture.departments);
        await pagination.getByRole("link", { name: "Última", exact: true }).click();
        await page.waitForURL(url => url.searchParams.get("page") === "15"); await page.waitForLoadState("networkidle");
        assert.equal(await page.locator(`#${table} tbody tr`).count(), 8);
        await pagination.getByRole("link", { name: "Anterior", exact: true }).click();
        await page.waitForURL(url => url.searchParams.get("page") === "14");
        assert.deepEqual(new URL(page.url()).searchParams.getAll("status"), ["OPEN", "CLOSED"]);
      }
      // Server search must find a record that was outside both page 2 and the former 300-row cap.
      await visit(page, listing);
      const code = `${fixture.prefix}-${m}-00333`;
      await page.locator('input[name="q"]').fill(code);
      await page.getByRole("button", { name: "Buscar", exact: true }).click();
      await page.waitForURL(url => url.searchParams.get("q") === code); await page.waitForLoadState("networkidle");
      assert.equal(new URL(page.url()).searchParams.get("page"), null, "Cambiar filtro reinicia página");
      assert.equal(await page.locator(`#${table} td[data-column-key="code"] a`).count(), 1);
      assert((await page.locator(`#${table}`).innerText()).includes(code));
      await visit(page, root + "?" + new URLSearchParams({ q: `${fixture.prefix}-${m}-00000`, page: "1" }));
      await page.getByRole("link", { name: "Abrir revisión del expediente", exact: true }).click();
      await page.waitForURL(url => url.searchParams.get("tab") === "review");
      assert(new URL(page.url()).searchParams.get("returnTo")?.includes("page=1"));
      await page.locator(".record-header .eyebrow a").first().click();
      await page.waitForURL(url => url.pathname === root && url.searchParams.get("page") === "1");
      // Exercise the existing full XLSX endpoint while a later page is visible.
      await visit(page, listing);
      const exports = new URLSearchParams({ page: "2" }); fixture.departments.forEach(d => exports.append("department", d));
      const response = await context.request.get(`${base}/api${root}/export/simple?${exports}`);
      assert(response.ok());
      const entries = readZip(await response.body());
      const xml = entries.filter(e => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name)).map(e => getZipEntryText(entries, e.name)).join("\n");
      assert.equal(new Set((xml.match(new RegExp(`${fixture.prefix}-${m}-\\d{5}`, "g")) ?? [])).size, 358, "XLSX incluye todas las activas no borrador, nunca solo la página");
      console.log(`3B1 UI ${root}: filtros/búsqueda/páginas/retorno/Review/exportación y 1440/768/390 OK.`);
    }
    const query = new URLSearchParams({ q: fixture.prefix, nextReviewFrom: "2026-02-01", nextReviewTo: "2026-02-28" });
    await visit(page, "/audits?" + query); assert((await page.locator("main").innerText()).includes("2 expedientes · página 1 de 1"));
    await visit(page, "/audits?" + new URLSearchParams({ q: fixture.prefix, nextReviewFrom: "2026-02-31" }));
    assert((await page.locator('main .form-errors[role="alert"]').innerText()).includes("no válida"));
    assert((await page.locator("main").innerText()).includes("0 expedientes · página 1 de 1"));
    assert.deepEqual(errors, [], "Sin errores JavaScript/hidratación");
    console.log("3B1 navegador OK: errores de fecha visibles; regresión completa de listados sin errores de hidratación.");
  } finally { await context.close(); await browser.close(); await fixture.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

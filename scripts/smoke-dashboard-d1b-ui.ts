import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "./auth-fixtures/browser";
import { type Page } from "playwright";
import { prisma } from "../src/lib/db";

const base = process.env.D1B_UI_BASE_URL;

async function visit(page: Page, path: string) {
  await page.goto(base + path);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("qms-dashboard").waitFor();
}
async function countFor(module: string) {
  const where = { qmsRecord: { isActive: true }, status: "OPEN" as const };
  switch (module) {
    case "DEVIATION": return prisma.deviation.count({ where });
    case "CAPA": return prisma.capa.count({ where });
    case "COMPLAINT": return prisma.complaint.count({ where });
    case "RETURN": return prisma.returnRecord.count({ where });
    case "AUDIT": return prisma.audit.count({ where });
    case "OOS": return prisma.oosRecord.count({ where });
    case "CHANGE_CONTROL": return prisma.changeControl.count({ where: { qmsRecord: { isActive: true }, finalStatus: "OPEN" } });
    default: throw new Error("Unknown module");
  }
}

async function main() {
  if (process.env.APP_ENV !== "test" || !base) throw new Error("APP_ENV=test y D1B_UI_BASE_URL obligatorios.");
  const browser = await chromium.launch({ args: ["--no-sandbox"], executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Madrid" });
  // Los filtros del panel están plegados por defecto; se abren como preferencia del navegador.
  await page.addInitScript(() => { try { localStorage.setItem("qms.filters.dashboard", "open"); } catch { /* sin almacenamiento */ } });
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", msg => { if (msg.type() === "error" && /hydrat|server rendered/i.test(msg.text())) errors.push(msg.text()); });
  try {
    const start = Date.now();
    await visit(page, "/");
    assert(await page.getByRole("heading", { name: "Panel de Calidad" }).count() === 1);
    for (const [module, label] of [
      ["DEVIATION", "Desviaciones"], ["CAPA", "CAPA"],
      ["CHANGE_CONTROL", "Controles de cambios"], ["COMPLAINT", "Reclamaciones"],
      ["RETURN", "Devoluciones"], ["AUDIT", "Auditorías"], ["OOS", "OOS"],
    ] as const) {
      const row = page.locator(".dashboard-module-row").filter({ has: page.locator("th").getByText(label, { exact: true }) });
      assert.equal(await row.count(), 1, module + " row count");
      const actual = Number(await row.locator(".dashboard-module-open").textContent());
      const expected = await countFor(module);
      assert.equal(actual, expected, module + ": opened count differs from independent Prisma count");
    }
    const masterCount = await prisma.controlledDocument.count({ where: { administrativeStatus: { not: "ANNULLED" } } });
    const pnt = page.locator(".dashboard-pnt-line");
    assert.equal(Number(await pnt.locator("b").first().textContent()), masterCount);
    assert.equal(await page.locator(".dashboard-module-row").count(), 7);
    console.log("D1B: siete cohortes activas vs Prisma y maestros PNT distintos; render " + (Date.now() - start) + "ms.");

    const links = page.locator(".dashboard-task-table tbody a");
    for (const href of await links.evaluateAll(nodes => nodes.map(node => node.getAttribute("href")))) {
      assert(href?.startsWith("/") && !href.startsWith("//"), "No se permite enlace de tarea externo: " + href);
    }

    // Filtering must be server-side; no URL state left only in client memory.
    await page.getByRole("button", { name: "Aplicar" }).waitFor();
    await page.locator('select[name="module"]').selectOption("CAPA");
    await page.locator('select[name="state"]').selectOption("OPEN");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await page.waitForURL(url => url.searchParams.get("module") === "CAPA" && url.searchParams.get("state") === "OPEN");
    await page.getByTestId("qms-dashboard").waitFor();
    assert.equal(await page.locator(".dashboard-module-row").count(), 1);
    assert.equal(await page.locator(".dashboard-pnt-line").count(), 0);
    const onlyRow = page.locator(".dashboard-module-row");
    assert.equal(Number(await onlyRow.locator(".dashboard-module-total").textContent()), await prisma.capa.count({ where: { qmsRecord: { isActive: true }, status: "OPEN" } }));
    // El histórico se consulta en Indicadores de cada módulo, enlazado desde su fila.
    assert.equal(await page.locator(".dashboard-trend-row").count(), 0);
    assert.equal(await onlyRow.getByRole("link", { name: "Indicadores", exact: true }).getAttribute("href"), "/capa/indicators?year=" + new Date().getUTCFullYear());
    await page.locator(".dashboard-module-row a").getByText("Abrir →").click();
    await page.waitForURL(url => url.pathname === "/capa" && url.searchParams.get("status") === "OPEN");

    await visit(page, "/?year=2100&module=DEVIATION");
    assert.equal(await page.locator(".dashboard-module-row").getByRole("link", { name: "Indicadores", exact: true }).getAttribute("href"), "/deviations/indicators?year=2100");
    const filtered = page.locator(".dashboard-module-row").first();
    assert.equal(Number(await filtered.locator(".dashboard-module-total").textContent()), await prisma.deviation.count({ where: { qmsRecord: { isActive: true, year: 2100 } } }), "Total de cohorte comparado con Prisma; no asumir años sin registros");

    await visit(page, "/?module=PNT");
    assert.equal(await page.locator(".dashboard-pnt-line").count(), 1);
    assert.equal(await page.locator(".dashboard-module-row").count(), 0);
    assert.equal(await page.getByRole("link", { name: "Indicadores", exact: true }).count(), 0);

    const captureDir = process.env.D1B_SCREENSHOT_DIR;
    if (captureDir) await mkdir(captureDir, { recursive: true });
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await visit(page, "/");
      const dimensions = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      assert(dimensions.scroll <= dimensions.viewport + 2, "Dashboard overflow at " + width + "px: " + JSON.stringify(dimensions));
      assert(await page.getByRole("button", { name: /^Filtros/ }).isVisible(), "Filters toggle hidden at " + width);
      await page.getByRole("button", { name: "Aplicar" }).waitFor();
      if (captureDir) await page.screenshot({ path: captureDir + "/dashboard-" + width + ".png", fullPage: true });
    }
    assert.deepEqual(errors, [], "Dashboard hydration or JavaScript errors");
    console.log("D1B Playwright OK: ocho módulos, recuentos independientes, filtros, drill-down, sin cobertura y 1440/768/390 sin hidratación.");
  } finally {
    await page.close();
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

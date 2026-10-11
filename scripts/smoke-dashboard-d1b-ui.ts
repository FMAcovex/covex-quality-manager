import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";
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
    case "CHANGE_CONTROL": return prisma.changeControl.count({ where: { qmsRecord: { isActive: true }, finalStatus: "OPEN" } });
    default: throw new Error("Unknown module");
  }
}

async function main() {
  if (process.env.APP_ENV !== "test" || !base) throw new Error("APP_ENV=test y D1B_UI_BASE_URL obligatorios.");
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Madrid" });
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
      ["RETURN", "Devoluciones"], ["AUDIT", "Auditorías"],
    ] as const) {
      const card = page.locator(".dashboard-module-card").filter({ has: page.locator(".dashboard-module-top").getByText(label, { exact: true }) });
      assert.equal(await card.count(), 1, module + " card count");
      const actual = Number(await card.locator(".dashboard-module-states strong").first().textContent());
      const expected = await countFor(module);
      assert.equal(actual, expected, module + ": opened count differs from independent Prisma count");
    }
    const masterCount = await prisma.controlledDocument.count({ where: { administrativeStatus: { not: "ANNULLED" } } });
    const pnt = page.locator(".dashboard-pnt-card");
    assert.equal(Number(await pnt.locator(".dashboard-module-top strong").textContent()), masterCount);
    assert.equal(await page.locator(".dashboard-module-card").count(), 7);
    console.log("D1B: seis cohortes activas vs Prisma y maestros PNT distintos; render " + (Date.now() - start) + "ms.");

    const links = page.locator(".dashboard-task-table tbody a");
    for (const href of await links.evaluateAll(nodes => nodes.map(node => node.getAttribute("href")))) {
      assert(href?.startsWith("/") && !href.startsWith("//"), "No se permite enlace de tarea externo: " + href);
    }

    // Filtering must be server-side; no URL state left only in client memory.
    await page.locator('select[name="module"]').selectOption("CAPA");
    await page.locator('select[name="state"]').selectOption("OPEN");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await page.waitForURL(url => url.searchParams.get("module") === "CAPA" && url.searchParams.get("state") === "OPEN");
    await page.getByTestId("qms-dashboard").waitFor();
    assert.equal(await page.locator(".dashboard-module-card").count(), 1);
    assert.equal(await page.locator(".dashboard-pnt-card").count(), 0);
    const onlyCard = page.locator(".dashboard-module-card");
    assert.equal(Number(await onlyCard.locator(".dashboard-module-top strong").textContent()), await prisma.capa.count({ where: { qmsRecord: { isActive: true }, status: "OPEN" } }));
    assert.equal(await page.locator(".dashboard-trend-row").count(), 5);
    await page.locator(".dashboard-module-card a").click();
    await page.waitForURL(url => url.pathname === "/capa" && url.searchParams.get("status") === "OPEN");

    await visit(page, "/?year=2099&module=DEVIATION");
    assert.equal(await page.locator(".dashboard-trend-row").count(), 5);
    const withoutCoverage = await page.locator(".dashboard-trend-row").allTextContents();
    assert(withoutCoverage.some(x => x.includes("Sin datos")), "Missing coverage must not render 0");
    const filtered = page.locator(".dashboard-module-card").first();
    assert.equal(Number(await filtered.locator(".dashboard-module-top strong").textContent()), 0);

    await visit(page, "/?module=PNT");
    assert.equal(await page.locator(".dashboard-pnt-card").count(), 1);
    assert.equal(await page.locator(".dashboard-module-card").count(), 1);
    assert.equal(await page.locator(".dashboard-trend-row").count(), 0);

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
      assert(await page.getByRole("button", { name: "Aplicar" }).isVisible(), "Filters hidden at " + width);
      if (captureDir) await page.screenshot({ path: captureDir + "/dashboard-" + width + ".png", fullPage: true });
    }
    assert.deepEqual(errors, [], "Dashboard hydration or JavaScript errors");
    console.log("D1B Playwright OK: siete módulos, recuentos independientes, filtros, drill-down, sin cobertura y 1440/768/390 sin hidratación.");
  } finally {
    await page.close();
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

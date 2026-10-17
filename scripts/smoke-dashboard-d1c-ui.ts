import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "./auth-fixtures/browser";
import { type Page } from "playwright";
import { prisma } from "../src/lib/db";

const base = process.env.D1C_UI_BASE_URL;
const captureDir = process.env.D1C_SCREENSHOT_DIR;
const fixtureIds: string[] = [];
const prefix = "DEMO-D1C-" + randomUUID().slice(0, 8);

async function visit(page: Page, path: string) {
  await page.goto(base + path);
  await page.getByTestId("qms-dashboard").waitFor();
  await page.waitForLoadState("networkidle");
}

async function createTaskFixtures() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // Disposable test records ensure both deadline states and pagination are exercised.
  for (let index = 0; index < 17; index++) {
    const due = new Date(today);
    due.setUTCDate(due.getUTCDate() + (index < 8 ? -index - 1 : index - 7));
    const record = await prisma.qmsRecord.create({ data: {
      recordType: "AUDIT", year: today.getUTCFullYear(), businessCode: `${prefix}-${index}`,
      audit: { create: {
        status: "OPEN", title: "Auditoría ficticia para validación visual D1C",
        auditType: "INTERNAL", scenario: "INTERNAL_COVEX",
        followups: { create: {
          followupDate: today, nextReviewDate: due, description: "Seguimiento de prueba D1C",
          completedByText: "Usuario demo D1C", createdByText: "Usuario demo D1C",
        } },
      } },
    } });
    fixtureIds.push(record.id);
  }
}

async function cleanup() {
  await prisma.auditFollowup.deleteMany({ where: { audit: { qmsRecordId: { in: fixtureIds } } } });
  await prisma.audit.deleteMany({ where: { qmsRecordId: { in: fixtureIds } } });
  await prisma.qmsRecord.deleteMany({ where: { id: { in: fixtureIds } } });
}

async function main() {
  if (process.env.APP_ENV !== "test" || !base) throw new Error("APP_ENV=test y D1C_UI_BASE_URL obligatorios; usar PostgreSQL de pruebas.");
  const browser = await chromium.launch({ args: ["--no-sandbox"], executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Madrid" });
  // Los filtros del panel están plegados por defecto; se abren como preferencia del navegador.
  await page.addInitScript(() => { try { localStorage.setItem("qms.filters.dashboard", "open"); } catch { /* sin almacenamiento */ } });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await createTaskFixtures();
    await visit(page, "/");
    const summary = await page.locator(".dashboard-attention-item > strong").allTextContents();
    const modules = await page.locator(".dashboard-module-row, .dashboard-pnt-line").allTextContents();
    const taskRows = await page.locator(".dashboard-task-row").allTextContents();
    assert.equal(summary.length, 4);
    assert.equal(modules.length, 8);
    assert(await page.locator(".is-overdue").count() > 0);

    if (captureDir) await mkdir(captureDir, { recursive: true });
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await visit(page, "/");
      assert.deepEqual(await page.locator(".dashboard-attention-item > strong").allTextContents(), summary, "KPI unchanged at " + width);
      assert.deepEqual(await page.locator(".dashboard-module-row, .dashboard-pnt-line").allTextContents(), modules, "Module counts unchanged at " + width);
      assert.deepEqual(await page.locator(".dashboard-task-row").allTextContents(), taskRows, "Tasks unchanged at " + width);
      const dimensions = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth, viewport: innerWidth,
        taskScroll: document.querySelector(".dashboard-task-table")!.scrollWidth,
        taskWidth: document.querySelector(".dashboard-task-table")!.clientWidth,
      }));
      assert(dimensions.scroll <= dimensions.viewport + 2, "Page overflow: " + JSON.stringify(dimensions));
      assert(dimensions.taskScroll <= dimensions.taskWidth + 2, "Task tray requires horizontal scrolling at " + width);
      await page.getByRole("button", { name: "Aplicar" }).waitFor();
      for (const element of await page.locator(".dashboard-filters .filter-panel input, .dashboard-filters .filter-panel select, .dashboard-filters .filter-actions > *").all()) {
        const box = await element.boundingBox();
        const isControl = await element.evaluate(node => node.matches("input, select"));
        assert(box && box.width >= (isControl ? 90 : 60) && box.height >= (width === 390 ? 44 : 38), "Unusable filter at " + width);
      }
      const row = page.locator(".dashboard-task-row").first();
      const record = await row.locator(".dashboard-task-record").boundingBox();
      const state = await row.locator(".dashboard-task-state").boundingBox();
      assert(record && state && record.x + record.width <= state.x + 1, "Record overlaps deadline status at " + width);
      await page.getByRole("button", { name: "Aplicar" }).focus();
      assert.equal(await page.getByRole("button", { name: "Aplicar" }).evaluate(element => getComputedStyle(element).outlineStyle), "solid");
      await page.getByRole("button", { name: "Aplicar" }).evaluate(element => (element as HTMLElement).blur());
      await page.evaluate(() => scrollTo(0, 0));
      if (captureDir) await page.screenshot({ path: `${captureDir}/dashboard-${width}.png`, fullPage: true });
    }

    // The mobile presentation must preserve usable task links and pagination filters.
    await visit(page, "/?module=AUDIT&tasks=upcoming");
    assert.equal(await page.locator(".is-overdue").count(), 0);
    assert(await page.locator(".is-upcoming").count() >= 9);
    await page.getByRole("button", { name: "Aplicar" }).waitFor();
    assert.equal(await page.locator(".dashboard-module-row").getByRole("link", { name: "Indicadores", exact: true }).count(), 0, "Auditorías no tiene pestaña de indicadores");
    await page.locator('select[name="tasks"]').selectOption("overdue");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await page.waitForURL(url => url.searchParams.get("tasks") === "overdue");
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator(".is-upcoming").count(), 0);
    assert(await page.locator(".is-overdue").count() >= 8);
    const taskLink = page.locator(".dashboard-task-record a").first();
    const taskHref = await taskLink.getAttribute("href");
    await taskLink.click();
    await page.waitForURL(url => url.pathname === taskHref);

    await visit(page, "/?module=AUDIT");
    await page.getByRole("link", { name: "Siguiente", exact: true }).click();
    await page.waitForURL(url => url.searchParams.get("page") === "2" && url.searchParams.get("module") === "AUDIT");
    await page.waitForLoadState("networkidle");
    assert(await page.locator(".dashboard-task-row").count() > 0);
    await page.getByRole("link", { name: "Anterior", exact: true }).click();
    await page.waitForURL(url => !url.searchParams.has("page") && url.searchParams.get("module") === "AUDIT");
    await page.getByRole("link", { name: "Limpiar", exact: true }).click();
    await page.waitForURL(url => url.pathname === "/" && !url.search);
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator(".dashboard-module-row").count(), 7);
    assert.deepEqual(errors, [], "Browser errors");
    console.log("D1C UI OK: unchanged KPI/modules/tasks, usable 1440/768/390 filters and task tray, keyboard focus, deadline filters, audit drill-down, pagination and reset.");
  } finally {
    await page.close();
    await browser.close();
    await cleanup();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

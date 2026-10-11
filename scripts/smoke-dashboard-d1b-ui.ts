import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.D1B_UI_BASE_URL;
const captures = process.env.D1B_CAPTURE_DIR;
async function main() {
  if (process.env.APP_ENV !== "test" || !base) throw Error("APP_ENV=test and D1B_UI_BASE_URL are required.");
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "Europe/Madrid" });
  const jsErrors: string[] = [];
  const timings: number[] = [];
  page.on("pageerror", e => jsErrors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && /hydrat|server rendered/i.test(m.text())) jsErrors.push(m.text()); });
  async function navigate(path: string) {
    const started = Date.now();
    await page.goto(base + path);
    await page.waitForLoadState("networkidle");
    timings.push(Date.now() - started);
  }
  try {
    await navigate("/");
    assert.equal(await page.getByRole("heading", { name: "Gestión del Sistema de Calidad" }).count(), 1);
    assert.equal(await page.locator(".dashboard-status-card").count(), 7);
    assert.equal(await page.locator(".dashboard-module-link").count(), 7);
    assert.equal(await page.getByRole("heading", { name: "Tareas del sistema" }).count(), 1);
    assert.equal(await page.getByRole("heading", { name: /Desviaciones · últimos cinco años/ }).count(), 1);
    assert.equal(await page.locator(".dashboard-trend-column").count(), 5);

    await page.getByRole("combobox", { name: "Módulo / tendencia" }).selectOption("CAPA");
    await page.getByRole("combobox", { name: "Bandeja de tareas" }).selectOption("overdue");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await page.waitForURL(/module=CAPA/);
    await page.waitForLoadState("networkidle");
    assert.equal(new URL(page.url()).searchParams.get("taskView"), "overdue");
    assert.equal(await page.getByRole("heading", { name: /CAPA · últimos cinco años/ }).count(), 1);
    assert.equal(await page.locator(".dashboard-status-card").count(), 7);

    await page.getByRole("combobox", { name: "Módulo / tendencia" }).selectOption("AUDIT");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await page.waitForURL(/module=AUDIT/);
    assert.match(await page.locator(".dashboard-trend-unavailable").textContent() ?? "", /No existe una serie quinquenal comparable/);

    await page.getByRole("combobox", { name: "Módulo / tendencia" }).selectOption("PNT");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await page.waitForURL(/module=PNT/);
    assert.equal(await page.locator(".dashboard-document-footnote").count(), 1);

    await page.getByRole("link", { name: "Limpiar" }).click();
    await page.waitForURL(url => url.pathname === "/" && url.search === "");
    assert.equal(await page.locator(".dashboard-status-card").count(), 7);

    if (captures) await mkdir(captures, { recursive: true });
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await navigate("/");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert(overflow <= 2, "Dashboard horizontal overflow at " + width + "px: " + overflow);
      assert.equal(await page.locator(".dashboard-status-card").count(), 7);
      if (captures) await page.screenshot({ path: captures + "/dashboard-" + width + ".png", fullPage: true });
    }
    assert.deepEqual(jsErrors, [], "No Next hydration/runtime errors");
    console.log("D1B UI OK: seven cards, filters, five-year coverage, audit/PNT unsupported-series disclaimer, responsive 1440/768/390.");
    console.log("D1B UI timings (ms): " + timings.join(", "));
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.D1B_UI_BASE_URL;
async function main() {
  if (!base || process.env.APP_ENV !== "test") throw new Error("APP_ENV=test y D1B_UI_BASE_URL obligatorios (BD aislada).");
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Madrid" });
  const clientErrors: string[] = [];
  page.on("pageerror", e => clientErrors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && /hydrat|server rendered/i.test(m.text())) clientErrors.push(m.text()); });
  try {
    await page.goto(base + "/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("heading", { name: "Centro de control de Calidad" }).waitFor();
    assert.equal(await page.locator(".dashboard-module-card").count(), 7, "Las tarjetas representan los siete módulos");
    assert.equal(await page.locator(".module-card").count(), 7, "Los accesos existentes siguen disponibles");
    assert(await page.getByText("Herramienta interna", { exact: false }).count(), "Advertencia de versión piloto conservada");
    const filters = page.locator("form.dashboard-filters");
    await filters.locator('select[name="module"]').selectOption("CAPA");
    await filters.getByRole("button", { name: "Aplicar" }).click();
    await page.waitForURL(url => url.searchParams.get("module") === "CAPA");
    await page.waitForLoadState("networkidle");
    assert.match((await page.getByRole("heading", { name: /Evolución histórica · CAPA/ }).textContent()) ?? "", /CAPA/);
    assert.equal(await filters.locator('select[name="module"]').inputValue(), "CAPA");

    await page.goto(base + "/?module=CAPA&year=2025");
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator('select[name="year"]').inputValue(), "2025", "El año seleccionado persiste en filtros");
    await page.locator('select[name="module"]').selectOption("PNT");
    await page.locator('form.dashboard-filters button[type="submit"]').click();
    await page.waitForURL(url => url.searchParams.get("module") === "PNT");
    await page.waitForLoadState("networkidle");
    assert(await page.getByText("Los PNT disponen de métricas de revisión actuales", { exact: false }).count(), "Sin inventar serie quinquenal PNT");
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 960 });
      await page.waitForTimeout(80);
      // Next.js can retain hidden prior route trees during client navigation.
      // Assert all seven CURRENT visible cards, never silently skip them.
      const visibleCards = page.locator(".dashboard-module-card:visible");
      assert.equal(await visibleCards.count(), 7, "Deben existir siete tarjetas visibles a " + width);
      for (const element of await visibleCards.all()) {
        const rect = await element.boundingBox();
        assert(rect && rect.x >= -1 && rect.x + rect.width <= width + 1, "Tarjeta visible fuera de viewport " + width);
      }
      const visibleSelects = page.locator(".dashboard-filters:visible select:visible");
      assert.equal(await visibleSelects.count(), 3, "Los tres filtros deben ser visibles a " + width);
      for (const element of await visibleSelects.all()) {
        const rect = await element.boundingBox();
        assert(rect && rect.x >= -1 && rect.x + rect.width <= width + 1, "Filtro visible fuera de viewport " + width);
      }
      assert.equal(await page.locator(".dashboard-task-table").count(), 1, "La bandeja permanece visible a " + width);
    }
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.locator(".dashboard-module-card").filter({ hasText: "CAPA" }).getByRole("link", { name: "Ver listado" }).click();
    await page.waitForURL(/\/capa(?:\?.*)?$/);
    assert.deepEqual(clientErrors, [], "Sin errores JS de hidratación o navegación");
    console.log("D1B Playwright OK: siete módulos, filtros por año y módulo, PNT sin histórico inventado, navegación y 1440/768/390 px.");
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

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
    await page.getByRole("heading", { name: "Panel de seguimiento" }).waitFor();
    assert.equal(await page.locator(".dashboard-module-tile").count(), 7, "Se muestran los siete módulos");
    assert.equal(await page.locator('.dashboard-module-tile[href="/controlled-documents"]').count(),1, "PNT visible");
    assert.equal(await page.locator(".module-card").count(),7,"Accesos históricos conservados");
    assert(await page.getByText("Herramienta interna", { exact: false }).count(),"Aviso piloto conservado");
    const filter = page.getByRole("form", { name: "Filtros del dashboard" });
    await filter.locator('select[name="module"]').selectOption("CAPA");
    await filter.locator('input[name="year"]').fill("2025");
    await filter.getByRole("button", { name: "Aplicar" }).click();
    await page.waitForURL(url => url.searchParams.get("module") === "CAPA" && url.searchParams.get("year") === "2025");
    await page.waitForLoadState("networkidle");
    assert.match((await page.getByRole("heading", {name:/Tendencia a cinco años/}).textContent())||"", /CAPA/);
    assert.equal(await page.locator('.dashboard-filters select[name="module"]').inputValue(),"CAPA");
    assert.equal(await page.locator('.dashboard-filters input[name="year"]').inputValue(),"2025");
    await page.locator('.dashboard-filters select[name="module"]').selectOption("PNT");
    await page.locator('.dashboard-filters button[type="submit"]').click();
    await page.waitForURL(url => url.searchParams.get("module") === "PNT");
    assert(await page.getByText("no existe aún una serie histórica", { exact:false }).count(),"Sin tendencias inventadas para PNT");
    for (const width of [1440,768,390]) {
      await page.setViewportSize({ width, height: 960 });
      await page.waitForTimeout(80);
      for (const item of await page.locator(".dashboard-module-tile").all()) {
        const rect = await item.boundingBox();
        assert(rect && rect.x >= -1 && rect.x + rect.width <= width + 1,"Tarjeta fuera del viewport " + width);
      }
      for (const item of await page.locator(".dashboard-filters input, .dashboard-filters select").all()) {
        const rect = await item.boundingBox();
        assert(rect && rect.x >= -1 && rect.x + rect.width <= width + 1,"Filtro fuera del viewport " + width);
      }
    }
    await page.setViewportSize({width:1440,height:960});
    await page.locator('.dashboard-module-tile[href="/capa"]').click();
    await page.waitForURL(/\/capa(?:\?.*)?$/);
    assert.deepEqual(clientErrors, [], "Sin errores de hidratación/navegación");
    console.log("D1B Playwright OK: 7 módulos, filtros/año, ausencia de series falsas, accesos y 1440/768/390px.");
  } finally {
    await browser.close();
  }
}
main().catch(e => {console.error(e);process.exitCode=1;});

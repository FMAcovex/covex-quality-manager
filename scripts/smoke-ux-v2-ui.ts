import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { isolatedTestEnvironment, authConfiguration } from "../src/lib/auth/config";
import { chromium, authenticatedPage } from "./auth-fixtures/browser";
import type { Page } from "playwright";

// D-111 (V2): índice lateral de apartados en los formularios de alta y edición.
async function main() {
  assert(isolatedTestEnvironment(), "Exclusivamente base sintética aislada");
  const base = authConfiguration().origin, marker = "UXV2-" + randomUUID().slice(0, 8);
  const department = await prisma.department.findFirstOrThrow({ orderBy: { code: "asc" } });
  const deviation = await prisma.deviation.create({ data: { department: { connect: { id: department.id } }, qmsRecord: { create: { recordType: "DEVIATION", businessCode: `${marker}-DEV`, year: 2026 } }, createdByText: "Autor sintético UX", status: "OPEN", whatHappened: marker } });
  const browser = await chromium.launch({ headless: true });
  const page = await authenticatedPage(browser);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const visit = async (p: Page, path: string) => { const response = await p.goto(base + path); assert(response?.ok(), path); await p.locator("main h1").first().waitFor(); };
  const links = () => page.locator("nav.section-index a");
  try {
    await visit(page, `/deviations/${deviation.id}/edit`);
    await links().filter({ hasText: "E. Investigación" }).first().waitFor();
    await links().filter({ hasText: "E. Investigación" }).first().click();
    const heading = page.locator("section.form-section h2", { hasText: "E. Investigación" }).first();
    await page.waitForFunction(() => { const h = [...document.querySelectorAll("section.form-section h2")].find(e => e.textContent?.includes("E. Investigación")); const y = h?.getBoundingClientRect().y ?? -1; return y >= 0 && y <= 400; });
    const box = (await heading.boundingBox())!;
    assert(box.y >= 0 && box.y <= 400, `El apartado pulsado queda a la vista (y=${box.y})`);
    assert(await page.locator("nav.section-index").isVisible(), "El índice sigue visible tras desplazarse");
    assert.match(page.url(), /#apartado-e-investigacion$/);

    for (const path of ["/deviations/new", "/capa/new", "/changes/new", "/complaints/new", "/returns/new", "/oos/new", "/audits/new", "/controlled-documents/new"]) {
      await visit(page, path);
      await links().first().waitFor({ timeout: 10000 }).catch(() => { throw new Error(`${path}: sin índice lateral`); });
      assert(await links().count() >= 2, `${path}: al menos 2 apartados en el índice`);
    }

    // Tras un error de servidor el formulario se vuelve a pintar: el índice no duplica entradas ni ids.
    await visit(page, "/audits/new");
    await links().first().waitFor();
    const before = await links().count();
    await page.locator('select[name="auditType"]').selectOption("INTERNAL");
    await page.locator('select[name="scenario"]').selectOption("INTERNAL_COVEX");
    await page.locator('select[name="status"]').selectOption("OPEN");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Guardar auditoría", exact: true }).click();
    await page.locator(".form-errors").first().waitFor();
    assert.equal(await links().count(), before, "Mismo número de apartados tras el error");
    const hrefs = await links().evaluateAll(as => as.map(a => a.getAttribute("href")));
    assert.equal(new Set(hrefs).size, hrefs.length, "Anclas únicas");
    // Tras el error el formulario se monta de nuevo: el apartado activo sigue cambiando al desplazarse.
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(400);
    const top = await page.locator('nav.section-index a[aria-current]').textContent();
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(600);
    assert.notEqual(await page.locator('nav.section-index a[aria-current]').textContent(), top, "El apartado activo cambia tras el error");

    // Los apartados ocultos (Devolución sin frío, OOS sin Fase II) no aparecen en el índice.
    await visit(page, "/returns/new"); await links().first().waitFor();
    assert.equal(await links().filter({ hasText: "Productos termolábiles" }).count(), 0, "Devolución: sin el apartado oculto de frío");
    await visit(page, "/oos/new"); await links().first().waitFor();
    assert.equal(await links().filter({ hasText: "Fase II" }).count(), 0, "OOS: sin el apartado oculto de Fase II");

    // Antes de hidratar el índice está oculto (sin apartados): el formulario debe ocupar ya su columna, no la estrecha.
    await visit(page, `/deviations/${deviation.id}/edit`); await links().first().waitFor();
    const width = await page.evaluate(() => { const nav = document.querySelector<HTMLElement>("nav.section-index")!; nav.hidden = true; return document.querySelector(".form-with-index-body")!.getBoundingClientRect().width; });
    assert(width > 700, `Formulario a su ancho con el índice aún oculto (${width}px)`);

    await page.setViewportSize({ width: 390, height: 844 });
    await visit(page, `/deviations/${deviation.id}/edit`);
    assert.equal(await page.locator("nav.section-index").isVisible(), false, "Sin índice en móvil");
    assert.deepEqual(errors, []);
    console.log("UX V2 OK: índice lateral en 8 formularios, salto al apartado, sin duplicados tras error, oculto en móvil.");
  } finally {
    await browser.close();
  }
}
main().finally(() => prisma.$disconnect()).catch(e => { console.error(e); process.exitCode = 1; });

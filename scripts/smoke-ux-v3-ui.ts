import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { isolatedTestEnvironment, authConfiguration } from "../src/lib/auth/config";
import { chromium, authenticatedPage } from "./auth-fixtures/browser";
import type { Page } from "playwright";

// D-111 (V3): pestaña única «Desviación» con sus apartados y compatibilidad con los enlaces antiguos.
async function main() {
  assert(isolatedTestEnvironment(), "Exclusivamente base sintética aislada");
  const base = authConfiguration().origin, marker = "UXV3-" + randomUUID().slice(0, 8);
  const department = await prisma.department.findFirstOrThrow({ orderBy: { code: "asc" } });
  const deviation = await prisma.deviation.create({ data: { department: { connect: { id: department.id } }, qmsRecord: { create: { recordType: "DEVIATION", businessCode: `${marker}-DEV`, year: 2026 } }, createdByText: "Autor sintético UX", status: "OPEN", whatHappened: marker, rootCause: "Causa raíz sintética" } });
  const thread = await prisma.reviewThread.create({ data: { qmsRecordId: deviation.qmsRecordId, targetKind: "FIELD", tabKey: "investigation", sectionKey: "root-cause", fieldPath: "rootCause", fieldLabelSnapshot: "Causa raíz", createdByText: "Revisor sintético", messages: { create: { message: marker + " · revisar causa", createdByText: "Revisor sintético" } } } });
  const browser = await chromium.launch({ headless: true });
  const page = await authenticatedPage(browser);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const visit = async (p: Page, path: string) => { const response = await p.goto(base + path); assert(response?.ok(), path); await p.locator("main h1").first().waitFor(); };
  const path = `/deviations/${deviation.id}`;
  try {
    await visit(page, path);
    const tabs = await page.locator("nav.record-tabs a").allTextContents();
    assert.equal(tabs.length, 9, `9 pestañas (${tabs.join(", ")})`);
    assert(tabs.includes("Desviación"), "Pestaña «Desviación»");
    for (const old of ["Descripción", "Investigación", "Acciones", "Conclusión"]) assert(!tabs.includes(old), `Sin la pestaña «${old}»`);

    await visit(page, `${path}?tab=deviation`);
    assert.deepEqual(await page.locator("h2.deviation-part-title").allTextContents(), ["Descripción", "Investigación", "Acciones", "Conclusión"]);
    const cards = await page.locator("#deviation-parts h2").allTextContents();
    for (const title of ["Descripción del evento", "Causa raíz", "Evaluación de impacto", "Acciones inmediatas", "CAPA propuestas", "Conclusión y disposición"]) assert(cards.some(c => c.includes(title)), `Tarjeta «${title}»`);
    await page.locator("nav.section-index a").first().waitFor();
    assert.equal(await page.locator("nav.section-index a").count(), 4, "Índice con los 4 apartados");

    // Enlace antiguo: muestra «Desviación» y baja al apartado.
    await visit(page, `${path}?tab=investigation`);
    assert.equal(await page.locator("nav.record-tabs a.active").textContent(), "Desviación");
    await page.waitForFunction(() => { const y = document.getElementById("desviacion-investigacion")?.getBoundingClientRect().y ?? -1; return y >= 0 && y < 400; });

    // Comentario de revisión guardado con la clave antigua: se abre sin bucles y señala la causa raíz.
    await visit(page, `${path}?tab=investigation&review=1&thread=${thread.id}#review-deviation-root-cause`);
    await page.waitForTimeout(1500);
    assert.match(page.url(), /tab=investigation/, "Sin recargas en bucle");
    assert.equal(await page.locator("nav.record-tabs a.active").textContent(), "Desviación");
    assert(await page.locator("#review-deviation-root-cause").isVisible(), "La causa raíz comentada está a la vista");
    assert.deepEqual(errors, []);
    console.log("UX V3 OK: pestaña «Desviación» con 4 apartados, enlaces antiguos y comentarios de revisión compatibles.");
  } finally {
    await browser.close();
  }
}
main().finally(() => prisma.$disconnect()).catch(e => { console.error(e); process.exitCode = 1; });

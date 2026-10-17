import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { type Page } from "playwright";
import { chromium } from "./auth-fixtures/browser";
import { prisma } from "../src/lib/db";

// D-088, OOS-1/OOS-2: alta, apertura, Fase I → Fase II, cierre, relaciones y Review desde la interfaz real.
const base = process.env.OOS_UI_BASE_URL;
const marker = `OOS-UI-${randomUUID()}`;
const ids: string[] = [];
const targets: string[] = [];

async function view(page: Page, path: string) {
  await page.goto(`${base}${path}`);
  await page.waitForLoadState("networkidle");
}

async function save(page: Page, label: string, id?: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForURL(id ? new RegExp(`/oos/${id}$`) : /\/oos\/[0-9a-f-]{36}$/, { timeout: 30000 });
  await page.waitForLoadState("networkidle");
}

async function fill(page: Page, values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) await page.locator(`[name="${name}"]`).fill(value);
}

async function main() {
  if (process.env.APP_ENV !== "test" || !base) throw new Error("APP_ENV=test y OOS_UI_BASE_URL son obligatorios.");
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Madrid" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && /hydrat|server rendered/i.test(message.text())) errors.push(message.text()); });
  try {
    // Borrador sin código.
    await view(page, "/oos/new");
    await fill(page, { materialName: marker, issueDate: "2096-03-10" });
    await save(page, "Guardar borrador");
    const draft = await prisma.oosRecord.findFirstOrThrow({ where: { materialName: marker }, include: { qmsRecord: true } });
    ids.push(draft.qmsRecordId);
    assert.equal(draft.status, "DRAFT");
    assert.equal(draft.qmsRecord.businessCode, null);

    // Apertura: los datos iniciales pasan a ser obligatorios (también en servidor, ver validation.test.ts) y se asigna OOS/MD/ZZZ/2096.
    await view(page, `/oos/${draft.id}/edit`);
    await page.locator('[name="status"]').selectOption("OPEN");
    for (const name of ["area", "departmentId", "materialKind", "materialName", "lotNumber", "detectionDescription"]) {
      assert.equal(await page.locator(`[name="${name}"]`).evaluate((element) => (element as HTMLInputElement).required), true, name);
    }
    await page.locator('[name="area"]').selectOption("MD");
    await page.locator('[name="departmentId"]').selectOption({ index: 1 });
    await page.locator('[name="materialKind"]').selectOption("RAW_OR_PACKAGING_MATERIAL");
    await fill(page, { lotNumber: "LOTE-OOS-UI", supplier: "Proveedor ficticio", supplierLot: "PV-01", oosDate: "2096-03-09", oosTime: "10:30", detectionDescription: "Valoración fuera de especificación (dato ficticio).", "evaluation.methodCorrect": "Conforme", "evaluation.microNegativeControl": "No aplica" });
    await page.locator('[name="status"]').selectOption("OPEN");
    await save(page, "Guardar cambios", draft.id);
    const opened = await prisma.oosRecord.findUniqueOrThrow({ where: { id: draft.id }, include: { qmsRecord: true } });
    assert.equal(opened.status, "OPEN");
    assert.match(opened.qmsRecord.businessCode ?? "", /^OOS\/MD\/\d{3}\/2096$/);
    assert.deepEqual(opened.phaseIEvaluation, { methodCorrect: "Conforme", microNegativeControl: "No aplica" });
    assert.equal(opened.supplier, "Proveedor ficticio");
    await page.getByText(opened.qmsRecord.businessCode!, { exact: true }).first().waitFor();

    // La Fase II solo aparece con disposición «a gran escala»; se cierra como no concluyente.
    await view(page, `/oos/${draft.id}/edit`);
    assert.equal(await page.locator('[name="phaseIIConclusion"]').isVisible(), false);
    assert.equal(await page.locator('select[name="area"]').isDisabled(), true);
    await fill(page, { phaseIInvestigation: "Sin error de laboratorio.", phaseIConclusion: "No se confirma error de laboratorio." });
    await page.locator('[name="phaseIDisposition"]').selectOption("FULL_SCALE");
    assert.equal(await page.locator('[name="phaseIIConclusion"]').isVisible(), true);
    await fill(page, { phaseIIProductionReview: "Revisión de la fabricación (dato ficticio).", phaseIIConclusion: "No se identifica causa raíz única.", phaseIIIssuedBy: "Garantía de Calidad ficticia", phaseIIIssuedAt: "2096-03-20", closedAt: "2096-03-20", changeReason: "Cierre de la investigación" });
    await page.locator('[name="phaseIIVerdict"]').selectOption("REJECTED");
    await page.locator('[name="investigationResult"]').selectOption("INCONCLUSIVE");
    await page.locator('[name="status"]').selectOption("CLOSED");
    await save(page, "Guardar cambios", draft.id);
    const closed = await prisma.oosRecord.findUniqueOrThrow({ where: { id: draft.id }, include: { qmsRecord: { include: { history: true } } } });
    assert.equal(closed.status, "CLOSED");
    assert.equal(closed.investigationResult, "INCONCLUSIVE");
    assert.equal(closed.qmsRecord.businessCode, opened.qmsRecord.businessCode);
    assert.deepEqual(closed.qmsRecord.history.map((item) => item.fieldPath).sort(), ["__created__", "__edit__", "__edit__"]);

    // OOS-2: vincular una CAPA operativa desde la pestaña Relaciones; la CAPA muestra el OOS de origen en solo lectura.
    const capa = await prisma.qmsRecord.create({ data: { recordType: "CAPA", businessCode: `CA-${marker}`, year: 2096, capa: { create: { actionType: "CORRECTIVE" } } }, include: { capa: true } });
    targets.push(capa.id);
    await view(page, `/oos/${draft.id}?tab=relations`);
    await page.locator('select[name="recordType"]').selectOption("CAPA");
    await page.locator('input[name="businessCode"]').fill(`CA-${marker}`);
    await page.getByRole("option", { name: new RegExp(`CA-${marker}`) }).click();
    await page.getByRole("button", { name: "Vincular expediente", exact: true }).click();
    await page.getByText("vinculada correctamente").waitFor();
    const relation = await prisma.qmsRelation.findFirstOrThrow({ where: { sourceRecordId: draft.qmsRecordId, targetRecordId: capa.id, isActive: true } });
    assert.equal(relation.relationType, "GENERATES");
    assert.equal(await prisma.changeHistory.count({ where: { qmsRecordId: draft.qmsRecordId, fieldPath: "relations" } }), 1);
    await view(page, `/capa/${capa.capa!.id}?tab=relations`);
    await page.getByRole("link", { name: opened.qmsRecord.businessCode!, exact: true }).first().waitFor();
    await view(page, `/oos?q=${encodeURIComponent(`CA-${marker}`)}`);
    await page.getByRole("link", { name: opened.qmsRecord.businessCode!, exact: true }).waitFor();

    // Review: observación sobre la conclusión de la Fase II, sin versión funcional asociada.
    await view(page, `/oos/${draft.id}?tab=phase-ii&review=1`);
    await page.locator("#review-oos-phase-ii-conclusion .review-marker").click();
    const drawer = page.locator(".review-drawer");
    await drawer.locator(".review-form textarea").last().fill(`Review ${marker}`);
    await drawer.getByRole("button", { name: "Crear observación", exact: true }).click();
    await drawer.locator(".review-thread-card").filter({ hasText: `Review ${marker}` }).waitFor();
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    const thread = await prisma.reviewThread.findFirstOrThrow({ where: { qmsRecordId: draft.qmsRecordId } });
    assert.equal(thread.recordVersionId, null);
    assert.deepEqual([thread.tabKey, thread.fieldPath], ["phase-ii", "phaseIIConclusion"]);
    await view(page, `/oos/${draft.id}?tab=review&review=1`);
    await page.locator(".review-thread-card").filter({ hasText: `Review ${marker}` }).getByRole("link", { name: "Ir al campo", exact: true }).click();
    await page.locator("#review-oos-phase-ii-conclusion.review-target-highlight").waitFor();

    // Desvincular conserva la relación inactiva y la CAPA deja de mostrar el origen.
    await view(page, `/oos/${draft.id}?tab=relations`);
    await page.getByRole("button", { name: "Desvincular", exact: true }).click();
    await page.getByRole("button", { name: "Desvincular", exact: true }).waitFor({ state: "detached" });
    assert.equal((await prisma.qmsRelation.findUniqueOrThrow({ where: { id: relation.id } })).isActive, false);
    await view(page, `/capa/${capa.capa!.id}?tab=relations`);
    assert.equal(await page.getByRole("link", { name: opened.qmsRecord.businessCode!, exact: true }).count(), 0);

    // Ficha, pestañas, listado y buscador global.
    for (const tab of ["summary", "phase-i", "phase-ii", "relations", "review", "timeline", "audit-trail", "history"]) {
      await view(page, `/oos/${draft.id}?tab=${tab}`);
      assert.equal(await page.locator(".record-tabs a.active").count(), 1, tab);
    }
    await view(page, `/oos?q=${encodeURIComponent(marker)}&phase=II&result=INCONCLUSIVE`);
    await page.getByRole("link", { name: opened.qmsRecord.businessCode!, exact: true }).waitFor();
    await view(page, `/search?q=${encodeURIComponent(opened.qmsRecord.businessCode!)}`);
    await page.getByText(opened.qmsRecord.businessCode!).first().waitFor();

    for (const width of [768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/oos", `/oos/${draft.id}`, `/oos/${draft.id}/edit`]) {
        await view(page, path);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${path} desborda a ${width}px`);
      }
    }
    assert.deepEqual(errors, []);
    console.log(`OOS UI OK: borrador sin código, apertura con datos iniciales obligatorios y ${opened.qmsRecord.businessCode}, Fase I → Fase II, cierre no concluyente, vínculo y desvinculación de CAPA con origen visible en la CAPA, observación de Review sin versión, pestañas, listado, buscador y 1440/768/390 sin desbordes.`);
  } finally {
    await browser.close();
    await prisma.reviewMessage.deleteMany({ where: { reviewThread: { qmsRecordId: { in: ids } } } });
    await prisma.reviewThread.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.qmsRelation.deleteMany({ where: { sourceRecordId: { in: ids } } });
    await prisma.changeHistory.deleteMany({ where: { qmsRecordId: { in: targets } } });
    await prisma.capa.deleteMany({ where: { qmsRecordId: { in: targets } } });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: targets } } });
    await prisma.changeHistory.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.oosRecord.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
  }
}

main().finally(() => prisma.$disconnect()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

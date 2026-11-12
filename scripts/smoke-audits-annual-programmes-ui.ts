import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { assertCorporateActor, chromium } from "./auth-fixtures/browser";
import { type Page } from "playwright";
import { prisma } from "../src/lib/db";
import { createAnnualPlan, addPlanEntry } from "../src/modules/audits/plans";
import { syntheticAnnexVProgramme } from "./audits-annual-programme-fixtures";
import { programmeDocumentTypes } from "../src/modules/audits/annual-programme/domain";
const base = process.env.ANNUAL_UI_BASE_URL;
async function submit(page: Page, name: string) {
  const response = page.waitForResponse(r => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]));
  await page.getByRole("button", { name, exact: true }).click();
  assert.equal((await response).status(), 200);
  // Each caller asserts the relevant UI state (status, link or error).
  // Do not block on unrelated background requests.
}
async function main() {
  if (!base || process.env.APP_ENV !== "test") throw Error("Smoke UI de programas requiere APP_ENV=test y ANNUAL_UI_BASE_URL.");
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", ...(process.env.ANNUAL_CHROMIUM_ARGS || "").split(",").filter(Boolean)], ...(process.env.ANNUAL_CHROMIUM_PATH ? { executablePath: process.env.ANNUAL_CHROMIUM_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  try {
    for (const internal of [true, false]) {
      const type = internal ? "INTERNAL" : "EXTERNAL", suffix = randomUUID().slice(0, 8), actor = "QA navegador ficticio";
      // D-135 (R6): Anexo V ficticio; se desactiva al terminar para no quedar vigente en otras ejecuciones.
      let templateId: string | null = null;
      if (process.env.ANNUAL_OFFICIAL_TEMPLATES !== "1") {
        const b = syntheticAnnexVProgramme(internal);
        const used = new Set((await prisma.templateVersion.findMany({ where: { module: "AUDIT", documentType: programmeDocumentTypes[type] }, select: { versionCode: true } })).map(t => t.versionCode));
        const versionCode = Array.from({ length: 90 }, (_, i) => `GC-${10 + i}-0${internal ? 33 : 34}-05-ANEXO-V`).find(c => !used.has(c))!;
        templateId = (await prisma.templateVersion.create({ data: { module: "AUDIT", documentType: programmeDocumentTypes[type], versionCode, effectiveFrom: new Date("2026-10-11"), checksum: createHash("sha256").update(b).digest("hex"), fileData: new Uint8Array(b), fileSize: b.length } })).id;
      }
      try {
      const occupied = await prisma.auditAnnualPlan.findMany({ where: { auditType: type }, select: { year: true } });
      const year = Array.from({ length: 101 }, (_, i) => 2100 - i).find(y => !occupied.some(p => p.year === y))!;
      const plan = await createAnnualPlan({ year, auditType: type, title: `Programa UI ${suffix}`, notes: "Ficticio", actor });
      const { entry } = await addPlanEntry(plan.id, { subject: "Objeto UI ficticio", targetName: "Entidad UI ficticia", departmentId: "", plannedDate: "", notes: "", actor, reason: "" });
      await page.goto(`${base}/audits/plans/${plan.id}`, { waitUntil: "domcontentloaded" });
      const first = "Emitir versión 00 del programa", next = "Nueva versión 01 del programa";
      await page.getByRole("button", { name: first }).waitFor({ state: "visible" });
      assert(await page.getByRole("button", { name: first }).isDisabled());
      await page.getByText("Firmantes del programa", { exact: true }).click();
      const approval = page.locator('form').filter({ has: page.getByRole("button", { name: "Guardar firmantes del programa" }) });
      // El Anexo V solo lleva «Elaborado por» y «Aprobado por»: no se pide el aprobador técnico.
      assert.equal(await approval.locator('[name="technicalApproverName"]').count(), 0);
      await approval.locator('[name="preparedByName"]').fill("Técnica QA ficticia");
      await approval.locator('[name="qualityApproverName"]').fill("Calidad QA ficticia");
      await assertCorporateActor(approval.locator('[name="actor"]')); await approval.locator('[name="reason"]').fill("Preparación QA");
      await submit(page, "Guardar firmantes del programa");
      await page.getByRole("status").filter({ hasText: "guardados" }).waitFor({ state: "visible" });
      await page.getByText("Editar planificación", { exact: true }).click();
      const edit = page.locator('form').filter({ has: page.getByRole("button", { name: "Guardar cambios", exact: true }) });
      await edit.locator('[name="plannedPeriodText"]').fill("Primer trimestre"); await edit.locator('[name="plannedAuditorsText"]').fill("Auditor UI ficticio");
      if (!internal) { await edit.locator('[name="programmeArea"]').fill("Calidad"); await edit.locator('[name="productService"]').fill("Servicio QA"); await edit.locator('[name="plannedScope"]').fill("Alcance QA"); await edit.locator('[name="plannedModality"]').selectOption("REMOTE"); }
      await assertCorporateActor(edit.locator('[name="actor"]')); await edit.locator('[name="reason"]').fill("Completar planificación documental");
      const post = page.waitForResponse(r => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]));
      await page.getByRole("button", { name: "Guardar cambios", exact: true }).click(); assert([200, 303].includes((await post).status()));
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByText("Primer trimestre", { exact: true }).first().waitFor({ state: "visible" });
      const issue = page.locator('form').filter({ has: page.getByRole("button", { name: first }) });
      assert(!(await page.getByRole("button", { name: first }).isDisabled()));
      await assertCorporateActor(issue.locator('[name="actor"]'));
      await submit(page, first);
      await page.getByRole("link", { name: /Descargar .*R00.docx/ }).waitFor();
      const version = await prisma.auditAnnualProgrammeVersion.findFirstOrThrow({ where: { planId: plan.id, sequenceNumber: 0 }, omit: { fileData: false } });
      const url: string = `${base}/api/audits/plans/${plan.id}/programmes/${version.id}`;
      const download = await page.request.get(url); assert.equal(download.status(), 200); assert.deepEqual(await download.body(), Buffer.from(version.fileData));
      assert.equal((await page.request.get(`${base}/api/audits/plans/${randomUUID()}/programmes/${version.id}`)).status(), 404);
      assert.equal(await prisma.auditAnnualProgrammeVersion.count({ where: { planId: plan.id } }), 1);
      // Submit a real stale browser preview; the action must return an inline error without issuing.
      const stale = page.locator('form').filter({ has: page.getByRole("button", { name: next }) });
      await assertCorporateActor(stale.locator('[name="actor"]')); await stale.locator('[name="reason"]').fill("Vista obsoleta QA");
      await prisma.auditPlanEntry.update({ where: { id: entry.id }, data: { notes: "Cambio posterior QA" } });
      await submit(page, next);
      await page.getByRole("alert").filter({ hasText: "cambiado" }).waitFor({ state: "visible" });
      assert.equal(await prisma.auditAnnualProgrammeVersion.count({ where: { planId: plan.id } }), 1);
      // Verify the updated server preview after reload instead of waiting for all
      // background network activity to become idle.
      await page.reload({ waitUntil: "domcontentloaded" });
      // D-135: antes de la nueva versión se ve qué cambia respecto a la anterior.
      await page.getByText("Cambios respecto a la versión 00:", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
      assert(await page.getByText("Entidad UI ficticia: comentarios", { exact: false }).first().isVisible());
      const subsequent = page.locator('form').filter({ has: page.getByRole("button", { name: next }) });
      assert.equal(await subsequent.locator('[name="reason"]').getAttribute("required"), "");
      await assertCorporateActor(subsequent.locator('[name="actor"]')); await subsequent.locator('[name="reason"]').fill("Cambio documentado QA");
      await submit(page, next);
      await page.getByRole("link", { name: /Descargar .*R01.docx/ }).waitFor();
      assert.deepEqual(await (await page.request.get(url)).body(), Buffer.from(version.fileData));
      for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: 950 });
        assert(await page.getByRole("heading", { name: "Programa Anual · versiones" }).isVisible());
        if (process.env.ANNUAL_UI_CAPTURE_DIR) { await mkdir(process.env.ANNUAL_UI_CAPTURE_DIR, { recursive: true }); await page.screenshot({ path: `${process.env.ANNUAL_UI_CAPTURE_DIR}/${type}-${width}.png`, fullPage: true }); }
      }
      await page.getByRole("link", { name: "← Planes anuales" }).click(); await page.waitForURL(/\/audits\/plans$/);
      console.log(`OK UI ${type}: firmantes del Anexo V, bloqueos, versión 00, vista obsoleta, cambios, nueva versión con motivo, descargas históricas, 1440/768/390 y retorno.`);
      } finally {
        if (templateId) await prisma.templateVersion.update({ where: { id: templateId }, data: { isActive: false } });
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
main().finally(() => prisma.$disconnect()).catch(e => { console.error(e); process.exitCode = 1; });

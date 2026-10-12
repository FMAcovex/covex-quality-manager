import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { isolatedTestEnvironment, authConfiguration } from "../src/lib/auth/config";
import { chromium, authenticatedPage, authenticateContext, assertCorporateActor, capabilityPage } from "./auth-fixtures/browser";
import { fixtureUsers } from "./auth-fixtures/constants";
import type { AccessModule } from "../src/lib/auth/context";
import type { Page } from "playwright";

const modules = ["DEVIATION", "CAPA", "CHANGE_CONTROL", "COMPLAINT", "RETURN", "AUDIT", "PNT"] as const;
const paths = ["deviations", "capa", "changes", "complaints", "returns", "audits", "controlled-documents"];
const tabs = ["summary", "information", "general", "followups", "followup", "findings", "relations", "report", "documents", "versions", "revisions", "verification", "review", "history"];
type RecordFixture = { id: string; module: AccessModule; path: string; departmentId: string; qmsRecordId?: string; revisionId?: string };
async function main() {
  assert(isolatedTestEnvironment(), "Exclusivamente base sintética aislada");
  const base = authConfiguration().origin, marker = "UI4B1-" + randomUUID().slice(0, 8);
  const departments = await prisma.department.findMany({ orderBy: { code: "asc" }, take: 2 });
  assert.equal(departments.length, 2);
  await prisma.authUserDepartment.upsert({ where: { userId_departmentId: { userId: fixtureUsers.manager.id, departmentId: departments[0].id } }, create: { userId: fixtureUsers.manager.id, departmentId: departments[0].id }, update: {} });
  const records: RecordFixture[] = [];
  for (let i = 0; i < modules.length; i++) for (const department of departments) {
    const accessModule = modules[i], path = paths[i];
    const common = { department: { connect: { id: department.id } }, qmsRecord: { create: { recordType: accessModule as "DEVIATION", businessCode: `${marker}-${accessModule}-${department.code}`, year: 2026 } } };
    let row: { id: string; qmsRecordId?: string; revisions?: { id: string }[] };
    if (accessModule === "DEVIATION") row = await prisma.deviation.create({ data: { ...common, createdByText: "Autor histórico sintético", status: "OPEN", whatHappened: marker } });
    else if (accessModule === "CAPA") row = await prisma.capa.create({ data: { ...common, createdByText: "Autor histórico sintético", status: "OPEN", actionType: "CORRECTIVE", defectDescription: marker } });
    else if (accessModule === "CHANGE_CONTROL") row = await prisma.changeControl.create({ data: { ...common, finalStatus: "OPEN", description: marker } });
    else if (accessModule === "COMPLAINT") row = await prisma.complaint.create({ data: { ...common, createdByText: "Autor histórico sintético", status: "OPEN", complaintType: "CUSTOMER", description: marker } });
    else if (accessModule === "RETURN") row = await prisma.returnRecord.create({ data: { ...common, createdByText: "Autor histórico sintético", status: "OPEN", returnType: "COMMERCIAL" } });
    else if (accessModule === "AUDIT") row = await prisma.audit.create({ data: { qmsRecord: common.qmsRecord, status: "OPEN", auditType: "INTERNAL", scenario: "INTERNAL_COVEX", title: marker, scope: marker, createdByText: "Autor histórico sintético", codingDepartment: { connect: { id: department.id } }, departments: { create: { departmentId: department.id, departmentCodeSnapshot: department.code, departmentNameSnapshot: department.name } } } });
    else {
      let baseCode = "";
      for (let n = 999; n >= 900; n--) { const candidate = `${department.code}/${n}`; if (!await prisma.controlledDocument.findUnique({ where: { baseCode: candidate } })) { baseCode = candidate; break; } }
      assert(baseCode, "Código sintético PNT libre y compatible con sus restricciones");
      row = await prisma.controlledDocument.create({ data: { departmentId: department.id, departmentCodeSnapshot: department.code, departmentNameSnapshot: department.name, title: marker, baseCode, administrativeStatus: "ACTIVE", createdByText: "Autor histórico sintético", revisions: { create: { revisionCode: "00", baseCodeSnapshot: baseCode, titleSnapshot: marker, departmentCodeSnapshot: department.code, departmentNameSnapshot: department.name, registeredByText: "Firmante histórico externo" } } }, include: { revisions: { select: { id: true } } } });
    }
    records.push({ ...row, module: accessModule, path, departmentId: department.id, revisionId: row.revisions?.[0].id });
  }
  const deviation = records[0];
  const thread = await prisma.reviewThread.create({ data: { qmsRecordId: deviation.qmsRecordId!, targetKind: "SECTION", tabKey: "summary", sectionKey: "summary", fieldLabelSnapshot: "Observación sintética existente", createdByText: "Revisor histórico", messages: { create: { message: marker + " · comentario conservado", createdByText: "Revisor histórico" } } } });
  const browser = await chromium.launch({ headless: true });
  const reader = await authenticatedPage(browser, "reader"), qa = await authenticatedPage(browser), manager = await authenticatedPage(browser, "manager");
  const errors: string[] = [];
  for (const page of [reader, qa, manager]) { page.setDefaultTimeout(15000); page.on("pageerror", e => errors.push(e.message)); }
  async function visit(page: Page, path: string) { const response = await page.goto(base + path); assert(response?.ok(), path); await page.locator("main h1").first().waitFor(); }
  async function readOnly(page: Page) {
    assert.equal(await page.locator('main a[href*="/new"], main a[href*="/edit"], main input[data-reminder-record], main input[data-reminder-select-all]').count(), 0, "Consulta sin acceso a formularios ni selección para modificar");
    assert.equal(await page.locator('main form:has(input[name="_covexCsrf"])').count(), 0, "Consulta sin formularios de mutación");
    assert.equal(await page.getByRole("button", { name: /Anular expediente|Reactivar expediente|Cerrar auditoría|Guardar|Registrar documento|Añadir comentario|Preparar correo/ }).count(), 0);
    assert.equal(await page.locator('a[href="/settings"], a[href="/settings/users"]').count(), 0);
  }
  try {
    for (let i = 0; i < modules.length; i++) {
      const path = paths[i], pair = records.filter(r => r.module === modules[i]);
      await visit(reader, `/${path}?q=${marker}`); await readOnly(reader);
      for (const record of pair) assert.equal(await reader.locator(`main a[href^="/${path}/${record.id}"]`).count() > 0, true, "Consulta global de ambos departamentos: " + path);
      const initialResponse = await reader.request.get(`${base}/${path}?q=${marker}`);
      assert(initialResponse.ok());
      const initialHtml = (await initialResponse.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
      assert(initialHtml.includes(pair[0].id), "El HTML inicial contiene consulta ordinaria");
      assert.equal(/<a\b[^>]*href=["'][^"']*\/(?:new|edit)(?:[?"'])/.test(initialHtml), false, "El HTML inicial ya excluye los enlaces de modificación");
      assert.equal(initialHtml.includes('data-reminder-record="true"'), false, "El HTML inicial excluye selección para seguimientos");
      await visit(qa, `/${path}`); assert(await qa.locator(`main a[href^="/${path}/new"]`).count() > 0, "Alta autorizada: " + path);
      await visit(reader, `/${path}/new`); await reader.getByRole("heading", { name: "Acceso no permitido" }).waitFor(); await readOnly(reader);
      await visit(qa, `/${path}/new`); assert.equal(await qa.getByRole("heading", { name: "Acceso no permitido" }).count(), 0);
      for (const record of pair) {
        await visit(reader, `/${path}/${record.id}`); await readOnly(reader);
        for (const tab of tabs.filter(t => modules[i] === "PNT" ? ["information", "revisions", "documents", "verification", "history"].includes(t) : ["followups", "followup", "relations", "report", "documents", "versions", "review", "history"].includes(t))) { await visit(reader, `/${path}/${record.id}?tab=${tab}&review=1`); await readOnly(reader); }
        await visit(reader, `/${path}/${record.id}/edit`); await reader.getByRole("heading", { name: "Acceso no permitido" }).waitFor(); await readOnly(reader);
        await visit(qa, `/${path}/${record.id}`); assert(await qa.locator(`main a[href*="/${record.id}/edit"]`).count() > 0, "Edición autorizada: " + path);
        await visit(manager, `/${path}/${record.id}`);
        assert.equal(await manager.locator(`main a[href*="/${record.id}/edit"]`).count() > 0, record.departmentId === departments[0].id, "Ámbito real del expediente: " + path);
        await visit(manager, `/${path}/${record.id}/edit`);
        assert.equal(await manager.getByRole("heading", { name: "Acceso no permitido" }).count() > 0, record.departmentId !== departments[0].id, "Acceso directo según ámbito: " + path);
      }
      console.log("Consulta global, SSR, permisos y ámbito OK: " + modules[i]);
    }
    await visit(reader, `/deviations/${deviation.id}?tab=review&thread=${thread.id}`);
    await reader.getByText(marker + " · comentario conservado", { exact: true }).first().waitFor(); await readOnly(reader);
    await reader.getByRole("complementary", { name: "Panel de revisión" }).getByRole("button", { name: "Cerrar", exact: true }).click();
    await reader.getByRole("button", { name: "Ver hilo", exact: true }).first().click(); await reader.getByRole("complementary", { name: "Panel de revisión" }).waitFor(); await readOnly(reader);
    const pnt = records.find(r => r.module === "PNT")!;
    const bytes = Buffer.from("%PDF-1.4\nDocumento sintético de permisos\n%%EOF\n");
    const documentId = randomUUID();
    const document = await prisma.controlledRevisionDocument.create({ data: { id: documentId, revision: { connect: { documentId_id: { documentId: pnt.id, id: pnt.revisionId! } } }, originalName: marker + ".pdf", kind: "DOCUMENT_PDF", state: "RECORDED_UNVERIFIED", mimeType: "application/pdf", sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), fileData: bytes, storageReference: "postgres:" + documentId, incorporatedBy: "Autor histórico externo", identitySource: "CORPORATE_SESSION" } });
    await visit(reader, `/controlled-documents/${pnt.id}?tab=documents`); await readOnly(reader);
    const download = `/api/controlled-documents/${pnt.id}/revisions/${pnt.revisionId}/documents/${document.id}`;
    assert.equal(await reader.locator(`a[href="${download}"]`).count(), 1, "Consulta con DOWNLOAD conserva los documentos históricos");
    const downloaded = await reader.request.get(base + download); assert(downloaded.ok()); assert.deepEqual(await downloaded.body(), bytes);
    const withoutDownload = await capabilityPage(browser, []);
    try { await visit(withoutDownload, `/controlled-documents/${pnt.id}?tab=documents`); await readOnly(withoutDownload); assert.equal(await withoutDownload.locator(`a[href="${download}"]`).count(), 0); assert.equal((await withoutDownload.request.get(base + download)).status(), 403); }
    finally { await withoutDownload.close(); }
    const writer = await authenticatedPage(browser, "documentWriter");
    try { await visit(writer, `/controlled-documents/${pnt.id}?tab=documents`); assert(await writer.getByRole("button", { name: "Añadir documento", exact: true }).count() > 0); assert.equal(await writer.locator(`a[href*="/${pnt.id}/edit"]`).count(), 0, "Adjuntar documentos no concede edición del maestro"); }
    finally { await writer.close(); }
    for (const suffix of ["revisions/new", `revisions/${pnt.revisionId}/edit`]) { await visit(reader, `/controlled-documents/${pnt.id}/${suffix}`); await reader.getByRole("heading", { name: "Acceso no permitido" }).waitFor(); }
    await visit(reader, "/controlled-documents/import-index"); await reader.getByRole("heading", { name: "Acceso no permitido" }).waitFor();
    const foreign = records.find(r => r.module === "DEVIATION" && r.departmentId === departments[1].id)!;
    await prisma.authRecordAssignment.create({ data: { userId: fixtureUsers.manager.id, module: "DEVIATION", recordId: foreign.qmsRecordId! } });
    await authenticateContext(manager.context(), "manager"); await visit(manager, `/deviations/${foreign.id}`); assert(await manager.locator(`main a[href*="/${foreign.id}/edit"]`).count() > 0, "Asignación explícita permite acción en otro departamento");
    const audit = records.find(r => r.module === "AUDIT" && r.departmentId === departments[0].id)!;
    await prisma.auditDepartment.create({ data: { auditId: audit.id, departmentId: departments[1].id, departmentCodeSnapshot: departments[1].code, departmentNameSnapshot: departments[1].name } });
    await visit(manager, `/audits/${audit.id}`); assert.equal(await manager.locator(`main a[href*="/${audit.id}/edit"]`).count(), 0, "Auditoría con varios departamentos exige todo el ámbito");
    await visit(qa, "/deviations/new");
    await qa.locator('select[name="departmentId"]').selectOption(departments[0].id);
    assert.equal(await qa.locator('input[name="createdByText"]').inputValue(), fixtureUsers.qa.name);
    await qa.getByRole("button", { name: "Guardar borrador", exact: true }).click(); await qa.waitForURL(/\/deviations\/[a-f0-9-]{36}/);
    const createdId = new URL(qa.url()).pathname.split("/")[2];
    assert.equal((await prisma.deviation.findUniqueOrThrow({ where: { id: createdId } })).createdByText, fixtureUsers.qa.name, "Guardado real con identidad de sesión");
    await visit(qa, `/audits/${audit.id}/edit`); await assertCorporateActor(qa.getByLabel("Realizado por", { exact: true }));
    const admin = await authenticatedPage(browser, "admin");
    try { await visit(admin, "/settings"); assert.equal(await admin.locator('a[href="/settings/users"]').count(), 1); await visit(admin, "/settings/catalogs"); assert.equal(await admin.locator('main form:has(input[name="_covexCsrf"]), main summary:has-text("Nuevo departamento")').count(), 0, "Administrar usuarios no concede administración GMP"); }
    finally { await admin.close(); }
    assert.deepEqual(errors, []);
    console.log("4B1 permisos UI OK: siete módulos, consulta global sin mutaciones, acceso directo, SSR, ámbitos/asignaciones, auditoría multidepartamental, revisión histórica de consulta y guardado autorizado con identidad corporativa.");
  } finally {
    await prisma.authRecordAssignment.deleteMany({ where: { userId: fixtureUsers.manager.id, recordId: foreignRecordId(records, departments[1].id) } });
    await browser.close(); await prisma.$disconnect();
  }
}
function foreignRecordId(records: RecordFixture[], departmentId: string) { return records.find(r => r.module === "DEVIATION" && r.departmentId === departmentId)!.qmsRecordId!; }
main().catch(error => { console.error(error); process.exitCode = 1; });

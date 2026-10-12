import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { assertCorporateActor, chromium, authenticateContext, capabilityPage } from "./auth-fixtures/browser";
import type { AccessPermission } from "../src/lib/auth/context";
import { type Page } from "playwright";
import { prisma } from "../src/lib/db";
import { lifecyclePermissions } from "../src/modules/controlled-documents/lifecycle/access";
import { permissions, type LifecycleCommand } from "../src/modules/controlled-documents/lifecycle/domain";
import { qaOnly, freeCode, workbook, pdf, word, today, offset, evidence, manualMaster, command, nextRevision } from "../src/modules/controlled-documents/testing/p2c";
const base = process.env.P2C_UI_BASE_URL || "http://127.0.0.1:3000", actor = "P2C UI QA", reason = "P2C UI motivo confidencial sintético";
async function waitServer(page: Page) { for (let i = 0; i < 60; i++) { try { if ((await page.request.get(base)).ok()) return; } catch {} await new Promise(resolve => setTimeout(resolve, 1000)); } throw new Error("Servidor P2C no disponible"); }
async function upload(page: Page, id: string, revisionId: string) {
  const url = `${base}/controlled-documents/${id}?tab=documents`; await page.goto(url);
  const article = page.locator(`article[data-revision-id="${revisionId}"]`);
  for (const [kind, name, buffer, mimeType] of [["WORKING_WORD", "p2c-ui.docx", word, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], ["DOCUMENT_PDF", "p2c-ui-document.pdf", pdf, "application/pdf"], ["EXTERNAL_SIGNED_PDF", "p2c-ui-signed.pdf", pdf, "application/pdf"], ["APPROVAL_EVIDENCE", "p2c-ui-evidence.pdf", pdf, "application/pdf"]] as const) {
    await article.getByLabel("Tipo documental", { exact: true }).selectOption(kind);
    await article.getByLabel("Archivo documental", { exact: true }).setInputFiles({ name, mimeType, buffer });
    const navigation = page.waitForNavigation(); await article.getByRole("button", { name: "Añadir documento", exact: true }).click(); await navigation;
    await article.getByRole("link", { name: `Descargar ${name}`, exact: true }).waitFor();
  }
  await article.getByLabel("Soporte", { exact: true }).selectOption("reference");
  await article.getByLabel("Tipo documental", { exact: true }).selectOption("ANNEX");
  await article.getByLabel("Nombre de referencia", { exact: true }).fill("P2C UI SharePoint sintético");
  await article.getByLabel("URL documental HTTPS", { exact: true }).fill("https://example.invalid/sharepoint/pnt");
  const navigation = page.waitForNavigation(); await article.getByRole("button", { name: "Añadir documento", exact: true }).click(); await navigation;
  const files = await prisma.controlledRevisionDocument.findMany({ where: { revisionId } }); assert.equal(files.length, 5);
  assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: revisionId } })).verificationStatus, "UNVERIFIED");
  const f = files.find(d => d.kind === "EXTERNAL_SIGNED_PDF")!;
  const download = await page.request.get(`${base}/api/controlled-documents/${id}/revisions/${revisionId}/documents/${f.id}`);
  assert.deepEqual(await download.body(), pdf); assert.equal(createHash("sha256").update(await download.body()).digest("hex"), f.sha256);
}
async function cycle(page: Page, id: string, revisionId: string) {
  await page.goto(`${base}/controlled-documents/${id}?tab=verification`);
  const article = page.locator(`article[data-lifecycle-revision="${revisionId}"]`);
  async function submit(operation: string, fill?: () => Promise<void>) {
    await article.getByLabel("Operación", { exact: true }).selectOption(operation);
    for (const box of await article.locator('input[name="evidenceIds"]').all()) await box.check();
    await article.locator('textarea[name="reason"]').fill(reason); await article.locator('textarea[name="notes"]').fill("Contraste humano UI P2C; no firma electrónica");
    await article.locator('textarea[name="referenceBasis"]').fill("Referencia sintética humanamente contrastada, no custodiada");
    if (fill) await fill();
    const response = page.waitForResponse(r => r.url().endsWith(`/revisions/${revisionId}/lifecycle`) && r.request().method() === "POST");
    const navigation = page.waitForNavigation(); await article.locator(".pnt-lifecycle-form button").click(); const res = await response;
    if (res.status() !== 201) throw new Error(`P2C UI decisión: ${await res.text()}`);
    await navigation; await article.getByLabel("Operación", { exact: true }).waitFor();
    return (await prisma.controlledRevisionDecision.findFirstOrThrow({ where: { revisionId }, orderBy: { sequence: "desc" } })).id;
  }
  await submit("VERIFY");
  for (const role of ["PREPARATION", "REVIEW"]) {
    const registration = await submit("REGISTER_EXTERNAL", async () => { await article.locator('select[name="function"]').selectOption(role); await article.locator('input[name="externalPerson"]').fill(`P2C UI ${role}`); await article.locator('input[name="responsibility"]').fill("Responsable sección QA"); await article.locator('textarea[name="authorityBasis"]').fill("Designación sintética según PNT"); await article.locator('input[name="accreditedDate"]').fill(today); });
    await submit("CONTRAST_EXTERNAL", async () => { await article.locator('select[name="registrationId"]').selectOption(registration); });
  }
  await submit("SUBMIT");
  const registration = await submit("REGISTER_EXTERNAL", async () => { await article.locator('input[name="externalPerson"]').fill("P2C UI APPROVAL"); await article.locator('input[name="responsibility"]').fill("Garantía de Calidad QA"); await article.locator('textarea[name="authorityBasis"]').fill("Designación sintética según PNT"); await article.locator('input[name="accreditedDate"]').fill(today); });
  await submit("CONTRAST_EXTERNAL", async () => { await article.locator('select[name="registrationId"]').selectOption(registration); });
  await submit("PLAN", async () => { await article.locator('select[name="finalDocumentId"]').selectOption({ label: "p2c-ui-signed.pdf" }); await article.locator('input[name="effectiveFrom"]').fill(today); await article.locator('input[name="reviewDueAt"]').fill(offset(365)); await article.locator('input[name="separationConfirmed"]').check(); });
  await submit("ACTIVATE"); assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: revisionId } })).status, "IN_FORCE");
}
async function authenticated(page: Page) {
  const secret = process.env.PNT_DOCUMENT_PROXY_SECRET!;
  const headers = (capabilities: string) => ({ "x-pnt-proxy-secret": secret, "x-pnt-user": "P2C proxy autenticado", "x-pnt-permissions": `read,${capabilities}` });
  const browser = page.context().browser()!, reader = await browser.newPage({ extraHTTPHeaders: headers("") });
  await authenticateContext(reader.context(), "reader"); await page.context().clearCookies();
  const persisted = await prisma.controlledDocument.findFirstOrThrow({ where: { revisions: { some: { documents: { some: { originalName: "p2c-ui-signed.pdf" } } } } }, orderBy: { createdAt: "desc" }, include: { revisions: { orderBy: { revisionCode: "desc" }, include: { documents: true } } } });
  const revision = persisted.revisions[0], file = revision.documents.find(d => d.kind === "EXTERNAL_SIGNED_PDF")!;
  const fileUrl = `${base}/api/controlled-documents/${persisted.id}/revisions/${revision.id}/documents/${file.id}`;
  assert.deepEqual(await (await reader.request.get(fileUrl)).body(), pdf); assert.equal((await page.request.get(fileUrl)).status(), 401);
  for (const tab of ["documents", "verification", "history", "information", "revisions"]) {
    await reader.goto(`${base}/controlled-documents/${persisted.id}?tab=${tab}`); await reader.locator("main h2").first().waitFor();
    await page.goto(`${base}/controlled-documents/${persisted.id}?tab=${tab}`);
    await page.waitForURL(/\/login/);
    for (const privateValue of [file.id, file.sha256!, reason, "P2C UI APPROVAL", "example.invalid/sharepoint/pnt"]) assert.equal((await page.content()).includes(privateValue), false, `filtración ${tab}: ${privateValue}`);
    if (tab === "history") { await reader.getByRole("heading", { name: "Decisión documental P2B", exact: true }).first().waitFor(); await reader.getByText(reason, { exact: true }).first().waitFor(); }
  }
  const m = (await manualMaster()).master, r = m.revisions[0], docs = await evidence(m.id, r.id), ids = docs.map(d => d.id);
  const writer = await browser.newPage({ extraHTTPHeaders: headers("write") });
  await authenticateContext(writer.context(), "documentWriter");
  await writer.goto(`${base}/controlled-documents/${m.id}?tab=documents`); await writer.getByRole("button", { name: "Añadir documento", exact: true }).waitFor();
  await reader.goto(`${base}/controlled-documents/${m.id}?tab=documents`); await reader.getByRole("heading", { name: "Documentos por revisión", exact: true }).waitFor(); assert.equal(await reader.getByRole("button", { name: "Añadir documento", exact: true }).count(), 0);
  async function execute(extra: Partial<LifecycleCommand>) {
    const c = await command(m.id, r.id, ids, extra), cap = permissions[c.operation], endpoint = `${base}/api/controlled-documents/${m.id}/revisions/${r.id}/lifecycle`;
    const count = await prisma.controlledRevisionDecision.count({ where: { revisionId: r.id } });
    await writer.goto(`${base}/controlled-documents/${m.id}?tab=verification`); await writer.getByText("Sin operaciones autorizadas en este estado.", { exact: true }).waitFor();
    assert.equal(await writer.locator(".pnt-lifecycle-form button").count(), 0);
    assert.equal((await page.request.post(endpoint, { headers: { origin: base }, data: c })).status(), 401);
    assert.equal((await writer.request.post(endpoint, { headers: { origin: base }, data: c })).ok(), false);
    assert.equal(await prisma.controlledRevisionDecision.count({ where: { revisionId: r.id } }), count);
    const authorized = await capabilityPage(browser, [("PNT_" + cap.replaceAll("-", "_").toUpperCase()) as AccessPermission]);
    try {
      await authorized.goto(`${base}/controlled-documents/${m.id}?tab=verification`);
      const article = authorized.locator(`article[data-lifecycle-revision="${r.id}"]`); await article.getByLabel("Operación", { exact: true }).waitFor();
      const available = await article.getByLabel("Operación", { exact: true }).locator("option").evaluateAll(options => options.map(o => (o as HTMLOptionElement).value));
      assert.ok(available.includes(c.operation)); for (const operation of available) assert.equal(permissions[operation as keyof typeof permissions], cap);
      const res = await authorized.request.post(endpoint, { headers: { origin: base }, data: c }); assert.equal(res.status(), 201, await res.text()); return (await res.json()).id as string;
    } finally { await authorized.close(); }
  }
  const verified = await execute({ operation: "VERIFY", result: "FAVORABLE" });
  for (const role of ["PREPARATION", "REVIEW"] as const) { const id = await execute({ operation: "REGISTER_EXTERNAL", function: role, externalPerson: `P2C authenticated ${role}`, responsibility: "Sección QA", authorityBasis: "Designación QA sintética", accreditedDate: today }); await execute({ operation: "CONTRAST_EXTERNAL", registrationId: id, result: "ACCEPTED" }); }
  await execute({ operation: "SUBMIT" });
  const approval = await execute({ operation: "REGISTER_EXTERNAL", function: "APPROVAL", externalPerson: "P2C authenticated APPROVAL", responsibility: "GC QA", authorityBasis: "Designación QA sintética", accreditedDate: today });
  await execute({ operation: "CONTRAST_EXTERNAL", registrationId: approval, result: "ACCEPTED" });
  await execute({ operation: "PLAN", finalDocumentId: docs[2].id, effectiveFrom: today, reviewDueAt: offset(365), separationConfirmed: true });
  await execute({ operation: "ACTIVATE", previousRevisionId: null }); await execute({ operation: "RETIRE" }); await execute({ operation: "RECTIFY", rectifiesId: verified });
  assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } })).status, "OBSOLETE");
  const legacyCode = await freeCode();
  const legacy = await capabilityPage(browser, ["CREATE", "PNT_LEGACY_REGISTER"]);
  async function historicalForm(target: Page, forge = false) {
    await target.goto(`${base}/controlled-documents/new`);
    for (const [label, value] of [["Código base", legacyCode], ["Título", "P2C registro histórico sintético"], ["Revisión explícita", "00"], ["Responsable del registro", "Nombre escrito no autenticado"], ["Motivo del registro o cambio", "Registro histórico QA contrastado"], ["Fecha de vigencia", offset(-30)], ["Fecha prevista de revisión", offset(365)], ["Referencia documental", "Fuente histórica sintética contrastada"]]) { const field = target.getByLabel(label, { exact: true }); if (label === "Responsable del registro") await assertCorporateActor(field); else await field.fill(value); }
    await target.getByLabel(/^Departamento responsable/).selectOption((await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } })).id);
    if (forge) {
      assert.equal(await target.getByRole("checkbox", { name: "Registrar revisión documental ya existente", exact: true }).count(), 0);
      await target.locator("form.form-stack").evaluate(form => {
        for (const name of ["existingDocument", "verified"]) { const field = document.createElement("input"); field.type = "hidden"; field.name = name; field.value = "on"; form.appendChild(field); }
      });
    } else {
      await target.getByRole("checkbox", { name: "Registrar revisión documental ya existente", exact: true }).check();
      await target.getByRole("checkbox", { name: "He contrastado la revisión y su estado con la fuente documental", exact: true }).check();
    }
    await target.getByRole("button", { name: "Registrar PNT", exact: true }).click();
  }
  const creatorWithoutLegacy = await capabilityPage(browser, ["CREATE"]);
  await historicalForm(creatorWithoutLegacy, true); await creatorWithoutLegacy.getByRole("alert").filter({ hasText: "legacy-register" }).waitFor(); assert.equal(await prisma.controlledDocument.count({ where: { baseCode: legacyCode } }), 0);
  await creatorWithoutLegacy.close();
  await historicalForm(legacy); await legacy.waitForURL(/controlled-documents\/[a-f0-9-]+$/);
  const historical = await prisma.controlledDocument.findUniqueOrThrow({ where: { baseCode: legacyCode }, include: { revisions: true } });
  assert.equal(historical.createdByText, "Usuario sintético de capacidad 4B1"); assert.equal(historical.revisions[0].verifiedByText, "Usuario sintético de capacidad 4B1"); assert.equal(await prisma.controlledRevisionLifecycle.count({ where: { documentId: historical.id } }), 0);
  await legacy.close();
  assert.ok(lifecyclePermissions.includes("manage-state"), "La gestión manual de estados requiere una capacidad independiente.");
   assert.deepEqual(lifecyclePermissions.filter(p => p !== "legacy-register" && p !== "manage-state").sort(), [...new Set(Object.values(permissions))].sort());
  await writer.close(); await reader.close();
  console.log("P2C Chromium reinicio OK: descarga persistente íntegra, lectura autenticada, anónimos sin metadatos indirectos en cinco pestañas; capacidades UI/servidor separadas y flujo completo proxy, retirada/rectificación sin reactivación; legacy-register denegado/permitido mediante UI y Server Actions, actor autenticado.");
}
async function main() {
  qaOnly(); const browser = await chromium.launch({ headless: true }), page = await browser.newPage(); page.setDefaultTimeout(20000);
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  try {
    await waitServer(page); if (process.env.P2C_VERIFY_RESTART === "true") { await authenticated(page); assert.deepEqual(errors, []); return; }
    const code = await freeCode(), bytes = workbook(code), gc = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });
    await page.goto(`${base}/controlled-documents/import-index`);
    await page.getByLabel("Excel del índice maestro", { exact: true }).setInputFiles({ name: "p2c-ui.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: bytes });
    await page.getByRole("button", { name: "Analizar Excel", exact: true }).click(); await page.getByRole("heading", { name: "Resumen", exact: true }).waitFor();
    await assertCorporateActor(page.getByLabel("Responsable del lote", { exact: true })); await page.getByRole("button", { name: "Guardar previsualización como lote pendiente", exact: true }).click(); await page.waitForURL(/\/import-index\/[a-f0-9-]{36}$/);
    const batchId = page.url().split("/").pop()!; await page.getByLabel("Buscar candidatos", { exact: true }).fill(code);
    const candidate = page.locator("article.form-section").first();
    await candidate.getByLabel(/^Correspondencia de departamento/).selectOption(gc.id); await candidate.getByLabel(/^Decisión de la fila/).selectOption("INCLUDE"); await candidate.getByLabel(/^Alcance de la decisión/).selectOption("GROUP");
    await candidate.getByLabel("Motivo y resolución de incidencias", { exact: true }).fill("P2C elección explícita de primera procedencia; descartar discrepante"); await candidate.getByRole("checkbox").check();
    await candidate.getByRole("button", { name: "Guardar decisión", exact: true }).click(); await candidate.getByText(/Decidido por/).waitFor();
    await page.getByRole("button", { name: "Revisar propuesta de importación", exact: true }).click(); await page.getByRole("heading", { name: "Confirmación explícita", exact: true }).waitFor();
    await page.getByRole("checkbox", { name: "Confirmo expresamente esta propuesta y únicamente sus filas elegibles.", exact: true }).check(); await page.getByRole("button", { name: "Confirmar importación", exact: true }).click(); await candidate.getByText(/Resultado: CREATED/).waitFor();
    assert.equal((await prisma.controlledDocumentImportBatch.findUniqueOrThrow({ where: { id: batchId } })).state, "PARTIAL");
    const imported = await prisma.controlledDocument.findUniqueOrThrow({ where: { baseCode: code }, include: { revisions: true } });
    await candidate.getByRole("link", { name: "Consultar PNT", exact: true }).click(); await page.getByRole("heading", { level: 1 }).waitFor();
    const manualCode = await freeCode(); await page.goto(`${base}/controlled-documents/new`);
    for (const [label, value] of [["Código base", manualCode], ["Título", "P2C UI manual sin Excel"], ["Revisión explícita", "00"], ["Responsable del registro", actor], ["Motivo del registro o cambio", "Alta sintética P2C por navegador"], ["Fecha de vigencia", offset(30)], ["Fecha prevista de revisión", offset(365)]]) { const field = page.getByLabel(label, { exact: true }); if (label === "Responsable del registro") await assertCorporateActor(field); else await field.fill(value); }
    await page.getByLabel(/^Departamento responsable/).selectOption(gc.id); await page.getByRole("button", { name: "Registrar PNT", exact: true }).click(); await page.waitForURL(/controlled-documents\/[a-f0-9-]+$/);
    const manual = await prisma.controlledDocument.findUniqueOrThrow({ where: { baseCode: manualCode }, include: { revisions: true } });
    for (const master of [imported, manual]) {
      const r = master.revisions[0], frozen = JSON.stringify([r.sourceMetadata, r.baseCodeSnapshot, r.effectiveFrom, r.reviewDueAt]);
      await upload(page, master.id, r.id); await cycle(page, master.id, r.id);
      const after = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } }); assert.equal(JSON.stringify([after.sourceMetadata, after.baseCodeSnapshot, after.effectiveFrom, after.reviewDueAt]), frozen);
    }
    await page.goto(`${base}/controlled-documents/${manual.id}/edit`);
    const evolvedTitle = "P2C UI título B para nueva revisión";
    await page.getByLabel("Título", { exact: true }).fill(evolvedTitle); await assertCorporateActor(page.getByLabel("Responsable del registro", { exact: true }));
    await page.getByLabel("Motivo del registro o cambio", { exact: true }).fill("Evolución legítima hacia revisión 01 sin reescribir 00");
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click(); await page.waitForURL(`${base}/controlled-documents/${manual.id}`);
    assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: manual.revisions[0].id } })).titleSnapshot, manual.title);
    const next = await nextRevision(manual.id, manual.revisions[0].id);
    assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: next } })).titleSnapshot, evolvedTitle);
    await upload(page, manual.id, next); await cycle(page, manual.id, next);
    assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: manual.revisions[0].id } })).status, "OBSOLETE"); assert.equal(await prisma.controlledDocumentRevision.count({ where: { documentId: manual.id, status: "IN_FORCE" } }), 1);
    assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: manual.revisions[0].id } })).titleSnapshot, manual.title);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const tab of ["information", "revisions", "documents", "verification", "history"]) { await page.goto(`${base}/controlled-documents/${manual.id}?tab=${tab}`); await page.locator("main h2").first().waitFor(); assert.ok(await page.locator("main").isVisible()); }
      await page.goto(`${base}/controlled-documents/${manual.id}?tab=documents`); assert.deepEqual(await page.locator("article[data-revision-id] > h3").allTextContents(), ["Revisión 01", "Revisión 00"]);
      await page.goto(`${base}/controlled-documents?validity=current&revision=01&q=${encodeURIComponent(manualCode)}`); await page.getByRole("link", { name: manualCode, exact: true }).first().waitFor();
      await page.goto(`${base}/controlled-documents/import-index/${batchId}`); await page.getByRole("heading", { name: "Conciliación del lote", exact: true }).waitFor();
      await page.goto(`${base}/controlled-documents/import-index`); await page.getByLabel("Excel del índice maestro", { exact: true }).waitFor();
      await page.goto(`${base}/controlled-documents/new`); await page.getByLabel("Código base", { exact: true }).waitFor();
    }
    assert.deepEqual(errors, []);
    console.log("P2C Chromium OK: índice→lote parcial→documentos→vigencia íntegramente por UI; manual sin Excel, revisión 01/00 y obsolescencia, snapshots originales, descargas SHA, cinco pestañas/listado/conciliación/registro escritorio-móvil; sin errores de hidratación.");
  } catch (e) { console.error("P2C UI diagnóstico", page.url(), (await page.locator("main").innerText()).slice(0, 1600)); throw e; }
  finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());

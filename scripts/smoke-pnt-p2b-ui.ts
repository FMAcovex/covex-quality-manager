import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { prisma } from "../src/lib/db";
const base = process.env.P2B_UI_BASE_URL || "http://127.0.0.1:3000";
const today = new Date().toISOString().slice(0, 10), due = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
const pdf = Buffer.from("%PDF-1.4\nSynthetic P2B browser document\n%%EOF");
async function main() {
  if (process.env.APP_ENV !== "test") throw new Error("APP_ENV=test requerido.");
  const browser = await chromium.launch({ headless: true });
  try {
    if (process.env.P2B_VERIFY_ACCESS === "true") {
      const m = await prisma.controlledDocument.findFirstOrThrow({ where: { createdByText: "P2B UI QA" }, orderBy: { createdAt: "desc" }, include: { revisions: { include: { decisions: true } } } });
      const secret = process.env.PNT_DOCUMENT_PROXY_SECRET!, h = { "x-pnt-proxy-secret": secret, "x-pnt-user": "Lector QA autenticado", "x-pnt-permissions": "read" };
      const reader = await browser.newPage({ extraHTTPHeaders: h }), denied = await browser.newPage();
      await reader.goto(`${base}/controlled-documents/${m.id}?tab=verification`); await reader.getByRole("heading", { name: "Verificación y aprobaciones", exact: true }).waitFor();
      for (const detail of await reader.locator("article[data-lifecycle-revision] > details").all()) await detail.locator(":scope > summary").click();
      assert.ok((await reader.locator("body").innerText()).includes("Persona aprobación UI")); assert.equal(await reader.locator(".pnt-lifecycle-form button").count(), 0);
      await denied.goto(`${base}/controlled-documents/${m.id}?tab=verification`); await denied.getByRole("alert").filter({ hasText: "Acceso documental no autorizado" }).waitFor();
      assert.equal((await denied.content()).includes("Persona aprobación UI"), false);
      await denied.goto(`${base}/controlled-documents/${m.id}?tab=history`); await denied.getByRole("heading", { name: "Historial operativo" }).waitFor();
      assert.equal((await denied.locator("body").innerText()).includes("Decisión documental P2B"), false);
      await reader.goto(`${base}/controlled-documents/${m.id}?tab=history`);
      await reader.getByRole("heading", { name: "Decisión documental P2B", exact: true }).first().waitFor();
      await reader.getByText("Motivo humano sintético UI", { exact: true }).first().waitFor();
      assert.ok(await reader.getByRole("heading", { name: "Decisión documental P2B", exact: true }).count() > 0);
      const writeOnly = await browser.newPage({ extraHTTPHeaders: { ...h, "x-pnt-permissions": "read,write" } });
      await writeOnly.goto(`${base}/controlled-documents/${m.id}?tab=verification`);
      await writeOnly.getByText("Sin operaciones autorizadas en este estado.", { exact: true }).waitFor();
      assert.equal(await writeOnly.locator(".pnt-lifecycle-form button").count(), 0);
      const decision = m.revisions[0].decisions[0], d = decision.details as Record<string, unknown>;
      const payload = { ...d, requestId: randomUUID() };
      assert.equal((await writeOnly.request.post(`${base}/api/controlled-documents/${m.id}/revisions/${m.revisions[0].id}/lifecycle`, { headers: { origin: base }, data: payload })).ok(), false);
      assert.equal((await denied.request.post(`${base}/api/controlled-documents/${m.id}/revisions/${m.revisions[0].id}/lifecycle`, { headers: { origin: base }, data: payload })).status(), 403);
      console.log("P2B Chromium reinicio/acceso OK: lectura autorizada completa, anónimos sin consulta/metadatos/historial sensible; read/write sin capacidad no concede decisiones."); return;
    }
    const gc = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } }); let code = "";
    for (let n = 800; n < 850; n++) if (!await prisma.controlledDocument.findUnique({ where: { baseCode: `GC-00/${n}` } })) { code = `GC-00/${n}`; break; }
    assert.ok(code);
    const source = { synthetic: true, indexImport: { batchId: randomUUID(), declaredState: "IN_FORCE", sheet: "GC-00(", row: 2 } };
    const m = await prisma.controlledDocument.create({ data: { baseCode: code, title: "P2B navegador sintético", departmentId: gc.id, departmentCodeSnapshot: "GC-00", createdByText: "P2B UI QA", sourceMetadata: source,
      revisions: { create: { revisionCode: "00", status: "IMPORTED_PENDING", baseCodeSnapshot: code, titleSnapshot: "P2B navegador sintético", departmentCodeSnapshot: "GC-00", registeredByText: "P2B UI QA", sourceMetadata: source, effectiveFrom: new Date("2026-01-01"), reviewDueAt: new Date("2031-01-01") } } }, include: { revisions: true } });
    const r = m.revisions[0], original = JSON.stringify([r.sourceMetadata, r.effectiveFrom, r.reviewDueAt, r.titleSnapshot]);
    const page = await browser.newPage(), errors: string[] = []; page.on("pageerror", e => errors.push(e.message)); page.setDefaultTimeout(20000);
    const url = `${base}/controlled-documents/${m.id}?tab=verification`;
    for (let attempt = 0; attempt < 60; attempt++) { try { if ((await page.request.get(url)).ok()) break; } catch {} if (attempt === 59) throw new Error("Servidor no disponible"); await new Promise(resolve => setTimeout(resolve, 1000)); }
    const fd = new FormData(); fd.set("mode", "file"); fd.set("kind", "EXTERNAL_SIGNED_PDF"); fd.set("file", new Blob([pdf], { type: "application/pdf" }), "p2b-ui.pdf");
    const response = await fetch(`${base}/api/controlled-documents/${m.id}/revisions/${r.id}/documents`, { method: "POST", headers: { origin: base }, body: fd }); assert.equal(response.status, 201);
    await page.goto(url); const article = page.locator(`article[data-lifecycle-revision="${r.id}"]`);
    await article.getByText(/Estado declarado por el índice:/).waitFor(); await article.getByText(/Falta contraste documental favorable/).waitFor();
    // Regression for the manual failure: submitting without a checked evidence
    // must show a clear field-level instruction and must not send a decision.
    const decisionsBefore = await prisma.controlledRevisionDecision.count({ where: { revisionId: r.id } });
    await article.locator('textarea[name="reason"]').fill("Prueba sin evidencia");
    await article.locator('textarea[name="notes"]').fill("Validación sintética");
    await article.locator(".pnt-lifecycle-form button").click();
    await article.getByRole("alert").filter({ hasText: "Seleccione al menos un documento" }).waitFor();
    assert.equal(await prisma.controlledRevisionDecision.count({ where: { revisionId: r.id } }), decisionsBefore);
    async function submit(operation: string, fill?: () => Promise<void>) {
      await article.getByLabel("Operación", { exact: true }).selectOption(operation);
      await article.locator('input[name="evidenceIds"]').check(); await article.locator('textarea[name="reason"]').fill("Motivo humano sintético UI"); await article.locator('textarea[name="notes"]').fill("Contraste humano UI según evidencia concreta; no firma electrónica");
      if (fill) await fill();
      const responsePromise = page.waitForResponse(res => res.url().endsWith(`/revisions/${r.id}/lifecycle`) && res.request().method() === "POST");
      const navigation = page.waitForNavigation({ waitUntil: "domcontentloaded" });
      await article.locator(".pnt-lifecycle-form button").click(); const res = await responsePromise;
      if (res.status() !== 201) throw new Error(`P2B UI decisión: ${await res.text()}`);
      await navigation; await article.getByLabel("Operación", { exact: true }).waitFor();
      return (await prisma.controlledRevisionDecision.findFirstOrThrow({ where: { revisionId: r.id }, orderBy: { sequence: "desc" } })).id;
    }
    await submit("VERIFY", async () => { await article.locator('select[name="result"]').selectOption("DISCREPANCY"); await article.locator('textarea[name="discrepancies"]').fill("Discrepancia UI sintética"); });
    assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } })).status, "IMPORTED_PENDING");
    await submit("VERIFY");
    for (const role of ["PREPARATION", "REVIEW"]) {
      const id = await submit("REGISTER_EXTERNAL", async () => { await article.locator('select[name="function"]').selectOption(role); await article.locator('input[name="externalPerson"]').fill(`Persona ${role} UI`); await article.locator('input[name="responsibility"]').fill("Responsable sección QA"); await article.locator('textarea[name="authorityBasis"]').fill("Designación QA sintética conforme PNT"); await article.locator('input[name="accreditedDate"]').fill(today); });
      await submit("CONTRAST_EXTERNAL", async () => { await article.locator('select[name="registrationId"]').selectOption(id); });
    }
    await submit("SUBMIT");
    const approval = await submit("REGISTER_EXTERNAL", async () => { await article.locator('input[name="externalPerson"]').fill("Persona aprobación UI"); await article.locator('input[name="responsibility"]').fill("Garantía de Calidad"); await article.locator('textarea[name="authorityBasis"]').fill("Designación QA sintética conforme PNT"); await article.locator('input[name="accreditedDate"]').fill(today); });
    await submit("CONTRAST_EXTERNAL", async () => { await article.locator('select[name="registrationId"]').selectOption(approval); });
    await submit("PLAN", async () => { await article.locator('select[name="finalDocumentId"]').selectOption({ label: "p2b-ui.pdf" }); await article.locator('input[name="effectiveFrom"]').fill(today); await article.locator('input[name="reviewDueAt"]').fill(due); await article.locator('input[name="separationConfirmed"]').check(); });
    await submit("ACTIVATE"); const after = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r.id } }); assert.equal(after.status, "IN_FORCE");
    assert.equal(JSON.stringify([after.sourceMetadata, after.effectiveFrom, after.reviewDueAt, after.titleSnapshot]), original);
    await page.goto(`${base}/controlled-documents?validity=current&q=${encodeURIComponent(code)}`); await page.getByRole("link", { name: code, exact: true }).waitFor();
    for (const width of [1440, 768, 390]) { await page.setViewportSize({ width, height: 900 }); await page.goto(url); await article.getByText(/Fechas operativas:/).waitFor(); }
    assert.deepEqual(errors, []);
    console.log("P2B Chromium OK: índice no acredita vigencia; contraste discrepante/favorable, registro y aceptación externos separados, planificación/activación explícita, procedencia y fechas originales intactas, filtro vigente, responsive y sin errores de hidratación.");
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());

import assert from "node:assert/strict";
import { chromium, authenticateContext, anonymousPage } from "./auth-fixtures/browser";
import { fixtureLogin, fixtureRequest } from "./auth-fixtures/http";
import { prisma } from "../src/lib/db";
const base = process.env.P2A_UI_BASE_URL || "http://127.0.0.1:3000";
const pdf = Buffer.from("%PDF-1.4\nSynthetic browser fixture\n%%EOF");
async function main() {
  if (process.env.APP_ENV !== "test") throw new Error("QA aislado requerido");
  if (process.env.P2A_VERIFY_RESTART === "true") {
    const d = await prisma.controlledRevisionDocument.findFirstOrThrow({ where: { originalName: "first.pdf", revision: { document: { createdByText: "P2A UI QA" } } }, orderBy: { incorporatedAt: "desc" } });
    const url = `${base}/api/controlled-documents/${d.documentId}/revisions/${d.revisionId}/documents/${d.id}`;
    const secret = process.env.PNT_DOCUMENT_PROXY_SECRET!;
    const headers = { "x-pnt-proxy-secret": secret, "x-pnt-user": "QA proxy autenticado", "x-pnt-permissions": "read" };
    let response: Response | undefined;
    const login = await fixtureLogin("reader");
    for (let i = 0; i < 60; i++) { try { response = await fixtureRequest(login.jar, url, { headers }); if (response.ok) break; } catch {} if (i === 59) throw new Error("Descarga tras reinicio no disponible"); await new Promise(resolve => setTimeout(resolve, 1000)); }
    assert.deepEqual(Buffer.from(await response!.arrayBuffer()), pdf);
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: { ...headers, "x-pnt-proxy-secret": "wrong" } })).status, 401);
    const browser = await chromium.launch({ headless: true });
    try {
      const reader = await browser.newPage({ extraHTTPHeaders: headers });
      await authenticateContext(reader.context(), "reader");
      await reader.goto(`${base}/controlled-documents/${d.documentId}?tab=documents`);
      await reader.getByRole("link", { name: "Descargar first.pdf", exact: true }).waitFor();
      assert.equal(await reader.getByRole("button", { name: "Añadir documento", exact: true }).count(), 0);
      const denied = await anonymousPage(browser); await denied.goto(`${base}/controlled-documents/${d.documentId}?tab=documents`);
      await denied.waitForURL(/\/login/); assert.equal(await denied.getByRole("link", { name: "Descargar first.pdf", exact: true }).count(), 0);
      const historyUrl = `${base}/controlled-documents/${d.documentId}?tab=history`;
      await reader.goto(historyUrl);
      await reader.getByRole("heading", { name: "Sustitución documental (original conservado)", exact: true }).waitFor();
      assert.ok(await reader.getByRole("heading", { name: "Incorporación documental", exact: true }).count() > 0);
      await reader.getByText("Copia corregida QA", { exact: true }).waitFor();
      await denied.goto(historyUrl);
      await denied.waitForURL(/\/login/);
      const publicHistory = await denied.locator("body").innerText();
      for (const text of ["Incorporación documental", "Sustitución documental (original conservado)", "Usuario de prueba documental", "Copia corregida QA", d.id, d.sha256!]) assert.equal(publicHistory.includes(text), false);
    } finally { await browser.close(); }
    console.log("P2A reinicio real OK: binario íntegro, descarga autenticada y lectura sin escritura; historial documental completo con read, oculto sin acceso, historial ordinario disponible.");
    return;
  }
  const master = await prisma.controlledDocument.create({ data: { title: "P2A navegador ficticio", createdByText: "P2A UI QA", changes: { create: { action: "Edición ordinaria QA", changedByText: "Responsable ordinario QA", reason: "Motivo ordinario QA", newValue: { title: "Título ordinario QA" } } }, revisions: { create: [{ revisionCode: "00", registeredByText: "P2A UI QA", status: "IMPORTED_PENDING", sourceMetadata: { synthetic: true, sheet: "GC-00(" } }, { revisionCode: "01", registeredByText: "P2A UI QA" }] } }, include: { revisions: { orderBy: { revisionCode: "desc" } } } });
  const snapshot = JSON.stringify(master), r = master.revisions[1];
  const browser = await chromium.launch({ headless: true }), page = await browser.newPage(); page.setDefaultTimeout(20000);
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  const url = `${base}/controlled-documents/${master.id}?tab=documents`;
  try {
    for (let attempt = 0; attempt < 60; attempt++) { try { if ((await page.request.get(url)).ok()) break; } catch {} if (attempt === 59) throw new Error("Servidor no disponible"); await new Promise(resolve => setTimeout(resolve, 1000)); }
    await page.goto(url); await page.getByRole("heading", { name: "Documentos por revisión", exact: true }).waitFor();
    const revisions = page.locator("article[data-revision-id]"); assert.deepEqual(await revisions.locator("h3").allTextContents(), ["Revisión 01", "Revisión 00"]);
    const article = page.locator(`article[data-revision-id="${r.id}"]`);
    await article.getByText(/Advertencia: revisión pendiente/).waitFor();
    async function upload(kind: string, name: string, replacing = "") {
      await article.getByLabel("Tipo documental", { exact: true }).selectOption(kind);
      await article.getByLabel("Soporte", { exact: true }).selectOption("file");
      await article.getByLabel("Archivo documental", { exact: true }).setInputFiles({ name, mimeType: "application/pdf", buffer: pdf });
      await article.getByLabel("Sustituye a", { exact: true }).selectOption(replacing);
      if (replacing) await article.getByLabel(/^Motivo de sustitución/).fill("Copia corregida QA");
      else assert.equal(await article.getByLabel(/^Motivo de sustitución/).count(), 0, "El motivo solo se solicita para una sustitución.");
      const response = page.waitForResponse(response => response.url().endsWith(`/revisions/${r.id}/documents`) && response.request().method() === "POST");
      await article.getByRole("button", { name: "Añadir documento", exact: true }).click();
      assert.equal((await response).status(), 201);
      await article.getByRole("link", { name: `Descargar ${name}`, exact: true }).waitFor();
      await page.reload();
      await article.getByRole("link", { name: `Descargar ${name}`, exact: true }).waitFor();
    }
    await upload("DOCUMENT_PDF", "first.pdf");
    const first = await prisma.controlledRevisionDocument.findFirstOrThrow({ where: { revisionId: r.id, originalName: "first.pdf" } });
    await upload("APPROVAL_EVIDENCE", "evidence.pdf");
    await upload("DOCUMENT_PDF", "replacement.pdf", first.id);
    await article.getByText(/first.pdf — Sustituido/).waitFor();
    await article.getByLabel("Soporte", { exact: true }).selectOption("reference");
    await article.getByLabel("Tipo documental", { exact: true }).selectOption("ANNEX");
    await article.getByLabel("Nombre de referencia", { exact: true }).fill("Anexo externo QA");
    await article.getByLabel("URL documental HTTPS", { exact: true }).fill("https://example.invalid/synthetic");
    const referenceResponse = page.waitForResponse(response => response.url().endsWith(`/revisions/${r.id}/documents`) && response.request().method() === "POST");
    await article.getByRole("button", { name: "Añadir documento", exact: true }).click(); assert.equal((await referenceResponse).status(), 201);
    await article.getByRole("link", { name: "Abrir referencia externa", exact: true }).waitFor(); await page.reload();
    await article.getByRole("link", { name: "Abrir referencia externa", exact: true }).waitFor();
    const downloaded = await page.request.get(`${base}/api/controlled-documents/${master.id}/revisions/${r.id}/documents/${first.id}`);
    assert.equal(downloaded.status(), 200); assert.deepEqual(await downloaded.body(), pdf); assert.equal(downloaded.headers()["cache-control"], "private, no-store");
    assert.equal((await page.request.get(`${base}/api/controlled-documents/${master.id}/revisions/${master.revisions[0].id}/documents/${first.id}`)).status(), 404);
    await article.getByLabel("Soporte", { exact: true }).selectOption("file"); await article.getByLabel("Tipo documental", { exact: true }).selectOption("DOCUMENT_PDF");
    await article.getByLabel("Archivo documental", { exact: true }).setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a PDF") });
    await article.getByRole("button", { name: "Añadir documento", exact: true }).click(); await article.getByRole("alert").filter({ hasText: "Cabecera PDF no válida" }).waitFor();
    assert.equal(await prisma.controlledRevisionDocument.count({ where: { revisionId: r.id } }), 4);
    assert.equal(JSON.stringify(await prisma.controlledDocument.findUniqueOrThrow({ where: { id: master.id }, include: { revisions: { orderBy: { revisionCode: "desc" } } } })), snapshot);
    await page.getByRole("link", { name: "Historial", exact: true }).click(); await page.getByRole("heading", { name: "Sustitución documental (original conservado)", exact: true }).waitFor();
    for (const width of [1440, 768, 390]) { await page.setViewportSize({ width, height: 900 }); await page.goto(url); await page.getByRole("heading", { name: "Documentos por revisión", exact: true }).waitFor(); }
    assert.deepEqual(errors, []);
    console.log("P2A navegador OK: revisiones descendentes, incorporación múltiple/ref, metadatos, sustitución/historial, descarga original, ownership, validación servidor, estados/snapshots intactos y sin errores de hidratación.");
  } catch (error) {
    console.error("P2A browser errors", errors);
    console.error("P2A form diagnostics", await page.locator("p[role=alert], p[role=status]").allTextContents());
    console.error("P2A page diagnostics", page.url(), (await page.locator("body").innerText()).slice(-2500));
    throw error;
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());

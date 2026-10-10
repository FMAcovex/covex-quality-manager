import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { prisma } from "../src/lib/db";
import { readZip } from "../src/lib/ooxml/zip";
import { manualMaster, qaOnly, pdf, today, offset } from "../src/modules/controlled-documents/testing/p2c";
const base = process.env.PNT_FINAL_UI_BASE_URL || "http://127.0.0.1:3000";
const screenshots = process.env.PNT_FINAL_SCREENSHOT_DIR;
const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");
async function main() {
  qaOnly(); if (screenshots) await mkdir(screenshots, { recursive: true });
  const token = `PNT-FINAL-${randomUUID()}`, { master } = await manualMaster(), revision = master.revisions[0];
  await prisma.controlledDocument.update({ where: { id: master.id }, data: { title: token + " 25" } });
  await prisma.controlledDocumentRevision.update({ where: { id: revision.id }, data: { titleSnapshot: token + " 25" } });
  const used = new Set((await prisma.controlledDocument.findMany({ select: { baseCode: true } })).map(m => m.baseCode));
  const available = Array.from({ length: 250 }, (_, n) => `GC-00/${n + 400}`).filter(code => !used.has(code));
  assert.ok(available.length >= 30, "Sin códigos QA libres para paginación");
  for (let n = 0; n < 31; n++) if (n !== 25) {
    const code = available.shift()!;
    await prisma.controlledDocument.create({ data: { baseCode: code, title: token + " " + String(n).padStart(2, "0"), administrativeStatus: "ACTIVE",
      departmentId: master.departmentId, departmentCodeSnapshot: master.departmentCodeSnapshot, departmentNameSnapshot: master.departmentNameSnapshot, createdByText: "QA final UI",
      revisions: { create: { revisionCode: "00", baseCodeSnapshot: code, titleSnapshot: token + " " + String(n).padStart(2, "0"), registeredByText: "QA final UI", departmentCodeSnapshot: master.departmentCodeSnapshot, departmentNameSnapshot: master.departmentNameSnapshot } },
    } });
  }
  const filters = new URLSearchParams({ q: token, department: master.departmentId!, state: "ACTIVE", revision: "00", revisionState: "DRAFT", quick: "unverified", view: "latest", sort: "title", direction: "asc", page: "2" });
  const back = "/controlled-documents?" + filters, detail = "/controlled-documents/" + master.id;
  await prisma.$disconnect();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, timezoneId: "Europe/Madrid" }); page.setDefaultTimeout(30000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const go = async (path: string) => { await page.goto(base + path); await page.locator("main h1").waitFor(); await page.waitForLoadState("networkidle"); };
    const context = () => assert.equal(new URL(page.url()).searchParams.get("returnTo"), back);
    const click = async (name: string) => { await page.getByRole("link", { name, exact: true }).click(); await page.locator("main h1").waitFor(); await page.waitForLoadState("networkidle"); context(); };
    const save = async (name: string) => { await Promise.all([page.waitForNavigation(), page.getByRole("button", { name, exact: true }).click()]); context(); };
    const state = async (target: string, code = "00") => {
      await page.getByLabel("Estado de la revisión " + code, { exact: true }).selectOption(target);
      const panel = page.locator(".pnt-manual-revision").filter({ has: page.getByLabel("Estado de la revisión " + code, { exact: true }) });
      await panel.getByLabel("Motivo y referencia de la decisión externa", { exact: true }).fill("QA final: evidencia externa sintética");
      if (target === "IN_FORCE") { await panel.getByLabel("Fecha de vigencia real").fill(today); await panel.getByLabel("Próxima revisión (si consta)").fill(offset(365)); }
      await Promise.all([page.waitForNavigation(), panel.getByRole("button", { name: "Guardar estado manual", exact: true }).click()]); context();
    };
    const capture = async (name: string) => { if (screenshots) await page.screenshot({ path: `${screenshots}/${name}.png`, fullPage: true }); };
    await go(back); assert.equal(await page.locator("tbody tr").count(), 6);
    assert.ok((await page.getByRole("link", { name: "Vigentes", exact: true }).getAttribute("href"))!.indexOf("page=") < 0);
    assert.ok((await page.locator("#pnt-latest-help").innerText()).includes("número más alto"));
    const download = await page.request.get(base + await page.getByRole("link", { name: "Descargar .xlsx", exact: true }).getAttribute("href"));
    assert.equal(download.status(), 200);
    const xml = readZip(await download.body()).find(e => e.name === "xl/worksheets/sheet1.xml")!.data.toString();
    assert.equal((xml.match(/<row\b/g) || []).length, 32); assert.ok(xml.includes("Sin verificar")); assert.ok(!xml.includes("UNVERIFIED"));
    const listStyle = await page.locator(".pnt-state").first().evaluate(el => ({ text: el.textContent, bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
    await capture("1440-listado");
    await page.getByRole("link", { name: master.baseCode!, exact: true }).click(); context();
    assert.equal(await page.getByRole("link", { name: "Volver al listado", exact: true }).getAttribute("href"), back);
    for (const tab of ["Revisiones", "Documentos", "Historial", "Información"]) await click(tab);
    const infoStyle = await page.locator(".pnt-manual-heading .pnt-state").first().evaluate(el => ({ text: el.textContent, bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
    assert.deepEqual(infoStyle, listStyle);
    await click("Editar maestro"); await page.getByLabel("Observaciones (opcional)", { exact: true }).fill("Observaciones QA final");
    await page.getByLabel("Responsable del registro", { exact: true }).fill("QA final"); await page.getByLabel("Motivo del registro o cambio", { exact: true }).fill("Corrección QA"); await save("Guardar cambios");
    await state("IN_REVIEW"); await state("DRAFT");
    const archive = async () => { const result = { documents: await prisma.controlledRevisionDocument.findMany({ where: { revisionId: revision.id } }), decisions: await prisma.controlledRevisionDecision.findMany({ where: { revisionId: revision.id }, orderBy: { sequence: "asc" } }) }; await prisma.$disconnect(); return result; };
    const before = await archive();
    await click("Revisiones");
    assert.ok((await page.locator("main").innerText()).includes("Revisión creada manualmente"));
    assert.ok(!(await page.locator("main").innerText()).includes("Revisión importada pendiente"));
    const revisionStyle = await page.locator(".pnt-revision-header .pnt-state").first().evaluate(el => ({ text: el.textContent, bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
    assert.deepEqual(revisionStyle, listStyle);
    await capture("1440-borrador-devuelto"); await click("Editar revisión en elaboración");
    await page.getByLabel("Motivo de revisión", { exact: true }).fill("Corrección después de devolución QA");
    await page.getByLabel("Responsable del registro", { exact: true }).fill("QA final"); await page.getByLabel("Motivo del registro o cambio", { exact: true }).fill("Corregir borrador QA"); await save("Guardar revisión");
    assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: revision.id } })).revisionReason, "Corrección después de devolución QA"); assert.deepEqual(await archive(), before);
    await click("Documentos"); const form = page.locator(`[data-revision-id="${revision.id}"] form`);
    await form.getByLabel("Tipo documental", { exact: true }).selectOption("DOCUMENT_PDF");
    await form.locator("input[type=file]").setInputFiles({ name: "qa-final.pdf", mimeType: "application/pdf", buffer: pdf });
    await save("Añadir documento");
    const href = (await page.getByRole("link", { name: "Descargar qa-final.pdf", exact: true }).getAttribute("href"))!;
    assert.equal(sha(await (await page.request.get(base + href)).body()), sha(pdf));
    const stored = await prisma.controlledRevisionDocument.findFirstOrThrow({ where: { revisionId: revision.id, originalName: "qa-final.pdf" } });
    await prisma.$disconnect();
    await click("Información"); await state("APPROVED_PENDING_EFFECTIVE"); await click("Revisiones");
    assert.equal(await page.getByRole("link", { name: "Editar revisión en elaboración", exact: true }).count(), 0);
    await click("Información"); await state("DRAFT"); await click("Revisiones");
    assert.equal(await page.getByRole("link", { name: "Editar revisión en elaboración", exact: true }).count(), 0);
    await go(detail + `/revisions/${revision.id}/edit?returnTo=` + encodeURIComponent(back));
    assert.equal(await page.locator('input[name="revisionCode"]').count(), 0);
    await go(detail + "?tab=information&returnTo=" + encodeURIComponent(back)); await state("IN_FORCE");
    await click("Revisiones"); await click("Añadir revisión");
    await page.getByLabel("Revisión explícita", { exact: true }).fill("01"); await page.getByLabel("Responsable del registro", { exact: true }).fill("QA final");
    await page.getByLabel("Motivo del registro o cambio", { exact: true }).fill("Nueva revisión QA preserva 00"); await save("Guardar revisión");
    const second = await prisma.controlledDocumentRevision.findFirstOrThrow({ where: { documentId: master.id, revisionCode: "01" } });
    await prisma.$disconnect();
    assert.equal((await page.request.get(base + href.replace(revision.id, second.id))).status(), 404);
    await click("Información"); await state("IN_FORCE", "01");
    assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: revision.id } })).status, "OBSOLETE");
    assert.deepEqual(await prisma.controlledRevisionDocument.findUniqueOrThrow({ where: { id: stored.id } }), stored);
    await prisma.$disconnect();
    assert.equal(sha(await (await page.request.get(base + href)).body()), sha(pdf));
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 950 });
      for (const tab of ["Información", "Revisiones", "Documentos", "Historial"]) {
        await click(tab); assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth + 1)); await capture(width + "-" + tab);
      }
    }
    await page.getByRole("link", { name: "Volver al listado", exact: true }).click(); assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, back);
    await page.getByRole("link", { name: "Pendientes de verificar", exact: true }).click(); assert.equal(new URL(page.url()).searchParams.get("page"), null);
    await page.goto(base + back); await page.getByRole("link", { name: "Nuevo PNT", exact: true }).click(); context();
    assert.equal(await page.getByRole("link", { name: "Volver al listado", exact: true }).getAttribute("href"), back);
    assert.deepEqual(errors, []);
    console.log("PNT final Chromium OK: página 2 + filtros/orden/vista, pestañas, edición y guardados, retorno a Borrador, bloqueo tras aprobación, alta de revisión, asociación/descarga PDF e histórico, etiquetas/colores iguales, XLSX completo español y 1440/768/390 sin errores JS.");
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { isolatedTestEnvironment, authConfiguration } from "../src/lib/auth/config";
import { chromium, authenticatedPage } from "./auth-fixtures/browser";
import type { Page } from "playwright";

// D-111 (V1): franja de datos clave en los resúmenes de los 8 módulos y tono de plazos.
const day = (offset: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + offset); return d; };

async function main() {
  assert(isolatedTestEnvironment(), "Exclusivamente base sintética aislada");
  const base = authConfiguration().origin, marker = "UXV1-" + randomUUID().slice(0, 8);
  const department = await prisma.department.findFirstOrThrow({ orderBy: { code: "asc" } });
  const qmsRecord = (type: string, suffix = "") => ({ create: { recordType: type as "DEVIATION", businessCode: `${marker}-${type}${suffix}`, year: 2026 } });
  const dep = { department: { connect: { id: department.id } } };
  const author = "Autor sintético UX";
  const deviation = await prisma.deviation.create({ data: { ...dep, qmsRecord: qmsRecord("DEVIATION"), createdByText: author, status: "OPEN", whatHappened: marker, issueDate: day(-3) } });
  const overdueCapa = await prisma.capa.create({ data: { ...dep, qmsRecord: qmsRecord("CAPA"), createdByText: author, status: "OPEN", actionType: "CORRECTIVE", defectDescription: marker, nextFollowupDate: day(-1) } });
  const closedCapa = await prisma.capa.create({ data: { ...dep, qmsRecord: qmsRecord("CAPA", "-C"), createdByText: author, status: "CLOSED", actionType: "CORRECTIVE", defectDescription: marker, nextFollowupDate: day(-1) } });
  const change = await prisma.changeControl.create({ data: { ...dep, qmsRecord: qmsRecord("CHANGE_CONTROL"), finalStatus: "OPEN", description: marker } });
  const complaint = await prisma.complaint.create({ data: { ...dep, qmsRecord: qmsRecord("COMPLAINT"), createdByText: author, status: "OPEN", complaintType: "CUSTOMER", description: marker } });
  const ret = await prisma.returnRecord.create({ data: { ...dep, qmsRecord: qmsRecord("RETURN"), createdByText: author, status: "OPEN", returnType: "COMMERCIAL" } });
  const oos = await prisma.oosRecord.create({ data: { qmsRecord: qmsRecord("OOS"), status: "OPEN", materialName: marker } });
  const audit = await prisma.audit.create({ data: { qmsRecord: qmsRecord("AUDIT"), status: "OPEN", auditType: "INTERNAL", scenario: "INTERNAL_COVEX", title: marker, scope: marker, createdByText: author, codingDepartment: { connect: { id: department.id } } } });
  let pntCode = "";
  for (let n = 899; n >= 800; n--) { const candidate = `${department.code}/${n}`; if (!await prisma.controlledDocument.findUnique({ where: { baseCode: candidate } })) { pntCode = candidate; break; } }
  const pnt = await prisma.controlledDocument.create({ data: { departmentId: department.id, departmentCodeSnapshot: department.code, departmentNameSnapshot: department.name, title: marker, baseCode: pntCode, administrativeStatus: "ACTIVE", createdByText: author } });

  const pages = [
    `/deviations/${deviation.id}`, `/capa/${overdueCapa.id}`, `/changes/${change.id}`, `/complaints/${complaint.id}`,
    `/returns/${ret.id}`, `/oos/${oos.id}`, `/audits/${audit.id}`, `/controlled-documents/${pnt.id}`,
  ];
  const browser = await chromium.launch({ headless: true });
  const page = await authenticatedPage(browser);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const visit = async (p: Page, path: string) => { const response = await p.goto(base + path); assert(response?.ok(), path); await p.locator("main h1").first().waitFor(); };
  try {
    for (const path of pages) {
      await visit(page, path);
      const facts = page.locator(".record-key-facts .key-fact");
      assert(await facts.count() >= 4, `${path}: al menos 4 datos clave`);
      assert.equal(await facts.first().locator("dd .badge").count(), 1, `${path}: el estado en su chip de color`);
    }
    // Etiquetas claras de la franja (revisión final V1).
    await visit(page, `/deviations/${deviation.id}`);
    assert((await page.locator(".record-key-facts dt").allTextContents()).includes("En plazo"), "Desviación: «En plazo»");
    // Un «Anular» sin más acciones no deja separador colgando.
    assert.equal(await page.evaluate(() => { const annul = document.querySelector(".record-actions-annul"); if (!annul) return "none"; while (annul.nextSibling) annul.nextSibling.remove(); return getComputedStyle(annul).borderRightStyle; }), "none", "Sin separador si «Anular» va solo");
    await visit(page, `/returns/${ret.id}`);
    assert((await page.locator(".record-key-facts dt").allTextContents()).includes("Fecha decisión"), "Devolución: «Fecha decisión»");
    // Ventana intermedia (900 px): el título no se monta sobre las acciones.
    await page.setViewportSize({ width: 900, height: 1000 });
    await visit(page, `/deviations/${deviation.id}`);
    const h1 = (await page.locator(".record-title-line h1").boundingBox())!, actions = (await page.locator(".record-actions").boundingBox())!;
    const overlap = h1.x < actions.x + actions.width && actions.x < h1.x + h1.width && h1.y < actions.y + actions.height && actions.y < h1.y + h1.height;
    assert(!overlap, `Título y acciones sin solaparse a 900 px (${JSON.stringify({ h1, actions })})`);
    // Móvil (390 px): sin desbordamiento horizontal y pestañas en una sola fila desplazable.
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of pages) {
      await visit(page, path);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path}: sin desbordamiento a 390 px`);
    }
    await visit(page, `/deviations/${deviation.id}`);
    assert(await page.locator(".record-tabs").evaluate(el => el.scrollWidth > el.clientWidth), "Pestañas en una fila desplazable");
    await visit(page, `/audits/${audit.id}`);
    assert.equal(await page.locator(".audit-info-grid").first().evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length), 1, "Auditoría: una columna en móvil");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await visit(page, `/capa/${overdueCapa.id}`);
    const overdue = page.locator(".record-key-facts .key-fact.is-overdue");
    assert.equal(await overdue.count(), 1, "CAPA con seguimiento de ayer: plazo vencido");
    assert(await overdue.isVisible(), "El plazo vencido se ve");
    assert.match(await overdue.textContent() ?? "", /Vencido/);
    await visit(page, `/capa/${closedCapa.id}`);
    assert.equal(await page.locator(".record-key-facts .key-fact.is-overdue").count(), 0, "Cerrada: sin color de vencido");
    assert.deepEqual(errors, []);
    console.log("UX V1 OK: datos clave en 8 módulos y tono de plazos (vencido / cerrado).");
  } finally {
    await browser.close();
  }
}
main().finally(() => prisma.$disconnect()).catch(e => { console.error(e); process.exitCode = 1; });

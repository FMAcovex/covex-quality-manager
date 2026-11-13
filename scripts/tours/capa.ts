// Recorrido de CAPA (D-138): alta desde su desviación de origen con la acción propuesta → seguimiento 01
// con el avance de la acción → verificación de la eficacia y cierre → Anexo III y listado. Cada paso
// comprueba en la base de datos y en los documentos lo que el usuario ve.
//
//   Prueba (CI):  pnpm tour:capa
//   Vídeo (demo): TOUR_VIDEO_DIR=<carpeta> pnpm tour:capa
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { isActiveTemplateAssetReady, templateAssetReady } from "../../src/modules/configuration/template-readiness";
import { finishTour, ooxmlText, startTour } from "./lib";

const madridDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
// Una sola fecha «de hoy» para rellenar y comprobar, aunque el recorrido cruce la medianoche.
const today = madridDay();

async function main() {
  const tour = await startTour("Recorrido CAPA");
  const { page } = tour;
  const marker = tour.demo ? `REC-${randomUUID().slice(0, 4).toUpperCase()}` : `TOUR-CAPA-${randomUUID().slice(0, 8)}`;
  let failure: unknown = null;
  try {
    const department = await prisma.department.findFirst({ where: { isActive: true, code: "PM-10" } })
      ?? await prisma.department.findFirstOrThrow({ where: { isActive: true }, orderBy: { code: "asc" } });
    const origin = await originDeviation(tour.demo, marker, department);
    const other = await otherCapa(tour.demo, marker, department, origin.code);
    const defect = `Etiquetas del lote ficticio ${marker} impresas con la caducidad del formato anterior.`;
    const rootCause = `Plantilla de etiqueta sin control de versión en la impresora de línea (${marker}).`;
    const action = "Retirar las plantillas antiguas de la impresora y bloquear su edición sin verificación.";

    // 1 · Alta: origen, defecto, causa raíz y acción propuesta; al guardarla abierta recibe su código.
    const opened = await tour.step(`1 · Se abre la <b>CAPA</b> desde su origen, la desviación <b>${origin.code}</b>`, async () => {
      await tour.go("/capa");
      await tour.click(page.locator("main a", { hasText: "+ Nueva CAPA" }).first());
      await page.waitForURL(/\/capa\/new/);
      await tour.select(page.locator('select[name="actionType"]'), "CORRECTIVE");
      await tour.select(page.locator('select[name="departmentId"]'), department.id);
      await tour.fill(page.locator('input[name="openedAt"]'), today);
      const author = page.locator('input[name="createdByText"]');
      if (await author.getAttribute("readonly") === null && !(await author.inputValue())) await tour.fill(author, "Garantía de Calidad (ficticio)");
      const search = page.locator(".relation-code-field input");
      await tour.fill(search, origin.code);
      await tour.click(page.locator('.relation-suggestions [role="option"]', { hasText: origin.code }).first());
      await page.locator(".relation-chip", { hasText: origin.code }).waitFor();
      await tour.fill(page.locator('input[name="applicableTo"]'), "Etiquetado, impresora de línea L-3");
      await tour.fill(page.locator('textarea[name="defectDescription"]'), defect);
      await tour.fill(page.locator('textarea[name="rootCause"]'), rootCause);
      await tour.check(page.locator('input[name="rootCauseCategories"][value="METHOD"]'));
      const planned = page.locator(".capa-action-grid").first();
      await tour.fill(planned.locator("textarea").first(), action);
      await tour.fill(planned.getByRole("textbox", { name: "Responsable", exact: true }), "Responsable de Acondicionamiento (ficticio)");
      await tour.fill(planned.getByLabel("Fecha prevista"), madridDay(20));
      await tour.fill(page.locator('textarea[name="actionFollowupObservations"]'), "Acción planificada; pendiente de ejecutar.");
      await tour.fill(page.locator('textarea[name="operationalStatusDescription"]'), "En curso.");
      await tour.fill(page.locator('textarea[name="effectivenessAssessment"]'), "Se verificará revisando las etiquetas de los tres lotes siguientes.");
      await tour.fill(page.locator('textarea[name="conclusion"]'), "Pendiente de ejecutar la acción y verificar la eficacia.");
      await tour.fill(page.locator('input[name="nextFollowupDate"]'), madridDay(20));
      await tour.select(page.locator('select[name="status"]'), "OPEN");
      await tour.click(page.getByRole("button", { name: "Guardar CAPA" }));
      await page.waitForURL(/\/capa\/[0-9a-f-]{36}(\?|$)/);
      const capa = await prisma.capa.findFirstOrThrow({ where: { defectDescription: defect }, include: { qmsRecord: true, plannedActions: true } });
      assert.equal(capa.status, "OPEN");
      assert.match(capa.qmsRecord.businessCode ?? "", /^AC\//, "la CAPA correctiva recibe su código AC/…");
      assert.equal(capa.rootCause, rootCause);
      assert.deepEqual(capa.rootCauseCategories, ["METHOD"]);
      assert.deepEqual(capa.plannedActions.map((a) => a.description), [action]);
      const relation = await prisma.qmsRelation.count({ where: { OR: [
        { sourceRecordId: origin.qmsRecordId, targetRecordId: capa.qmsRecordId },
        { sourceRecordId: capa.qmsRecordId, targetRecordId: origin.qmsRecordId },
      ] } });
      assert.equal(relation, 1, "la CAPA queda relacionada con su desviación de origen");
      const versions = await prisma.qmsRecordVersion.findMany({ where: { qmsRecordId: capa.qmsRecordId }, select: { sequenceNumber: true } });
      assert.deepEqual(versions.map((v) => v.sequenceNumber), [0], "al abrirla nace el seguimiento 00");
      const code = capa.qmsRecord.businessCode ?? "";
      await page.getByText(code).first().waitFor();
      await tour.pause(1500);
      return { id: capa.id, qmsRecordId: capa.qmsRecordId, code };
    });

    // 2 · Seguimiento 01: avance de la acción, con fecha y motivo; el 00 se conserva.
    await tour.step(`2 · <b>Seguimiento 01</b>: se registra el avance de la acción`, async () => {
      await tour.click(page.locator("main a", { hasText: "Editar / seguimiento" }).first());
      await page.waitForURL(/\/edit/);
      await tour.click(page.getByRole("button", { name: "+ Añadir seguimiento" }));
      const followup = page.locator(".capa-action-card.compact").last();
      await tour.fill(followup.getByLabel("Fecha"), today);
      await tour.fill(followup.getByLabel("Descripción"), "Plantillas antiguas retiradas de la impresora L-3; edición bloqueada con contraseña de supervisor.");
      await tour.fill(page.locator('input[name="versionFollowupDate"]'), today);
      await tour.fill(page.locator('textarea[name="operationalStatusDescription"]'), "Acción ejecutada; pendiente de verificar la eficacia.");
      await tour.fill(page.locator('input[name="nextFollowupDate"]'), madridDay(30));
      await tour.fill(page.locator('textarea[name="changeReason"]'), "Seguimiento de la acción ejecutada.");
      await tour.click(page.getByRole("button", { name: "Guardar como nuevo seguimiento" }));
      await page.waitForURL(/\/capa\/[0-9a-f-]{36}(\?|$)/);
      const capa = await prisma.capa.findUniqueOrThrow({ where: { id: opened.id }, include: { actionFollowups: true } });
      assert.equal(capa.status, "OPEN");
      assert.deepEqual(capa.actionFollowups.map((f) => [f.followupDate?.toISOString().slice(0, 10), f.description]),
        [[today, "Plantillas antiguas retiradas de la impresora L-3; edición bloqueada con contraseña de supervisor."]], "queda registrado el seguimiento de la acción");
      const versions = await prisma.qmsRecordVersion.findMany({ where: { qmsRecordId: opened.qmsRecordId }, orderBy: { sequenceNumber: "asc" }, select: { sequenceNumber: true } });
      assert.deepEqual(versions.map((v) => v.sequenceNumber), [0, 1], "el seguimiento 01 se añade y el 00 se conserva");
      await tour.pause(1200);
    });

    // 3 · Eficacia conforme y cierre.
    await tour.step(`3 · Se verifica la <b>eficacia</b> y se <b>cierra</b> la CAPA`, async () => {
      await tour.click(page.locator("main a", { hasText: "Editar / seguimiento" }).first());
      await page.waitForURL(/\/edit/);
      await tour.select(page.locator('select[name="effectivenessStatus"]'), "CONFORMING");
      await tour.fill(page.locator('input[name="effectiveClosedAt"]'), today);
      await tour.fill(page.locator('textarea[name="effectivenessAssessment"]'), "Etiquetas de los tres lotes siguientes revisadas sin errores de caducidad.");
      await tour.fill(page.locator('textarea[name="conclusion"]'), "Acción eficaz. Se cierra la CAPA.");
      await tour.select(page.locator('select[name="status"]'), "CLOSED");
      await tour.fill(page.locator('input[name="operationalClosedAt"]'), today);
      await tour.fill(page.locator('textarea[name="changeReason"]'), "Cierre tras verificar la eficacia.");
      await tour.click(page.getByRole("button", { name: "Guardar CAPA" }));
      await page.waitForURL(/\/capa\/[0-9a-f-]{36}(\?|$)/);
      const capa = await prisma.capa.findUniqueOrThrow({ where: { id: opened.id } });
      assert.equal(capa.status, "CLOSED", "la CAPA queda cerrada");
      assert.equal(capa.effectivenessStatus, "CONFORMING");
      assert.equal(capa.operationalClosedAt?.toISOString().slice(0, 10), today);
      assert.equal(capa.rootCause, rootCause, "la causa raíz no cambia al cerrar");
      const versions = await prisma.qmsRecordVersion.findMany({ where: { qmsRecordId: opened.qmsRecordId }, orderBy: { sequenceNumber: "asc" }, select: { sequenceNumber: true } });
      assert.deepEqual(versions.map((v) => v.sequenceNumber), [0, 1], "cerrar con «Guardar CAPA» actualiza el seguimiento vigente, no crea otro");
      await tour.pause(1500);
    });

    // 4 · Documentos generados desde el expediente.
    await tour.step(`4 · Los documentos salen del expediente: <b>Anexo III</b> y listado`, async () => {
      await tour.go(`/capa/${opened.id}`);
      const annexIII = page.locator("main a", { hasText: "Generar Anexo III" }).first();
      const assigned = (await prisma.capa.findUniqueOrThrow({ where: { id: opened.id }, select: { annexIIITemplateVersion: { select: { fileName: true, filePath: true, checksum: true } } } })).annexIIITemplateVersion;
      if (assigned ? templateAssetReady(assigned) : await isActiveTemplateAssetReady("CAPA", "CAPA_ANNEX_III")) {
        const file = await tour.download(annexIII);
        const text = ooxmlText(file.bytes, /^word\/document\.xml$/);
        for (const expected of [opened.code, marker, origin.code]) assert.ok(text.includes(expected), `el Anexo III contiene «${expected}»`);
        await tour.showDocument(file.name, file.bytes, `<b>Anexo III</b> de ${opened.code}, cumplimentado sobre la plantilla oficial`);
      } else {
        // Sin plantilla instalada (CI), generar el anexo explica qué falta y cómo instalarla.
        await tour.click(annexIII);
        await page.getByText("Plantilla oficial no disponible").first().waitFor();
      }
      await tour.go(`/capa?q=${encodeURIComponent(opened.code)}`);
      await page.locator("tr", { hasText: opened.code }).first().waitFor();
      await tour.click(page.locator("summary", { hasText: "Exportar" }));
      const list = await tour.download(page.locator("a", { hasText: /Listado simple · filtros actuales/ }).first());
      const listText = ooxmlText(list.bytes, /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/);
      assert.ok(listText.includes(opened.code), "el listado filtrado contiene la CAPA");
      assert.ok(!listText.includes(other), `el listado filtrado por ${opened.code} no incluye otras CAPA (${other})`);
      await page.keyboard.press("Escape");
      await tour.caption(`El listado filtrado se descarga en Excel con <b>${opened.code}</b>`);
      await tour.pause(2500);
    });
    await tour.caption(`Recorrido completado: <b>${opened.code}</b> abierta, con seguimiento, eficacia verificada y cerrada`);
    await tour.pause(3000);
    console.log(`Recorrido de CAPA correcto: ${origin.code} → ${opened.code}`);
  } catch (error) {
    failure = error;
  }
  await finishTour(failure, [
    () => tour.close(),
    async () => { if (!tour.demo) await cleanup(marker); },
    () => prisma.$disconnect(),
  ]);
}

/**
 * Desviación de origen. En la demo, una desviación abierta de los ejemplos (el recorrido no escribe en la
 * demo fuera de la interfaz). En la base de pruebas se crea una mínima con la marca, como hacen los smokes
 * de CAPA, y se borra al terminar.
 */
async function originDeviation(demo: boolean, marker: string, department: { id: string; code: string; name: string }) {
  if (demo) {
    const row = await prisma.deviation.findFirst({
      where: { status: "OPEN", qmsRecord: { isActive: true, businessCode: { startsWith: "D/" }, NOT: { businessCode: { startsWith: "D/TOUR/" } } }, NOT: { whatHappened: { contains: "lote ficticio REC-" } } },
      orderBy: { issueDate: { sort: "desc", nulls: "last" } }, include: { qmsRecord: true },
    });
    if (!row?.qmsRecord.businessCode) throw new Error("La demo no tiene ninguna desviación abierta de ejemplo: carga los ejemplos de la demo antes de grabar el recorrido.");
    return { qmsRecordId: row.qmsRecordId, code: row.qmsRecord.businessCode };
  }
  const code = `D/TOUR/${marker.slice(-8)}/2097`;
  const row = await prisma.deviation.create({ data: {
    qmsRecord: { create: { recordType: "DEVIATION", businessCode: code, year: 2097 } },
    status: "OPEN", department: { connect: { id: department.id } }, departmentCodeSnapshot: department.code, departmentNameSnapshot: department.name,
    issueDate: new Date("2097-01-01"), whatHappened: `Origen del recorrido de CAPA ${marker}`, createdByText: "Recorrido de CAPA",
  } });
  return { qmsRecordId: row.qmsRecordId, code };
}

/**
 * Otra CAPA que no debe salir en el listado filtrado por la nueva. En la demo, cualquiera de los ejemplos;
 * en la base de pruebas, una mínima con la marca que se borra al terminar.
 */
async function otherCapa(demo: boolean, marker: string, department: { id: string; code: string; name: string }, originCode: string) {
  if (demo) {
    const row = await prisma.capa.findFirst({ where: { status: { not: "DRAFT" }, qmsRecord: { isActive: true, businessCode: { not: null } } }, include: { qmsRecord: true } });
    if (!row?.qmsRecord.businessCode) throw new Error("La demo no tiene ninguna CAPA de ejemplo: carga los ejemplos de la demo antes de grabar el recorrido.");
    return row.qmsRecord.businessCode;
  }
  const code = `AC/TOUR/${marker.slice(-8)}/2097`;
  await prisma.capa.create({ data: {
    qmsRecord: { create: { recordType: "CAPA", businessCode: code, year: 2097 } },
    status: "OPEN", actionType: "CORRECTIVE", department: { connect: { id: department.id } }, departmentCodeSnapshot: department.code, departmentNameSnapshot: department.name,
    openedAt: new Date("2097-01-02"), createdByText: "Recorrido de CAPA", originType: "Desviación", originCode,
    applicableTo: "Otra CAPA del recorrido", defectDescription: `Otra CAPA del recorrido ${marker}`,
  } });
  return code;
}

/** Solo en la base aislada de pruebas: borra lo creado con la marca, también si el recorrido falló a medias. */
async function cleanup(marker: string) {
  const deviations = await prisma.deviation.findMany({ where: { whatHappened: { contains: marker } }, select: { qmsRecordId: true } });
  const capas = await prisma.capa.findMany({ where: { OR: [{ rootCause: { contains: marker } }, { defectDescription: { contains: marker } }] }, select: { qmsRecordId: true } });
  const ids = [...new Set([...deviations, ...capas].map((row) => row.qmsRecordId))];
  if (!ids.length) return;
  await prisma.qmsRelation.deleteMany({ where: { OR: [{ sourceRecordId: { in: ids } }, { targetRecordId: { in: ids } }] } });
  await prisma.changeHistory.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.generatedDocument.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.capaPlannedAction.deleteMany({ where: { capa: { qmsRecordId: { in: ids } } } });
  await prisma.capa.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.deviation.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
}

main().catch((error) => { console.error(error); process.exit(1); });

// Recorrido de Auditorías (D-138): inspección de la autoridad (externa recibida, fuera del programa anual) con el
// código del expediente de la autoridad → dos observaciones → las dos se vinculan a la misma desviación → plan CAPA
// (Anexo IV) con las dos observaciones en un solo bloque. Cada paso comprueba en la base de datos y en el plan
// descargado lo que el usuario ve.
//
//   Prueba (CI):  pnpm tour:audits
//   Vídeo (demo): TOUR_VIDEO_DIR=<carpeta> pnpm tour:audits
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { getZipEntryText, readZip } from "../../src/lib/ooxml/zip";
import { finishTour, startTour, waitForSaved, type Tour } from "./lib";

const madridDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
// Una sola fecha «de hoy» para rellenar y comprobar, aunque el recorrido cruce la medianoche.
const today = madridDay();
// Las plantillas nuevas de los PNT de Auditorías (plan CAPA 04, agrupado por desviación) rigen para las auditorías
// abiertas desde el 15/11/2026 (D-134/D-136); antes de esa fecha, el recorrido abre la inspección el 16/11/2026.
const opened = today >= "2026-11-15" ? today : "2026-11-16";

/** Filas de bloque del plan CAPA: las que tienen texto en la columna «Nº» (A) con una referencia OBS/NC/REC. */
function planBlocks(bytes: Buffer) {
  const sheet = getZipEntryText(readZip(bytes), "xl/worksheets/sheet1.xml");
  const rows = new Map<string, Record<string, string>>();
  for (const [, column, row, body] of sheet.matchAll(/<c r="([A-Z]+)(\d+)"[^>]*t="inlineStr"[^>]*>([\s\S]*?)<\/c>/g)) {
    const text = body.replace(/<[^>]+>/g, "").trim();
    rows.set(row, { ...(rows.get(row) ?? {}), [column]: text });
  }
  return [...rows.values()].filter((cells) => /\b(OBS|NC|REC)\s*\d+/.test(cells.A ?? "")) as { A: string; D?: string }[];
}

async function main() {
  const tour = await startTour("Recorrido Auditorías");
  const { page } = tour;
  const marker = tour.demo ? `REC-${randomUUID().slice(0, 4).toUpperCase()}` : `TOUR-AU-${randomUUID().slice(0, 8)}`;
  let failure: unknown = null;
  try {
    const department = await prisma.department.findFirst({ where: { isActive: true, code: "PM-10" } })
      ?? await prisma.department.findFirstOrThrow({ where: { isActive: true }, orderBy: { code: "asc" } });
    const deviation = await linkedDeviation(tour, marker, department);
    // Código libre del expediente de la autoridad (escenario «Inspección»).
    const code = `INSP-${marker}`;
    const findings = [
      `Registros de limpieza de la compresora sin la verificación del supervisor (ficticio ${marker}).`,
      `El formato de limpieza de la compresora no recoge la hora de inicio y fin (ficticio ${marker}).`,
    ];

    // 1 · Alta de la inspección: externa recibida, escenario Inspección, código libre y fuera del programa anual.
    const audit = await tour.step("1 · Se registra la <b>inspección</b> de la autoridad, con el código de su expediente", async () => {
      await tour.go("/audits");
      await tour.click(page.locator("main a", { hasText: "+ Nueva auditoría" }).first());
      await page.waitForURL(/\/audits\/new/);
      await tour.select(page.locator('select[name="status"]'), "OPEN");
      await tour.select(page.locator('select[name="auditType"]'), "EXTERNAL");
      await tour.select(page.locator('select[name="scenario"]'), "AUTHORITY");
      await tour.fill(page.locator('input[name="businessCode"]'), code);
      await tour.fill(page.locator('input[name="title"]'), `Inspección de normas de correcta fabricación (ficticia ${marker})`);
      await tour.fill(page.locator('textarea[name="scope"]'), "Fabricación de formas sólidas y sistema de calidad.");
      await tour.fill(page.locator('input[name="auditingEntityName"]'), "Autoridad sanitaria (ficticia)");
      await tour.check(page.locator(`label:has-text("${department.code}") input[name="departmentIds"]`).first());
      await tour.select(page.locator('select[name="planningStatus"]'), "OUT_OF_PLAN");
      await tour.fill(page.locator('textarea[name="outsidePlanReason"]'), "Inspección recibida.");
      await tour.fill(page.locator('input[name="openedAt"]'), opened);
      await tour.fill(page.locator('input[name="performedDate"]'), opened);
      await tour.click(page.getByRole("button", { name: "+ Participante" }));
      const participant = page.locator(".audit-participant").last();
      await tour.fill(participant.locator("input").nth(0), "Inspectora jefe (ficticia)");
      await tour.fill(participant.locator("input").nth(2), "Autoridad sanitaria (ficticia)");
      await tour.select(participant.locator("select"), { index: 0 });
      await tour.click(page.getByRole("button", { name: "Guardar auditoría" }));
      await page.waitForURL(/\/audits\/[0-9a-f-]{36}/);
      const row = await waitForSaved(() => prisma.audit.findFirst({ where: { qmsRecord: { businessCode: code } }, include: { qmsRecord: true, departments: true } }), "la inspección");
      assert.equal(row.status, "OPEN");
      assert.equal(row.scenario, "AUTHORITY");
      assert.equal(row.auditType, "EXTERNAL");
      assert.equal(row.planningStatus, "OUT_OF_PLAN");
      assert.deepEqual(row.departments.map((d) => d.departmentId), [department.id]);
      await page.getByText(code).first().waitFor();
      await tour.pause(1500);
      return { id: row.id, qmsRecordId: row.qmsRecordId };
    });

    // 2 · Dos observaciones de la autoridad.
    await tour.step("2 · Se registran las <b>observaciones</b> de la autoridad", async () => {
      await tour.click(page.locator("a", { hasText: /^Hallazgos$/ }).first());
      for (const text of findings) {
        await tour.click(page.locator("a, button", { hasText: "+ Añadir hallazgo / recomendación" }).first());
        await tour.select(page.locator('select[name="criticality"]'), "MAJOR");
        await tour.fill(page.locator('textarea[name="description"]'), text);
        await tour.click(page.getByRole("button", { name: "Guardar hallazgo" }));
        await waitForSaved(() => prisma.auditFinding.findFirst({ where: { auditId: audit.id, description: text } }), "la observación");
        await tour.pause(600);
      }
      const rows = await prisma.auditFinding.findMany({ where: { auditId: audit.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
      assert.deepEqual(rows.map((f) => [f.reference, f.criticality, f.description]), [["OBS 01", "MAJOR", findings[0]], ["OBS 02", "MAJOR", findings[1]]], "OBS 01 y OBS 02 en su orden de alta");
    });

    // 3 · Las dos observaciones se vinculan a la misma desviación.
    await tour.step(`3 · <b>OBS 01</b> y <b>OBS 02</b> se vinculan a la desviación <b>${deviation.code}</b>`, async () => {
      for (const reference of ["OBS 01", "OBS 02"]) {
        const card = page.locator('[id^="audit-finding-"]', { hasText: reference }).first();
        await tour.click(card.locator("a, button", { hasText: "Vincular Desviación / CAPA existente" }));
        const editor = page.locator(".audit-inline-editor").first();
        await tour.fill(editor.locator("input:not([type=hidden])").nth(0), deviation.code);
        await tour.click(editor.locator('[role="option"]', { hasText: deviation.code }).first());
        await tour.click(editor.getByRole("button", { name: "Vincular al hallazgo" }));
        await waitForSaved(() => prisma.auditFindingRelation.findFirst({ where: { isActive: true, finding: { auditId: audit.id, reference }, qmsRelation: { targetRecordId: deviation.qmsRecordId } } }), `el vínculo de ${reference}`);
        await tour.pause(700);
      }
      const links = await prisma.auditFindingRelation.count({ where: { isActive: true, finding: { auditId: audit.id }, qmsRelation: { targetRecordId: deviation.qmsRecordId } } });
      assert.equal(links, 2, "las dos observaciones quedan vinculadas a la desviación");
    });

    // 4 · Plan CAPA (Anexo IV): las dos observaciones en un solo bloque.
    await tour.step("4 · El <b>plan CAPA</b> (Anexo IV) agrupa las dos observaciones en un solo bloque", async () => {
      await tour.go(`/audits/${audit.id}?tab=findings`);
      const link = page.locator("a", { hasText: "Descargar CAPA Plan (estado actual)" }).first();
      const file = await tour.downloadOrUnavailable(link);
      if (file) {
        // Un bloque es una fila con su «Nº» en la columna A: tiene que haber una sola, con OBS 01 y OBS 02, y la
        // desviación en su columna D.
        const blocks = planBlocks(file.bytes);
        assert.equal(blocks.length, 1, `un solo bloque en el plan CAPA (hay ${blocks.length})`);
        assert.ok(blocks[0].A.includes("OBS 01") && blocks[0].A.includes("OBS 02"), "el bloque reúne OBS 01 y OBS 02");
        assert.equal(blocks[0].D, deviation.code, "con la desviación vinculada");
        await tour.showDocument(file.name, file.bytes, "Resultado: <b>OBS 01 y OBS 02 en un solo bloque</b>, con la desviación una sola vez");
      } else {
        // Sin plantilla instalada (CI), la aplicación explica qué falta.
        await page.getByText("Plantilla oficial no disponible").first().waitFor();
      }
    });
    await tour.go(`/audits/${audit.id}?tab=findings`);
    await tour.caption(`Recorrido completado: inspección <b>${code}</b> con sus observaciones vinculadas a <b>${deviation.code}</b>`);
    await tour.pause(3000);
    console.log(`Recorrido de Auditorías correcto: ${code} → ${deviation.code}`);
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
 * Desviación a la que se vinculan las observaciones. En la demo, una desviación abierta de los ejemplos; en la base
 * de pruebas, una ficha mínima con la marca, creada antes de empezar y borrada al terminar.
 */
async function linkedDeviation(tour: Tour, marker: string, department: { id: string; code: string; name: string }) {
  if (tour.demo) {
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
    issueDate: new Date("2097-01-01"), whatHappened: `Desviación del recorrido de Auditorías ${marker}`, createdByText: "Recorrido de Auditorías",
  } });
  return { qmsRecordId: row.qmsRecordId, code };
}

/** Solo en la base aislada de pruebas: borra lo creado con la marca, también si el recorrido falló a medias. */
async function cleanup(marker: string) {
  const audits = await prisma.audit.findMany({ where: { qmsRecord: { businessCode: `INSP-${marker}` } }, select: { id: true, qmsRecordId: true } });
  const deviations = await prisma.deviation.findMany({ where: { whatHappened: { contains: marker } }, select: { qmsRecordId: true } });
  const auditIds = audits.map((a) => a.id);
  const ids = [...audits.map((a) => a.qmsRecordId), ...deviations.map((d) => d.qmsRecordId)];
  if (!ids.length) return;
  await prisma.auditFindingRelation.deleteMany({ where: { finding: { auditId: { in: auditIds } } } });
  await prisma.auditFindingAction.deleteMany({ where: { finding: { auditId: { in: auditIds } } } });
  await prisma.auditFinding.deleteMany({ where: { auditId: { in: auditIds } } });
  await prisma.auditCapaPlanVersion.deleteMany({ where: { auditId: { in: auditIds } } });
  await prisma.auditFollowup.deleteMany({ where: { auditId: { in: auditIds } } });
  await prisma.auditParticipant.deleteMany({ where: { auditId: { in: auditIds } } });
  await prisma.auditDepartment.deleteMany({ where: { auditId: { in: auditIds } } });
  await prisma.qmsRelation.deleteMany({ where: { OR: [{ sourceRecordId: { in: ids } }, { targetRecordId: { in: ids } }] } });
  await prisma.changeHistory.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.generatedDocument.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.audit.deleteMany({ where: { id: { in: auditIds } } });
  await prisma.deviation.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
}

main().catch((error) => { console.error(error); process.exit(1); });

// Recorrido de OOS (D-138): alta del resultado fuera de especificación → Fase I (evaluación e investigación en el
// laboratorio) sin error de laboratorio → vínculo con una CAPA → Fase II (investigación a gran escala), resultado
// confirmado y cierre → Anexos III y IV y listado anual (Anexo VI, Word). Cada paso comprueba en la base de datos y en
// los documentos lo que el usuario ve.
//
//   Prueba (CI):  pnpm tour:oos
//   Vídeo (demo): TOUR_VIDEO_DIR=<carpeta> pnpm tour:oos
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { templateAssetReady } from "../../src/modules/configuration/template-readiness";
import { finishTour, ooxmlText, startTour, waitForSaved, type Tour } from "./lib";

const madridDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
// Una sola fecha «de hoy» para rellenar y comprobar, aunque el recorrido cruce la medianoche.
const today = madridDay();

// Los 21 parámetros de la evaluación de la Fase I (PNT GC-10/014/04).
const EVALUATION = [
  "analystTraining", "methodCorrect", "analystDialogue", "rawDataCorrect", "calculationsCorrect",
  "samplingCorrect", "sampleStorageCorrect", "sampleUsedCorrect", "sampleQuantityCorrect",
  "equipmentOperation", "equipmentVerified", "equipmentCalibrated", "equipmentProgram",
  "reagentsCorrect", "reagentsPreparation", "reagentsExpiry", "reagentsQuantity", "reagentsStorage",
  "microEnvironmentWater", "microGrowthPromotion", "microNegativeControl",
];

/** Plantilla que usará la ruta: la vigente en la fecha de emisión del OOS (loadOosTemplate). */
async function oosTemplateReady(documentType: "OOS_ANNEX_III" | "OOS_ANNEX_IV" | "OOS_ANNEX_VI", on: Date) {
  const candidates = await prisma.templateVersion.findMany({ where: { module: "OOS", documentType }, orderBy: { effectiveFrom: "asc" }, select: { fileName: true, filePath: true, checksum: true, effectiveFrom: true } });
  const selected = candidates.filter((item) => item.effectiveFrom <= on).at(-1) ?? candidates[0];
  return selected ? templateAssetReady(selected) : false;
}

async function main() {
  const tour = await startTour("Recorrido OOS");
  const { page } = tour;
  const marker = tour.demo ? `REC-${randomUUID().slice(0, 4).toUpperCase()}` : `TOUR-OOS-${randomUUID().slice(0, 8)}`;
  let failure: unknown = null;
  try {
    const department = await prisma.department.findFirst({ where: { isActive: true, code: "PM-10" } })
      ?? await prisma.department.findFirstOrThrow({ where: { isActive: true }, orderBy: { code: "asc" } });
    const capa = await linkedCapa(tour, marker, department);
    const detection = `Valoración de principio activo del lote ficticio ${marker}: 92,1 % frente a la especificación 95,0–105,0 %.`;
    const findOos = () => prisma.oosRecord.findFirst({ where: { detectionDescription: detection }, include: { qmsRecord: true } });

    // 1 · Alta: identificación y datos iniciales; al guardarlo abierto recibe su código OOS/MD/…
    const opened = await tour.step("1 · Se registra el <b>resultado fuera de especificación</b> (OOS)", async () => {
      await tour.go("/oos");
      await tour.click(page.locator("main a", { hasText: "+ Nuevo OOS" }).first());
      await page.waitForURL(/\/oos\/new/);
      await tour.select(page.locator('select[name="area"]'), "MD");
      await tour.select(page.locator('select[name="departmentId"]'), department.id);
      await tour.fill(page.locator('input[name="issueDate"]'), today);
      const author = page.locator('input[name="createdByText"]');
      if (await author.getAttribute("readonly") === null && !(await author.inputValue())) await tour.fill(author, "Control de Calidad (ficticio)");
      await tour.select(page.locator('select[name="materialKind"]'), "FINISHED_PRODUCT");
      await tour.fill(page.locator('input[name="materialName"]'), "Comprimidos de ejemplo 500 mg (ficticio)");
      await tour.fill(page.locator('input[name="lotNumber"]'), `L-${marker}`);
      await tour.fill(page.locator('input[name="process"]'), "Control de producto terminado · valoración por HPLC");
      await tour.fill(page.locator('input[name="oosDate"]'), today);
      await tour.fill(page.locator('input[name="oosTime"]'), "10:15");
      await tour.fill(page.locator('input[name="detectedBy"]'), "Analista de Control de Calidad (ficticio)");
      await tour.fill(page.locator('textarea[name="detectionDescription"]'), detection);
      await tour.select(page.locator('select[name="status"]'), "OPEN");
      await tour.click(page.getByRole("button", { name: /^Guardar/ }));
      await page.waitForURL(/\/oos\/[0-9a-f-]{36}(\?|$)/);
      const row = await waitForSaved(findOos, "el OOS");
      assert.equal(row.status, "OPEN");
      assert.equal(row.area, "MD");
      assert.match(row.qmsRecord.businessCode ?? "", /^OOS\/MD\//, "recibe el código OOS/MD/…");
      assert.equal(row.lotNumber, `L-${marker}`);
      const code = row.qmsRecord.businessCode ?? "";
      await page.getByText(code).first().waitFor();
      await tour.pause(1200);
      return { id: row.id, qmsRecordId: row.qmsRecordId, code };
    });

    // 2 · Fase I: evaluación de los 21 parámetros e investigación en el laboratorio; sin error de laboratorio.
    await tour.step("2 · <b>Fase I</b>: evaluación en el laboratorio; no hay error de laboratorio", async () => {
      await tour.click(page.locator("main a", { hasText: "Editar / seguimiento" }).first());
      await page.waitForURL(/\/edit/);
      for (const key of EVALUATION) await tour.fill(page.locator(`input[name="evaluation.${key}"]`), "Correcto");
      await tour.fill(page.locator('textarea[name="phaseIInvestigation"]'), "Se revisaron analista, muestra, equipo y reactivos sin encontrar desviaciones. La repetición de la preparación confirma el resultado.");
      await tour.fill(page.locator('textarea[name="phaseIConclusion"]'), "No se identifica error de laboratorio. Se pasa a investigación a gran escala.");
      await tour.select(page.locator('select[name="phaseIDisposition"]'), "FULL_SCALE");
      await tour.click(page.getByRole("button", { name: /^Guardar/ }));
      await page.waitForURL(/\/oos\/[0-9a-f-]{36}(\?|$)/);
      const row = await waitForSaved(async () => { const r = await prisma.oosRecord.findUnique({ where: { id: opened.id } }); return r?.phaseIDisposition === "FULL_SCALE" ? r : null; }, "la Fase I");
      const evaluation = row.phaseIEvaluation as Record<string, string> | null;
      assert.deepEqual(EVALUATION.map((key) => evaluation?.[key]), EVALUATION.map(() => "Correcto"), "se guardan los 21 parámetros de la evaluación");
      assert.equal(row.status, "OPEN");
      await tour.pause(1200);
    });

    // 3 · Relaciones: el OOS se vincula a la CAPA que lo trata.
    await tour.step(`3 · El OOS se vincula a la <b>CAPA ${capa.code}</b>`, async () => {
      await tour.go(`/oos/${opened.id}?tab=relations`);
      const form = page.locator("form.relation-form").first();
      await tour.select(form.locator("select").first(), "CAPA");
      await tour.fill(form.locator(".relation-code-field input:not([type=hidden])").first(), capa.code);
      await tour.click(form.locator('[role="option"]', { hasText: capa.code }).first());
      await tour.click(form.getByRole("button", { name: "Vincular expediente" }));
      await waitForSaved(() => prisma.qmsRelation.findFirst({ where: { isActive: true, sourceRecordId: opened.qmsRecordId, targetRecordId: capa.qmsRecordId } }), "el vínculo con la CAPA");
      await page.locator("main a", { hasText: capa.code }).first().waitFor();
      await tour.pause(1200);
    });

    // 4 · Fase II: investigación a gran escala, resultado confirmado, dictamen y cierre.
    await tour.step("4 · <b>Fase II</b>: investigación a gran escala, resultado <b>confirmado</b> y cierre", async () => {
      await tour.click(page.locator("main a", { hasText: "Editar / seguimiento" }).first());
      await page.waitForURL(/\/edit/);
      await tour.fill(page.locator('input[name="phaseIIIssueDate"]'), today);
      await tour.fill(page.locator('textarea[name="phaseIIProductionReview"]'), "La revisión del registro de fabricación muestra una pesada de principio activo en el límite inferior de tolerancia.");
      await tour.fill(page.locator('textarea[name="phaseIIRetesting"]'), "La repetición por un segundo analista confirma 92,3 %.");
      await tour.fill(page.locator('textarea[name="phaseIIResampling"]'), "El remuestreo del lote da resultados equivalentes.");
      await tour.fill(page.locator('textarea[name="phaseIIConclusion"]'), "Resultado fuera de especificación confirmado, de origen en fabricación.");
      await tour.select(page.locator('select[name="phaseIIVerdict"]'), "REJECTED");
      await tour.fill(page.locator('input[name="phaseIIIssuedBy"]'), "Garantía de Calidad (ficticio)");
      await tour.fill(page.locator('input[name="phaseIIIssuedAt"]'), today);
      await tour.fill(page.locator('textarea[name="phaseIIAffectedDepartments"]'), "Producción y Control de Calidad.");
      await tour.select(page.locator('select[name="investigationResult"]'), "CONFIRMED");
      await tour.check(page.locator('input[name="rootCauseCategories"][value="METHOD"]'));
      await tour.fill(page.locator('input[name="closedAt"]'), today);
      await tour.select(page.locator('select[name="status"]'), "CLOSED");
      await tour.click(page.getByRole("button", { name: /^Guardar/ }));
      await page.waitForURL(/\/oos\/[0-9a-f-]{36}(\?|$)/);
      const row = await waitForSaved(async () => { const r = await prisma.oosRecord.findUnique({ where: { id: opened.id } }); return r?.status === "CLOSED" ? r : null; }, "el cierre del OOS");
      assert.equal(row.investigationResult, "CONFIRMED");
      assert.equal(row.phaseIIVerdict, "REJECTED");
      assert.equal(row.closedAt?.toISOString().slice(0, 10), today);
      assert.deepEqual(row.rootCauseCategories, ["METHOD"]);
      assert.equal(row.detectionDescription, detection, "la detección no cambia al cerrar");
      await tour.pause(1500);
    });

    // 5 · Documentos: Anexo III (Fase I), Anexo IV (Fase II) y listado anual (Anexo VI).
    await tour.step("5 · Los documentos salen del expediente: <b>Anexos III y IV</b> y listado anual", async () => {
      await tour.go(`/oos/${opened.id}?tab=documents`);
      const issued = new Date(today);
      for (const [label, type, expected] of [
        ["Generar Anexo III", "OOS_ANNEX_III", [opened.code, `L-${marker}`]],
        ["Generar Anexo IV", "OOS_ANNEX_IV", [opened.code, "Resultado fuera de especificación confirmado"]],
      ] as const) {
        const link = page.locator("main a", { hasText: label }).first();
        if (await oosTemplateReady(type, issued)) {
          const file = await tour.download(link);
          const text = ooxmlText(file.bytes, /^word\/document\.xml$/);
          for (const value of expected) assert.ok(text.includes(value), `${label.replace("Generar ", "")} contiene «${value}»`);
          if (type === "OOS_ANNEX_IV") await tour.showDocument(file.name, file.bytes, `<b>Anexo IV</b> de ${opened.code}: investigación a gran escala`);
        } else {
          // Sin plantilla instalada (CI), generar el anexo explica qué falta y cómo instalarla.
          await tour.click(link);
          await page.getByText("Plantilla oficial no disponible").first().waitFor();
          await tour.go(`/oos/${opened.id}?tab=documents`);
        }
      }
      await tour.go(`/oos?q=${encodeURIComponent(opened.code)}`);
      await page.locator("tr", { hasText: opened.code }).first().waitFor();
      await tour.click(page.locator("summary", { hasText: "Exportar" }));
      const year = today.slice(0, 4);
      // El Anexo VI es un Word anual; la ruta usa la plantilla vigente a 31 de diciembre de ese año.
      if (await oosTemplateReady("OOS_ANNEX_VI", new Date(Date.UTC(Number(year), 11, 31)))) {
        const list = await tour.download(page.locator("a", { hasText: `Anexo VI oficial · año ${year}` }).first());
        const listText = ooxmlText(list.bytes, /^word\/document\.xml$/);
        assert.ok(listText.includes(opened.code), `el Anexo VI de ${year} contiene el OOS`);
        await tour.caption(`El <b>Anexo VI</b> de ${year} incluye <b>${opened.code}</b>`);
      } else {
        await page.getByText("Anexo VI bloqueado").first().waitFor();
      }
      await page.keyboard.press("Escape");
      await tour.pause(2500);
    });
    await tour.caption(`Recorrido completado: <b>${opened.code}</b> investigado, confirmado, vinculado a su CAPA y cerrado`);
    await tour.pause(3000);
    console.log(`Recorrido de OOS correcto: ${opened.code} → ${capa.code}`);
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
 * CAPA a la que se vincula el OOS. En la demo, una CAPA abierta de los ejemplos (el recorrido no escribe en la
 * demo fuera de la interfaz); en la base de pruebas, una ficha mínima con la marca que se borra al terminar.
 */
async function linkedCapa(tour: Tour, marker: string, department: { id: string; code: string; name: string }) {
  if (tour.demo) {
    const row = await prisma.capa.findFirst({ where: { status: "OPEN", qmsRecord: { isActive: true, businessCode: { not: null } }, NOT: { rootCause: { contains: "(REC-" } } }, include: { qmsRecord: true }, orderBy: { openedAt: "desc" } });
    if (!row?.qmsRecord.businessCode) throw new Error("La demo no tiene ninguna CAPA abierta de ejemplo: carga los ejemplos de la demo antes de grabar el recorrido.");
    return { qmsRecordId: row.qmsRecordId, code: row.qmsRecord.businessCode };
  }
  const code = `AC/TOUR/${marker.slice(-8)}/2097`;
  const row = await prisma.capa.create({ data: {
    qmsRecord: { create: { recordType: "CAPA", businessCode: code, year: 2097 } },
    status: "OPEN", actionType: "CORRECTIVE", department: { connect: { id: department.id } }, departmentCodeSnapshot: department.code, departmentNameSnapshot: department.name,
    openedAt: new Date("2097-01-02"), createdByText: "Recorrido de OOS", originType: "OOS", applicableTo: "CAPA del recorrido de OOS", defectDescription: `CAPA del recorrido ${marker}`,
  } });
  return { qmsRecordId: row.qmsRecordId, code };
}

/** Solo en la base aislada de pruebas: borra lo creado con la marca, también si el recorrido falló a medias. */
async function cleanup(marker: string) {
  const oos = await prisma.oosRecord.findMany({ where: { OR: [{ detectionDescription: { contains: marker } }, { lotNumber: { contains: marker } }] }, select: { qmsRecordId: true } });
  const capas = await prisma.capa.findMany({ where: { defectDescription: { contains: marker } }, select: { qmsRecordId: true } });
  const ids = [...new Set([...oos, ...capas].map((row) => row.qmsRecordId))];
  if (!ids.length) return;
  await prisma.qmsRelation.deleteMany({ where: { OR: [{ sourceRecordId: { in: ids } }, { targetRecordId: { in: ids } }] } });
  await prisma.changeHistory.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.generatedDocument.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.oosRecord.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.capaPlannedAction.deleteMany({ where: { capa: { qmsRecordId: { in: ids } } } });
  await prisma.capa.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
}

main().catch((error) => { console.error(error); process.exit(1); });

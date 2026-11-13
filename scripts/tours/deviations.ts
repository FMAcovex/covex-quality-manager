// Recorrido de Desviaciones (D-138): alta en borrador → investigación con Ishikawa → causa raíz,
// clasificación e impacto → CAPA propuesta → apertura → CAPA creada desde la propuesta → Anexo III y
// listados. Cada paso comprueba en la base de datos y en los documentos lo que el usuario ve.
//
//   Prueba (CI):  pnpm tour:deviations
//   Vídeo (demo): TOUR_VIDEO_DIR=<carpeta> pnpm tour:deviations
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { finishTour, ooxmlText, startTour } from "./lib";

const madridDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

async function main() {
  const tour = await startTour("Recorrido Desviaciones");
  const { page } = tour;
  // La marca identifica lo creado por el recorrido; en la demo se ve como un texto más.
  const marker = tour.demo ? `REC-${randomUUID().slice(0, 4).toUpperCase()}` : `TOUR-DEV-${randomUUID().slice(0, 8)}`;
  let failure: unknown = null;
  try {
    const department = await prisma.department.findFirst({ where: { isActive: true, code: "PM-10" } })
      ?? await prisma.department.findFirstOrThrow({ where: { isActive: true }, orderBy: { code: "asc" } });
    const what = `Durante la compresión del lote ficticio ${marker} la alarma de peso medio no saltó con comprimidos fuera de límite.`;
    const rootCause = `Límite de alarma de peso del equipo configurado con la tolerancia del producto anterior (${marker}).`;
    const capaAction = `Bloquear la edición de límites de alarma sin verificación de un segundo técnico (${marker}).`;

    // 1 · Alta en borrador: identificación, origen, descripción y acción inmediata.
    await tour.step("1 · Se registra la desviación: <b>qué pasó</b>, dónde y la <b>acción inmediata</b>", async () => {
      await tour.go("/deviations");
      await tour.click(page.locator("a", { hasText: "+ Nueva desviación" }));
      await page.waitForURL(/\/deviations\/new/);
      await tour.select(page.locator('select[name="departmentId"]'), department.id);
      await tour.fill(page.locator('input[name="issueDate"]'), madridDay());
      await tour.fill(page.locator('input[name="eventDateTime"]'), `${madridDay(-1)}T09:30`);
      await tour.fill(page.locator('input[name="detectedBy"]'), "Operario de compresión (ficticio)");
      const author = page.locator('input[name="createdByText"]');
      if (await author.getAttribute("readonly") === null && !(await author.inputValue())) await tour.fill(author, "Garantía de Calidad (ficticio)");
      await tour.fill(page.locator('input[name="materialProcessAffected"]'), "Compresión, prensa rotativa P-02");
      await tour.check(page.locator('input[name="provenance"][value="EQUIPMENT_LINE"]'));
      await tour.fill(page.locator('input[name="affectedEquipmentLine"]'), "Prensa rotativa P-02");
      await tour.fill(page.locator('textarea[name="affectedDocumentation"]'), "Registro de control en proceso del lote");
      await tour.fill(page.locator('textarea[name="whatHappened"]'), what);
      await tour.fill(page.locator('textarea[name="whoInvolved"]'), "Operario de compresión y técnico de mantenimiento.");
      await tour.fill(page.locator('textarea[name="whenHappened"]'), "En el control de peso de las 09:30.");
      await tour.fill(page.locator('textarea[name="whereHappened"]'), "Sala de compresión 1.");
      await tour.fill(page.locator('textarea[name="howHappened"]'), "En el control manual de peso medio del operario.");
      await tour.click(page.getByRole("button", { name: "+ Añadir acción inmediata" }));
      const action = page.locator(".dynamic-row.with-user").first();
      await tour.fill(action.getByLabel("Acción ejecutada"), "Parada de la prensa y lote retenido en cuarentena.");
      await tour.fill(action.getByLabel("Ejecutada por"), "Supervisor de turno (ficticio)");
      await tour.fill(action.getByLabel("Fecha"), madridDay(-1));
      await tour.click(page.getByRole("button", { name: "Guardar borrador" }));
      await page.waitForURL(/\/deviations\/[0-9a-f-]{36}(\?|$)/);
      const saved = await prisma.deviation.findFirstOrThrow({ where: { whatHappened: what }, include: { immediateActions: true } });
      assert.equal(saved.status, "DRAFT", "se guarda como borrador");
      assert.equal(saved.departmentId, department.id);
      assert.equal(saved.provenance, "EQUIPMENT_LINE");
      assert.deepEqual(saved.immediateActions.map((a) => a.description), ["Parada de la prensa y lote retenido en cuarentena."]);
      assert.equal(saved.rootCause ?? "", "", "el borrador aún no tiene causa raíz");
      await page.locator("a", { hasText: "Editar borrador" }).first().waitFor();
    });

    // 2 · Investigación: Ishikawa (6M); solo una causa confirmada pasa a «Causa raíz».
    await tour.step("2 · Investigación con <b>Ishikawa (6M)</b>: la causa <b>confirmada</b> pasa a causa raíz", async () => {
      await tour.click(page.locator("a", { hasText: "Editar borrador" }).first());
      await page.waitForURL(/\/edit/);
      await tour.fill(page.locator('textarea[name="investigation"]'), "Se revisó la configuración de la prensa y el historial de cambios de formato. El límite de alarma no se actualizó al cambiar de producto.");
      await tour.select(page.locator('select[name="investigationConclusive"]'), "YES");
      const tools = page.locator("details.investigation-tools");
      await tour.click(tools.locator("summary"));
      await tour.click(tools.getByRole("button", { name: "Ishikawa (6M)", exact: true }));
      await tour.click(tools.getByRole("button", { name: "+ Añadir causa en Máquina" }));
      const cause = tools.locator(".investigation-cause-row").first();
      await tour.fill(cause.locator("textarea").first(), rootCause);
      await tour.fill(cause.locator("textarea").nth(1), "Parámetros de la prensa y registro de cambio de formato.");
      const use = cause.getByRole("button", { name: /como causa raíz$/ });
      assert.equal(await use.isDisabled(), true, "una hipótesis no puede pasar a causa raíz");
      await tour.select(cause.locator("select"), "CONFIRMED");
      await tour.click(use);
      assert.equal(await page.locator('textarea[name="rootCause"]').inputValue(), rootCause);
      assert.equal(await page.locator('input[name="rootCauseCategories"][value="MACHINE"]').isChecked(), true, "propone la categoría 6M");
      assert.equal(await page.locator('input[name="investigationMethods"][value="ISHIKAWA"]').isChecked(), true, "marca la herramienta usada");
      await tour.select(page.locator('select[name="recurrentRootCause"]'), "NO");
      await tour.fill(page.locator('textarea[name="recurrenceDetails"]'), "Sin antecedentes con esta causa en los últimos 12 meses.");
    });

    // 3 · Clasificación e impacto.
    await tour.step("3 · <b>Clasificación</b> y <b>evaluación de impacto</b>", async () => {
      await tour.select(page.locator('select[name="classification"]'), "MINOR");
      for (const field of ["validationImpact", "registrationImpact", "stabilityImpact", "otherProcessesImpact", "affectsFinishedProduct"]) {
        await tour.select(page.locator(`select[name="${field}"]`), "NO");
      }
      await tour.fill(page.locator('textarea[name="otherProcessesImpactDetails"]'), "Los comprimidos fuera de límite se separaron en el control; el resto del lote cumple.");
    });

    // 4 · CAPA propuesta, derivada de la causa raíz.
    await tour.step("4 · Desde la causa raíz se propone la <b>CAPA</b>", async () => {
      await tour.select(page.locator('select[name="capaRequired"]'), "true");
      await tour.click(page.getByRole("button", { name: "+ Añadir CAPA propuesta" }));
      const plan = page.locator(".dynamic-row.capa").first();
      await tour.fill(plan.getByLabel("Acción CAPA propuesta"), capaAction);
      await tour.fill(plan.getByLabel("Fecha prevista"), madridDay(30));
      await tour.fill(plan.getByRole("textbox", { name: "Responsable", exact: true }), "Responsable de Mantenimiento (ficticio)");
    });

    // 5 · Conclusión y apertura: la desviación recibe su código.
    const opened = await tour.step("5 · Se completa y se <b>abre la desviación</b>: recibe su código", async () => {
      await tour.fill(page.locator('textarea[name="conclusion"]'), "Desviación menor con causa raíz confirmada; se abre CAPA correctiva.");
      await tour.select(page.locator('select[name="disposition"]'), "Rechazado – Destruir");
      await tour.fill(page.locator('input[name="dispositionQuantity"]'), "120 comprimidos");
      await tour.select(page.locator('select[name="clientNotification"]'), "NA");
      await tour.fill(page.locator('textarea[name="dispositionComments"]'), "Comprimidos fuera de límite destruidos según procedimiento.");
      await tour.select(page.locator('select[name="dataQualityStatus"]'), "COMPLETE");
      await tour.click(page.getByRole("button", { name: "Abrir desviación" }));
      await page.waitForURL(/\/deviations\/[0-9a-f-]{36}(\?|$)/);
      const row = await prisma.deviation.findFirstOrThrow({ where: { whatHappened: what }, include: { qmsRecord: true, capaPlans: true } });
      assert.equal(row.status, "OPEN", "la desviación queda abierta");
      assert.match(row.qmsRecord.businessCode ?? "", /^D\//, "recibe el código D/…");
      assert.equal(row.rootCause, rootCause);
      assert.deepEqual(row.rootCauseCategories, ["MACHINE"]);
      assert.ok(row.investigationMethods.includes("ISHIKAWA"));
      assert.equal(row.classification, "MINOR");
      assert.equal(row.whatHappened, what, "la descripción del evento no cambia al completar investigación y causa raíz");
      assert.deepEqual(row.capaPlans.map((p) => [p.actionType, p.description, p.linkedCapaRecordId]), [["CORRECTIVE", capaAction, null]]);
      await page.getByText(row.qmsRecord.businessCode ?? "").first().waitFor();
      await tour.pause(1500);
      return { ...row, code: row.qmsRecord.businessCode ?? "" };
    });
    const code = opened.code;
    let capaCode = "";

    // 6 · La CAPA se crea desde la propuesta y queda vinculada.
    await tour.step(`6 · La propuesta se convierte en <b>CAPA</b> vinculada a <b>${code}</b>`, async () => {
      await tour.click(page.locator("main a", { hasText: "Crear CAPA" }).first());
      await page.waitForURL(/\/capa\/new/);
      assert.equal(await page.locator('textarea[name="rootCause"]').inputValue(), rootCause, "la CAPA hereda la causa raíz");
      const description = page.locator("textarea").filter({ hasText: capaAction });
      assert.equal(await description.count(), 1, "la CAPA hereda la acción propuesta");
      await tour.pause(1200);
      // Para abrirla, el formulario de CAPA pide seguimiento, eficacia, estado, conclusión y próximo seguimiento.
      await tour.fill(page.locator('textarea[name="actionFollowupObservations"]'), "Pendiente de ejecutar la acción.");
      await tour.fill(page.locator('textarea[name="operationalStatusDescription"]'), "Acción planificada.");
      await tour.fill(page.locator('textarea[name="effectivenessAssessment"]'), "Se verificará con tres cambios de formato sin incidencias.");
      await tour.fill(page.locator('textarea[name="conclusion"]'), "Pendiente de verificar la eficacia.");
      await tour.fill(page.locator('input[name="nextFollowupDate"]'), madridDay(30));
      await tour.select(page.locator('select[name="status"]'), "OPEN");
      await tour.click(page.getByRole("button", { name: "Guardar CAPA" }));
      await page.waitForURL(/\/capa\/[0-9a-f-]{36}(\?|$)/);
      const plan = await prisma.deviationCapaPlan.findFirstOrThrow({ where: { deviationId: opened.id }, include: { linkedCapaRecord: true } });
      assert.ok(plan.linkedCapaRecord, "la propuesta queda vinculada a la CAPA abierta");
      assert.match(plan.linkedCapaRecord.businessCode ?? "", /^AC\//, "la CAPA correctiva recibe su código AC/…");
      assert.equal(plan.businessCapaCode, plan.linkedCapaRecord.businessCode);
      const capa = await prisma.capa.findUniqueOrThrow({ where: { qmsRecordId: plan.linkedCapaRecord.id } });
      assert.equal(capa.rootCause, rootCause, "la CAPA hereda la causa raíz");
      assert.equal(capa.originCode, code, "el origen de la CAPA es la desviación");
      const relation = await prisma.qmsRelation.count({ where: { OR: [
        { sourceRecordId: opened.qmsRecordId, targetRecordId: plan.linkedCapaRecord.id },
        { sourceRecordId: plan.linkedCapaRecord.id, targetRecordId: opened.qmsRecordId },
      ] } });
      assert.equal(relation, 1, "desviación y CAPA quedan relacionadas");
      capaCode = plan.linkedCapaRecord.businessCode ?? "";
      await page.getByText(code).first().waitFor();
      await tour.pause(1500);
    });

    // 7 · Documentos generados desde el expediente.
    await tour.step(`7 · Los documentos salen del expediente: <b>Anexo III</b> y listado`, async () => {
      await tour.go(`/deviations/${opened.id}`);
      await page.locator("main a", { hasText: capaCode }).first().waitFor();
      const annexIII = page.locator("main a", { hasText: "Generar Anexo III" }).first();
      // TPL1: con la plantilla instalada se genera y se comprueba el contenido; sin ella (CI: el repositorio no
      // lleva las plantillas reales), la ficha no ofrece el anexo y explica qué falta.
      const file = await tour.downloadOrMissing(annexIII, "Anexo III");
      if (file) {
        const text = ooxmlText(file.bytes, /^word\/document\.xml$/);
        for (const expected of [code, marker, "Prensa rotativa P-02"]) assert.ok(text.includes(expected), `el Anexo III contiene «${expected}»`);
        await tour.showDocument(file.name, file.bytes, `<b>Anexo III</b> de ${code}, cumplimentado sobre la plantilla oficial`);
      }
      await tour.go(`/deviations?q=${encodeURIComponent(code)}`);
      await page.locator("tr", { hasText: code }).first().waitFor();
      await tour.click(page.locator("summary", { hasText: "Exportar" }));
      const list = await tour.download(page.locator("a", { hasText: "Listado simple · filtros actuales" }));
      const listText = ooxmlText(list.bytes, /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/);
      assert.ok(listText.includes(code), "el listado filtrado contiene la desviación");
      await tour.page.keyboard.press("Escape");
      await tour.caption(`El listado filtrado se descarga en Excel con <b>${code}</b>`);
      await tour.pause(2500);
    });
    await tour.caption(`Recorrido completado: <b>${code}</b> registrada, investigada y con su CAPA <b>${capaCode}</b>`);
    await tour.pause(3000);
    console.log(`Recorrido de Desviaciones correcto: ${code} → ${capaCode}`);
  } catch (error) {
    failure = error;
  }
  // Cierre, limpieza y desconexión se ejecutan siempre; si un paso falló, su error es el que se informa.
  await finishTour(failure, [
    () => tour.close(),
    async () => { if (!tour.demo) await cleanup(marker); },
    () => prisma.$disconnect(),
  ]);
}

/** Solo en la base aislada de pruebas: borra lo creado con la marca, también si el recorrido falló a medias. */
async function cleanup(marker: string) {
  const deviations = await prisma.deviation.findMany({ where: { whatHappened: { contains: marker } }, select: { qmsRecordId: true, capaPlans: { select: { linkedCapaRecordId: true } } } });
  const capas = await prisma.capa.findMany({ where: { OR: [{ rootCause: { contains: marker } }, { defectDescription: { contains: marker } }] }, select: { qmsRecordId: true } });
  const ids = [...new Set([
    ...deviations.map((row) => row.qmsRecordId),
    ...deviations.flatMap((row) => row.capaPlans.map((plan) => plan.linkedCapaRecordId)).filter((id): id is string => Boolean(id)),
    ...capas.map((row) => row.qmsRecordId),
  ])];
  if (!ids.length) return;
  await prisma.qmsRelation.deleteMany({ where: { OR: [{ sourceRecordId: { in: ids } }, { targetRecordId: { in: ids } }] } });
  await prisma.changeHistory.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.generatedDocument.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.capaPlannedAction.deleteMany({ where: { capa: { qmsRecordId: { in: ids } } } });
  await prisma.capa.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.deviationCapaPlan.deleteMany({ where: { deviation: { qmsRecordId: { in: ids } } } });
  await prisma.deviation.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
}

main().catch((error) => { console.error(error); process.exit(1); });

// Recorrido de Controles de cambios (D-138): solicitud (Anexo III) en borrador → dictamen (Anexo IV) con plan de
// ejecución, aprobado y abierto → seguimiento 01 con una acción completada y el cambio abierto → seguimiento 02
// con todo ejecutado, eficacia aceptable y cierre → anexos y listado filtrado. Cada paso comprueba en la base de
// datos y en los documentos lo que el usuario ve.
//
//   Prueba (CI):  pnpm tour:changes
//   Vídeo (demo): TOUR_VIDEO_DIR=<carpeta> pnpm tour:changes
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Locator } from "playwright";
import { prisma } from "../../src/lib/db";
import { finishTour, ooxmlText, startTour, waitForSaved, type Tour } from "./lib";

const madridDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
// Una sola fecha «de hoy» para rellenar y comprobar, aunque el recorrido cruce la medianoche.
const today = madridDay();

async function main() {
  const tour = await startTour("Recorrido Controles de cambios");
  const { page } = tour;
  const marker = tour.demo ? `REC-${randomUUID().slice(0, 4).toUpperCase()}` : `TOUR-CC-${randomUUID().slice(0, 8)}`;
  let failure: unknown = null;
  try {
    const department = await prisma.department.findFirst({ where: { isActive: true, code: "PM-10" } })
      ?? await prisma.department.findFirstOrThrow({ where: { isActive: true }, orderBy: { code: "asc" } });
    const description = `Sustituir la balanza de la sala de pesadas 2 por un modelo con impresora integrada (ficticio ${marker}).`;
    const actions = [
      "Cualificar la nueva balanza (IQ/OQ) y registrarla en el inventario de equipos.",
      "Actualizar el PNT de pesada con el nuevo modelo y formar al personal.",
    ];
    // Otro control de cambios que el listado filtrado no debe incluir: existe antes de descargarlo.
    const other = await otherChangeCode(tour, marker, department);
    const findChange = () => prisma.changeControl.findFirst({ where: { description }, include: { qmsRecord: true, tasks: { orderBy: { sortOrder: "asc" } } } });

    // 1 · Solicitud: qué se cambia, por qué y quién lo pide; se acepta para evaluarla.
    await tour.step("1 · <b>Solicitud de cambio</b> (Anexo III): qué, por qué y quién lo pide", async () => {
      await tour.go("/changes");
      await tour.click(page.locator("main a", { hasText: "+ Nuevo Control de Cambio" }).first());
      await page.waitForURL(/\/changes\/new/);
      await tour.fill(page.locator('input[name="requestDate"]'), today);
      await tour.select(page.locator('select[name="departmentId"]'), department.id);
      await tour.check(page.locator('input[name="scope"][value="EQUIPMENT"]'));
      await tour.check(page.locator('input[name="scope"][value="DOCUMENTATION"]'));
      await tour.fill(page.locator('input[name="requesterName"]'), "Responsable de Producción (ficticio)");
      await tour.fill(page.locator('input[name="requesterPosition"]'), "Jefe de Producción");
      await tour.fill(page.locator('textarea[name="description"]'), description);
      await tour.fill(page.locator('textarea[name="justification"]'), "La balanza actual no imprime el ticket de pesada y obliga a transcribir los datos a mano.");
      await tour.fill(page.locator('textarea[name="providedDocuments"]'), "Oferta y ficha técnica del fabricante.");
      await tour.select(page.locator('select[name="requestDecision"]'), "ACCEPTED");
      await tour.fill(page.locator('input[name="requestDecisionResponsible"]'), "Dirección Técnica (ficticio)");
      await tour.fill(page.locator('input[name="requestDecisionRole"]'), "Director Técnico");
      await tour.fill(page.locator('input[name="requestDecisionDate"]'), today);
      await tour.click(page.getByRole("button", { name: "Guardar borrador" }));
      await page.waitForURL(/\/changes\/[0-9a-f-]{36}(\?|$)/);
      const change = await waitForSaved(findChange, "la solicitud en borrador");
      assert.equal(change.finalStatus, "DRAFT", "se guarda como borrador");
      assert.deepEqual([...change.scope].sort(), ["DOCUMENTATION", "EQUIPMENT"]);
      assert.equal(change.requestDecision, "ACCEPTED");
      await tour.pause(1200);
    });

    // 2 · Dictamen: evaluación, implicaciones y plan de ejecución; aprobado, el cambio se abre con su código.
    const opened = await tour.step("2 · <b>Dictamen</b> (Anexo IV): evaluación, implicaciones y <b>plan de ejecución</b>", async () => {
      await tour.click(page.locator("main a", { hasText: "Editar / seguimiento" }).first());
      await page.waitForURL(/\/edit/);
      await tour.fill(page.locator('textarea[name="evaluation"]'), "Cambio de equipo equivalente con mejora de la integridad de datos. Requiere cualificación y actualizar el PNT de pesada.");
      await tour.select(page.locator('select[name="classification"]'), "MINOR");
      await tour.fill(page.locator('input[name="plannedImplementationDate"]'), madridDay(30));
      for (const [field, value] of [["committeeRequired", "false"], ["clientNotificationRequired", "false"], ["authorityRequired", "false"], ["pqrRequired", "NA"], ["stabilityRequired", "NA"], ["additionalAnalysisRequired", "NO"], ["additionalValidationRequired", "NO"], ["otherImplicationRequired", "false"]] as const) {
        await tour.select(page.locator(`select[name="${field}"]`), value);
      }
      const fillTask = async (row: Locator, text: string, responsible: string, days: number) => {
        await tour.select(row.locator("select").first(), department.id);
        await tour.fill(row.getByLabel("Acción / tarea"), text);
        await tour.fill(row.getByRole("textbox", { name: "Responsable", exact: true }), responsible);
        await tour.fill(row.getByLabel("Fecha prevista"), madridDay(days));
      };
      const rows = page.locator(".change-task-row");
      if (!(await rows.count())) await tour.click(page.getByRole("button", { name: "+ Añadir acción" }));
      await fillTask(rows.nth(0), actions[0], "Responsable de Mantenimiento (ficticio)", 15);
      await tour.click(page.getByRole("button", { name: "+ Añadir acción" }));
      await fillTask(rows.nth(1), actions[1], "Responsable de Garantía de Calidad (ficticio)", 25);
      await tour.select(page.locator('select[name="dictamenResult"]'), "APPROVED");
      await tour.fill(page.locator('input[name="dictamenDate"]'), today);
      await tour.fill(page.locator('input[name="nextFollowupDate"]'), madridDay(15));
      await tour.fill(page.locator('input[name="followupResponsible"]'), "Garantía de Calidad (ficticio)");
      await tour.fill(page.locator('textarea[name="dictamenObservations"]'), "Aprobado como cambio menor con el plan de ejecución indicado.");
      await tour.select(page.locator('select[name="finalStatus"]'), "OPEN");
      await tour.select(page.locator('select[name="dataQualityStatus"]'), "COMPLETE");
      await tour.click(page.getByRole("button", { name: /^Guardar/ }));
      await page.waitForURL(/\/changes\/[0-9a-f-]{36}(\?|$)/);
      const change = await waitForSaved(async () => { const row = await findChange(); return row?.finalStatus === "OPEN" ? row : null; }, "el cambio abierto");
      assert.ok(change.qmsRecord.businessCode, "el cambio recibe su código");
      assert.equal(change.dictamenResult, "APPROVED");
      assert.equal(change.classification, "MINOR");
      assert.equal(change.dataQualityStatus, "COMPLETE");
      assert.deepEqual(change.tasks.map((t) => [t.description, t.origin]), actions.map((a) => [a, "DICTAMEN"]), "el plan de ejecución tiene las dos acciones del dictamen");
      await page.getByText(change.qmsRecord.businessCode ?? "").first().waitFor();
      await tour.pause(1500);
      return { id: change.id, qmsRecordId: change.qmsRecordId, code: change.qmsRecord.businessCode ?? "", taskIds: change.tasks.map((t) => t.id) };
    });

    const followupForm = page.locator("#new-followup");
    // El formulario de seguimiento muestra el rechazo del servidor en .form-feedback.error.
    const followupError = async () => {
      const box = page.locator(".form-feedback.error").first();
      return (await box.isVisible().catch(() => false)) ? (await box.innerText()).trim() : null;
    };
    const taskRow = (index: number) => followupForm.locator(".followup-task-table tbody tr").nth(index);
    const completeTask = async (index: number, evidence: string) => {
      const row = taskRow(index);
      await tour.select(row.locator("td").nth(5).locator("select"), "COMPLETED");
      await tour.fill(row.locator("td").nth(6).locator("input"), today);
      await tour.fill(row.locator("td").nth(7).locator("textarea"), evidence);
    };
    const openFollowup = async () => {
      await tour.click(page.locator("main a", { hasText: "+ Seguimiento" }).first());
      await followupForm.waitFor();
      await followupForm.scrollIntoViewIfNeeded();
      await tour.fill(followupForm.locator('input[name="followupDate"]'), today);
    };

    // 3 · Seguimiento 01: una acción completada; el cambio sigue abierto con motivo y próxima fecha.
    await tour.step("3 · <b>Seguimiento 01</b>: una acción completada; el cambio <b>sigue abierto</b>", async () => {
      await openFollowup();
      await completeTask(0, "Balanza cualificada (IQ/OQ) y dada de alta en el inventario.");
      await tour.select(followupForm.locator('select[name="closeChange"]'), "false");
      await tour.fill(followupForm.locator('input[name="nextFollowupDate"]'), madridDay(25));
      await tour.fill(followupForm.locator('textarea[name="remainOpenReason"]'), "Pendiente actualizar el PNT de pesada y la formación.");
      await tour.click(followupForm.getByRole("button", { name: "Guardar seguimiento" }));
      const followup = await waitForSaved(() => prisma.changeControlFollowup.findFirst({ where: { changeControlId: opened.id, sequenceNumber: 1 }, include: { taskStates: true } }), "el seguimiento 01", { screenError: followupError });
      assert.equal(followup.closeChange, false);
      const states = new Map(followup.taskStates.map((s) => [s.taskId, s.status]));
      assert.deepEqual(opened.taskIds.map((id) => states.get(id)), ["COMPLETED", "PENDING"]);
      const change = await prisma.changeControl.findUniqueOrThrow({ where: { id: opened.id } });
      assert.equal(change.finalStatus, "OPEN", "el cambio sigue abierto");
      await tour.pause(1500);
    });

    // 4 · Seguimiento 02: todo ejecutado, eficacia aceptable y cierre con conclusión y aprobación.
    await tour.step("4 · <b>Seguimiento 02</b>: todo ejecutado, <b>eficacia aceptable</b> y <b>cierre</b>", async () => {
      await tour.go(`/changes/${opened.id}`);
      await openFollowup();
      await completeTask(1, "PNT de pesada revisado y personal formado (registro de formación ficticio).");
      await tour.select(followupForm.locator('select[name="executionStatus"]'), "EXECUTED");
      await tour.fill(followupForm.locator('input[name="executionDate"]'), today);
      await tour.select(followupForm.locator('select[name="effectivenessStatus"]'), "ACCEPTABLE");
      await tour.fill(followupForm.locator('textarea[name="effectivenessObservations"]'), "Dos semanas de pesadas con ticket impreso, sin transcripciones.");
      await tour.select(followupForm.locator('select[name="closeChange"]'), "true");
      await tour.fill(followupForm.locator('textarea[name="conclusion"]'), "Cambio implantado y eficaz. Se cierra.");
      await tour.fill(followupForm.locator('input[name="approvalByText"]'), "Dirección Técnica (ficticio)");
      await tour.click(followupForm.getByRole("button", { name: "Guardar seguimiento" }));
      const change = await waitForSaved(async () => { const row = await prisma.changeControl.findUniqueOrThrow({ where: { id: opened.id } }); return row.finalStatus === "CLOSED" ? row : null; }, "el cierre del cambio", { screenError: followupError });
      assert.equal(change.effectiveClosedAt?.toISOString().slice(0, 10), today);
      assert.equal(change.closureConclusion, "Cambio implantado y eficaz. Se cierra.");
      const followup = await prisma.changeControlFollowup.findFirstOrThrow({ where: { changeControlId: opened.id, sequenceNumber: 2 }, include: { taskStates: true } });
      assert.equal(followup.executionStatus, "EXECUTED");
      assert.equal(followup.effectivenessStatus, "ACCEPTABLE");
      const states = new Map(followup.taskStates.map((state) => [state.taskId, state.status]));
      assert.deepEqual(opened.taskIds.map((id) => states.get(id)), ["COMPLETED", "COMPLETED"], "todas las acciones completadas");
      await page.reload(); await page.waitForLoadState("networkidle");
      await tour.pause(1500);
    });

    // 5 · Documentos generados desde el expediente.
    await tour.step("5 · Los documentos salen del expediente: <b>Anexos III, IV y V</b> y listado", async () => {
      await tour.go(`/changes/${opened.id}?tab=documents`);
      const annexes = [
        ["Generar Anexo III", "Anexo III", [opened.code, marker]],
        ["Generar Anexo IV", "Anexo IV", [opened.code, actions[0]]],
        // Anexo V del seguimiento vigente (el 02, el del cierre).
        ["Generar Anexo V", "Anexo V", [opened.code, "PNT de pesada revisado"]],
      ] as const;
      for (const [label, annex, expected] of annexes) {
        // TPL1: sin plantilla instalada (CI), la ficha no ofrece el anexo y explica qué falta.
        const file = await tour.downloadOrMissing(page.locator("main a", { hasText: label }).first(), annex);
        if (!file) continue;
        const text = ooxmlText(file.bytes, /^word\/document\.xml$/);
        for (const value of expected) assert.ok(text.includes(value), `${annex} contiene «${value}»`);
        if (annex === "Anexo IV") await tour.showDocument(file.name, file.bytes, `<b>Anexo IV</b> de ${opened.code}: dictamen y plan de ejecución`);
      }
      await tour.go(`/changes?q=${encodeURIComponent(opened.code)}`);
      await page.locator("tr", { hasText: opened.code }).first().waitFor();
      await tour.click(page.locator("summary", { hasText: "Exportar" }));
      const list = await tour.download(page.locator("a", { hasText: "Listado simple · filtros actuales" }).first());
      const listText = ooxmlText(list.bytes, /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/);
      assert.ok(listText.includes(opened.code), "el listado filtrado contiene el cambio");
      assert.ok(!listText.includes(other), `el listado filtrado por ${opened.code} no incluye otros cambios (${other})`);
      await page.keyboard.press("Escape");
      await tour.caption(`El listado filtrado se descarga en Excel con <b>${opened.code}</b>`);
      await tour.pause(2500);
    });
    await tour.caption(`Recorrido completado: <b>${opened.code}</b> solicitado, aprobado, ejecutado y cerrado`);
    await tour.pause(3000);
    console.log(`Recorrido de Controles de cambios correcto: ${opened.code}`);
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
 * Código de otro control de cambios que no debe salir en el listado filtrado. En la demo, uno de los ejemplos; en
 * la base de pruebas, una ficha mínima con la marca que se borra al terminar.
 */
async function otherChangeCode(tour: Tour, marker: string, department: { id: string; code: string; name: string }) {
  if (tour.demo) {
    const row = await prisma.changeControl.findFirst({ where: { finalStatus: { not: "DRAFT" }, qmsRecord: { isActive: true, businessCode: { not: null } }, NOT: { description: { contains: "(ficticio REC-" } } }, include: { qmsRecord: true } });
    if (!row?.qmsRecord.businessCode) throw new Error("La demo no tiene ningún control de cambios de ejemplo: carga los ejemplos de la demo antes de grabar el recorrido.");
    return row.qmsRecord.businessCode;
  }
  const code = `CC-TOUR-${marker.slice(-8)}-2097`;
  await prisma.changeControl.create({ data: {
    qmsRecord: { create: { recordType: "CHANGE_CONTROL", businessCode: code, year: 2097 } },
    finalStatus: "OPEN", department: { connect: { id: department.id } }, departmentCodeSnapshot: department.code, departmentNameSnapshot: department.name,
    requestDate: new Date("2097-01-01"), description: `Otro cambio del recorrido ${marker}`,
  } });
  return code;
}

/** Solo en la base aislada de pruebas: borra lo creado con la marca, también si el recorrido falló a medias. */
async function cleanup(marker: string) {
  const changes = await prisma.changeControl.findMany({ where: { description: { contains: marker } }, select: { id: true, qmsRecordId: true } });
  if (!changes.length) return;
  const ids = changes.map((row) => row.qmsRecordId), changeIds = changes.map((row) => row.id);
  await prisma.qmsRelation.deleteMany({ where: { OR: [{ sourceRecordId: { in: ids } }, { targetRecordId: { in: ids } }] } });
  await prisma.changeHistory.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.generatedDocument.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.changeControlTaskState.deleteMany({ where: { followup: { changeControlId: { in: changeIds } } } });
  await prisma.changeControlFollowup.deleteMany({ where: { changeControlId: { in: changeIds } } });
  await prisma.changeControlTask.deleteMany({ where: { changeControlId: { in: changeIds } } });
  await prisma.changeControl.deleteMany({ where: { id: { in: changeIds } } });
  await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
}

main().catch((error) => { console.error(error); process.exit(1); });

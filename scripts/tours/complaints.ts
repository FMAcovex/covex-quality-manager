// Recorrido de Reclamaciones (D-138): registro de la reclamación de cliente en borrador → evaluación, investigación,
// clasificación y devolución propuesta (Parte I), abierta con su código → la devolución se crea desde la reclamación
// y queda vinculada → respuesta al cliente, eficacia y cierre (Parte II) → Anexos III y IV y listado filtrado. Cada
// paso comprueba en la base de datos y en los documentos lo que el usuario ve.
//
//   Prueba (CI):  pnpm tour:complaints
//   Vídeo (demo): TOUR_VIDEO_DIR=<carpeta> pnpm tour:complaints
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { finishTour, ooxmlText, startTour, waitForSaved, type Tour } from "./lib";

const madridDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
// Una sola fecha «de hoy» para rellenar y comprobar, aunque el recorrido cruce la medianoche.
const today = madridDay();

async function main() {
  const tour = await startTour("Recorrido Reclamaciones");
  const { page } = tour;
  const marker = tour.demo ? `REC-${randomUUID().slice(0, 4).toUpperCase()}` : `TOUR-RC-${randomUUID().slice(0, 8)}`;
  let failure: unknown = null;
  try {
    const department = await prisma.department.findFirst({ where: { isActive: true, code: "GC-00" } })
      ?? await prisma.department.findFirstOrThrow({ where: { isActive: true }, orderBy: { code: "asc" } });
    // Devoluciones solo admite las áreas de almacén (LG-…).
    const warehouse = await prisma.department.findFirstOrThrow({ where: { isActive: true, code: { startsWith: "LG-" } }, orderBy: { code: "asc" } });
    const other = await otherComplaintCode(tour, marker, department);
    const description = `El cliente recibe estuches del lote ficticio L-${marker} con el prospecto de la versión anterior.`;
    const findComplaint = () => prisma.complaint.findFirst({ where: { description }, include: { qmsRecord: true, derivedActions: true } });

    // 1 · Registro: quién reclama, qué producto y qué ocurre.
    await tour.step("1 · Se registra la <b>reclamación</b> del cliente: qué producto y qué ocurre", async () => {
      await tour.go("/complaints");
      await tour.click(page.locator("main a", { hasText: "+ Nueva reclamación" }).first());
      await page.waitForURL(/\/complaints\/new/);
      await tour.check(page.locator('input[name="complaintType"][value="CUSTOMER"]'));
      await tour.select(page.locator('select[name="departmentId"]'), department.id);
      for (const name of ["openedAt", "detectionDate", "receptionDate"]) await tour.fill(page.locator(`input[name="${name}"]`), today);
      const author = page.locator('input[name="createdByText"]');
      if (await author.getAttribute("readonly") === null && !(await author.inputValue())) await tour.fill(author, "Garantía de Calidad (ficticio)");
      await tour.check(page.locator('input[name="sourceTypes"][value="CUSTOMER"]'));
      await tour.fill(page.locator('input[name="partyName"]'), "Distribuidora Ejemplo, S. L. (ficticia)");
      await tour.fill(page.locator('input[name="contact"]'), "Responsable de calidad del cliente (ficticio)");
      await tour.check(page.locator('input[name="scopeTypes"][value="MEDICINE"]'));
      await tour.check(page.locator('input[name="affectedObjectTypes"][value="PRODUCT_MATERIAL"]'));
      await tour.fill(page.locator('input[name="reference"]'), "Comprimidos de ejemplo 500 mg, estuche de 30");
      await tour.fill(page.locator('input[name="lotReference"]'), `L-${marker}`);
      await tour.fill(page.locator('input[name="quantity"]'), "120 estuches");
      await tour.fill(page.locator('input[name="expiryReanalysis"]'), "06/2028");
      await tour.fill(page.locator('textarea[name="description"]'), description);
      await tour.check(page.locator('input[name="categoryTypes"][value="LABELLING_DOCUMENTATION"]'));
      await tour.select(page.locator('select[name="recurrent"]'), "false");
      await tour.fill(page.locator('input[name="emittedBy"]'), "Garantía de Calidad (ficticio)");
      await tour.click(page.getByRole("button", { name: "Guardar borrador" }));
      await page.waitForURL(/\/complaints\/[0-9a-f-]{36}(\?|$)/);
      const row = await waitForSaved(findComplaint, "la reclamación en borrador");
      assert.equal(row.status, "DRAFT");
      assert.equal(row.complaintType, "CUSTOMER");
      assert.deepEqual(row.categoryTypes, ["LABELLING_DOCUMENTATION"]);
      await tour.pause(1200);
    });

    // 2 · Parte I: impacto, investigación, causa raíz, clasificación, evaluación regulatoria y devolución propuesta.
    const opened = await tour.step("2 · <b>Parte I</b>: impacto, investigación, clasificación y <b>devolución propuesta</b>", async () => {
      await tour.click(page.locator("main a", { hasText: "Editar" }).first());
      await page.waitForURL(/\/edit/);
      for (const [name, value] of [["impactQualityGmp", "YES"], ["impactSafetyEfficacy", "NO"], ["impactRegulatory", "NO"], ["impactEnvironment", "NO"], ["impactOtherSimilar", "NO"]] as const) {
        await tour.select(page.locator(`select[name="${name}"]`), value);
      }
      await tour.check(page.locator('input[name="containmentActions"][value="QUARANTINE"]'));
      await tour.fill(page.locator('textarea[name="riskJustification"]'), "Riesgo de información incorrecta al paciente; el texto anterior no contiene contraindicaciones nuevas. Lote retenido en el cliente.");
      await tour.fill(page.locator('textarea[name="investigation"]'), "La orden de acondicionamiento cargó la versión anterior del prospecto. El resto de lotes del periodo usan la versión vigente.");
      await tour.fill(page.locator('textarea[name="impactAssessment"]'), "Afecta solo al lote reclamado.");
      await tour.select(page.locator('select[name="investigationResult"]'), "PROCEDENT");
      await tour.fill(page.locator('textarea[name="rootCause"]'), `Versión obsoleta del prospecto disponible en la línea de acondicionamiento (${marker}).`);
      await tour.check(page.locator('input[name="rootCauseCategories"][value="MATERIAL"]'));
      await tour.select(page.locator('select[name="classification"]'), "MINOR");
      for (const name of ["potentialRecall", "recallProcedureRequired", "authorityNotificationRequired", "responsiblePartyCommunicationRequired"]) await tour.select(page.locator(`select[name="${name}"]`), "NO");
      await tour.fill(page.locator('textarea[name="regulatoryJustification"]'), "Desviación de material de acondicionamiento sin impacto en seguridad; no requiere retirada ni notificación.");
      await tour.fill(page.locator('textarea[name="resolutionLines"]'), "Devolución del lote para reacondicionarlo con el prospecto vigente.");
      await tour.select(page.locator('select[name="hasDerivedActions"]'), "true");
      await tour.check(page.locator('input[name="resolutionActions"][value="RETURN"]'));
      // Al marcar «Devolución» el formulario ofrece ya una fila para la propuesta.
      const proposal = page.locator(".complaint-derived-row").first();
      await proposal.waitFor();
      await tour.fill(proposal.getByLabel("Acción / detalle *"), "Devolución de los 120 estuches al almacén para reacondicionarlos.");
      await tour.fill(proposal.getByRole("textbox", { name: "Responsable *", exact: true }), "Responsable de Almacén (ficticio)");
      await tour.fill(proposal.getByLabel("Fecha prevista *"), madridDay(10));
      await tour.fill(page.locator('input[name="communicationDate"]'), today);
      await tour.fill(page.locator('input[name="communicationMedium"]'), "Correo electrónico");
      await tour.fill(page.locator('input[name="communicationParties"]'), "Garantía de Calidad → cliente");
      await tour.fill(page.locator('textarea[name="communicationSummary"]'), "Se confirma la recepción, se pide retener el lote y se organiza su devolución.");
      // La decisión sobre la Parte II queda pendiente hasta tener la respuesta al cliente (paso 4).
      await tour.fill(page.locator('textarea[name="conclusion"]'), "Reclamación procedente. Se gestiona la devolución y se responde al cliente en la Parte II.");
      await tour.select(page.locator('select[name="status"]'), "OPEN");
      await tour.fill(page.locator('input[name="nextFollowupDate"]'), madridDay(10));
      await tour.select(page.locator('select[name="dataQualityStatus"]'), "COMPLETE");
      await tour.click(page.getByRole("button", { name: "Guardar cambios", exact: true }));
      await page.waitForURL(/\/complaints\/[0-9a-f-]{36}(\?|$)/);
      const row = await waitForSaved(async () => { const r = await findComplaint(); return r?.status === "OPEN" ? r : null; }, "la reclamación abierta");
      assert.ok(row.qmsRecord.businessCode, "recibe su código");
      assert.equal(row.investigationResult, "PROCEDENT");
      assert.equal(row.classification, "MINOR");
      assert.deepEqual(row.resolutionActions, ["RETURN"]);
      assert.deepEqual(row.derivedActions.map((a) => [a.actionType, a.businessCode ?? null]), [["RETURN", null]], "la devolución queda propuesta");
      await page.getByText(row.qmsRecord.businessCode ?? "").first().waitFor();
      await tour.pause(1200);
      return { id: row.id, qmsRecordId: row.qmsRecordId, code: row.qmsRecord.businessCode ?? "" };
    });

    // 3 · La devolución se crea desde la reclamación y queda vinculada.
    const returned = await tour.step(`3 · Desde <b>${opened.code}</b> se crea la <b>devolución</b>`, async () => {
      await tour.go(`/complaints/${opened.id}?tab=relations`);
      await tour.click(page.locator("main a", { hasText: "Crear devolución" }).first());
      await page.waitForURL(/\/returns\/new/);
      // El formulario llega rellenado desde la reclamación: origen, tipo «Reclamación», cliente y producto con su lote.
      await page.getByText(`devolución iniciada desde la reclamación ${opened.code}`).first().waitFor();
      const product = page.locator(".return-product-card").first();
      assert.equal(await product.getByLabel("Lote").inputValue(), `L-${marker}`, "el lote llega de la reclamación");
      assert.equal(await page.locator('input[name="customerEntity"]').inputValue(), "Distribuidora Ejemplo, S. L. (ficticia)", "el cliente llega de la reclamación");
      await tour.pause(1200);
      await tour.select(page.locator('select[name="departmentId"]'), warehouse.id);
      await tour.fill(page.locator('input[name="receivedAt"]'), today);
      await tour.fill(page.locator('input[name="country"]'), "España");
      await tour.fill(page.locator('input[name="address"]'), "Calle Ejemplo 1, Madrid (ficticia)");
      await tour.fill(page.locator('input[name="conservationConditions"]'), "Temperatura ambiente");
      await tour.fill(product.getByLabel("Formato"), "Estuche de 30");
      await tour.fill(page.locator('textarea[name="reasonObservations"]'), "Prospecto de versión anterior detectado por el cliente.");
      await tour.fill(page.locator('textarea[name="attachedDocumentation"]'), "Albarán de devolución y fotografías del cliente (ficticios).");
      // Primero en borrador (RET1): la propuesta queda reservada para este borrador.
      await tour.click(page.getByRole("button", { name: "Guardar borrador" }));
      await page.waitForURL(/\/returns\/[0-9a-f-]{36}(\?|$)/);
      const [proposal] = await prisma.complaintDerivedAction.findMany({ where: { complaintId: opened.id, actionType: "RETURN" } });
      const draft = await waitForSaved(() => prisma.returnRecord.findFirst({ where: { status: "DRAFT", extraData: { path: ["pendingComplaintActionId"], equals: proposal.id } } }), "el borrador de la devolución propuesta");
      // La reclamación ya no ofrece crear otra devolución para esa propuesta: ofrece abrir el borrador.
      await tour.go(`/complaints/${opened.id}?tab=relations`);
      const openDraft = page.locator("main a", { hasText: "Abrir borrador de devolución" }).first();
      await openDraft.waitFor();
      assert.equal(await page.locator("main a", { hasText: "Crear devolución" }).count(), 0, "con un borrador en curso no se ofrece crear otra devolución");
      await tour.caption("Con el borrador en curso, la reclamación ofrece <b>abrirlo</b>, no crear otra devolución");
      await tour.pause(1800);
      await tour.click(openDraft);
      await tour.click(page.locator("main a", { hasText: /^Editar/ }).first());
      await page.waitForURL(new RegExp(`/returns/${draft.id}/edit`));
      await tour.select(page.locator('select[name="status"]'), "OPEN");
      await tour.fill(page.locator('textarea[name="changeReason"]'), "Apertura de la devolución recibida.");
      await tour.click(page.getByRole("button", { name: /^Guardar/ }).last());
      await page.waitForURL(new RegExp(`/returns/${draft.id}(\\?|$)`));
      const relation = await waitForSaved(() => prisma.qmsRelation.findFirst({ where: { isActive: true, sourceRecordId: opened.qmsRecordId, targetRecord: { recordType: "RETURN" } }, include: { targetRecord: true } }), "la devolución vinculada a la reclamación");
      const row = await prisma.returnRecord.findUniqueOrThrow({ where: { qmsRecordId: relation.targetRecordId } });
      assert.equal(row.status, "OPEN");
      assert.equal(row.returnType, "COMPLAINT");
      assert.equal(row.relatedDocument, opened.code, "la devolución referencia la reclamación");
      // RET1: la devolución propuesta recibe el código de la devolución creada desde ella.
      const proposals = await prisma.complaintDerivedAction.findMany({ where: { complaintId: opened.id, actionType: "RETURN" } });
      assert.deepEqual(proposals.map((a) => a.businessCode), [relation.targetRecord.businessCode], "la propuesta lleva el código de la devolución creada");
      await page.getByText(opened.code).first().waitFor();
      await tour.pause(1500);
      // Y la reclamación ya no ofrece crear otra: ofrece abrirla.
      await tour.go(`/complaints/${opened.id}?tab=relations`);
      await page.locator("main a", { hasText: "Abrir devolución" }).first().waitFor();
      assert.equal(await page.locator("main a", { hasText: "Crear devolución" }).count(), 0, "una propuesta con devolución no ofrece crear otra");
      await tour.caption(`La propuesta queda con <b>${relation.targetRecord.businessCode}</b>: ya no ofrece crear otra`);
      await tour.pause(1800);
      return { code: relation.targetRecord.businessCode ?? "" };
    });

    // 4 · Parte II: respuesta al cliente, eficacia y cierre.
    await tour.step("4 · <b>Parte II</b>: respuesta al cliente, eficacia y <b>cierre</b>", async () => {
      await tour.go(`/complaints/${opened.id}`);
      await tour.click(page.locator("main a", { hasText: "Editar" }).first());
      await page.waitForURL(/\/edit/);
      await tour.select(page.locator('select[name="partIIRequired"]'), "true");
      await tour.fill(page.locator('input[name="responseDate"]'), today);
      await tour.fill(page.locator('input[name="responseMedium"]'), "Correo electrónico");
      await tour.fill(page.locator('textarea[name="responseSummary"]'), "Se informa al cliente de la causa, de la devolución y del refuerzo del control de versiones de prospectos.");
      await tour.select(page.locator('select[name="responseSufficient"]'), "true");
      await tour.select(page.locator('select[name="effectivenessStatus"]'), "ACCEPTABLE");
      await tour.fill(page.locator('textarea[name="effectivenessAssessment"]'), "Sin nuevas reclamaciones por prospecto en los lotes siguientes.");
      await tour.select(page.locator('select[name="closeActionStatus"]'), "LINKED");
      await tour.fill(page.locator('input[name="closeActionReferences"]'), `Devolución ${returned.code} (Almacén)`);
      await tour.fill(page.locator('textarea[name="closeConclusion"]'), "Reclamación resuelta y respondida. Se cierra.");
      await tour.select(page.locator('select[name="status"]'), "CLOSED");
      await tour.fill(page.locator('input[name="closedAt"]'), today);
      await tour.fill(page.locator('textarea[name="changeReason"]'), "Cierre tras responder al cliente.");
      // La Parte II se guarda como nuevo seguimiento de la reclamación, con su fecha.
      await tour.fill(page.locator('input[name="versionFollowupDate"]'), today);
      await tour.click(page.getByRole("button", { name: "Guardar como nueva versión / seguimiento" }));
      await page.waitForURL(/\/complaints\/[0-9a-f-]{36}(\?|$)/);
      const row = await waitForSaved(async () => { const r = await prisma.complaint.findUnique({ where: { id: opened.id } }); return r?.status === "CLOSED" ? r : null; }, "el cierre de la reclamación");
      assert.equal(row.effectivenessStatus, "ACCEPTABLE");
      assert.equal(row.closedAt?.toISOString().slice(0, 10), today);
      assert.equal(row.description, description, "la descripción no cambia al cerrar");
      const versions = await prisma.qmsRecordVersion.findMany({ where: { qmsRecordId: opened.qmsRecordId }, orderBy: { sequenceNumber: "asc" }, select: { sequenceNumber: true } });
      assert.deepEqual(versions.map((v) => v.sequenceNumber), [0, 1], "la Parte II queda como seguimiento 01 y el 00 se conserva");
      await tour.pause(1500);
    });

    // 5 · Documentos: Anexo III (informe) y IV (respuesta) y listado filtrado.
    await tour.step("5 · Los documentos salen del expediente: <b>Anexos III y IV</b> y listado", async () => {
      await tour.go(`/complaints/${opened.id}?tab=documents`);
      for (const [label, annex, route, expected] of [
        ["Generar Anexo III", "Anexo III", "annex-iii", [opened.code, `L-${marker}`]],
        ["Generar informe de respuesta", "Anexo IV", "annex-iv", [opened.code, "Reclamación resuelta y respondida"]],
      ] as const) {
        // TPL1: sin plantilla instalada (CI), la ficha no ofrece el anexo y explica qué falta.
        const file = await tour.downloadOrMissing(page.locator("main a", { hasText: label }).first(), annex, `/api/complaints/${opened.id}/${route}`);
        if (!file) continue;
        const text = ooxmlText(file.bytes, /^word\/document\.xml$/);
        for (const value of expected) assert.ok(text.includes(value), `${label} contiene «${value}»`);
        if (annex === "Anexo III") await tour.showDocument(file.name, file.bytes, `<b>Anexo III</b> de ${opened.code}: informe de la reclamación`);
      }
      await tour.go(`/complaints?q=${encodeURIComponent(opened.code)}`);
      await page.locator("tr", { hasText: opened.code }).first().waitFor();
      await tour.click(page.locator("summary", { hasText: "Exportar" }));
      const list = await tour.download(page.locator("a", { hasText: "Listado simple · filtros actuales" }).first());
      const listText = ooxmlText(list.bytes, /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/);
      assert.ok(listText.includes(opened.code), "el listado filtrado contiene la reclamación");
      assert.ok(!listText.includes(other), `el listado filtrado por ${opened.code} no incluye otras reclamaciones (${other})`);
      await page.keyboard.press("Escape");
      await tour.caption(`El listado filtrado se descarga en Excel con <b>${opened.code}</b>`);
      await tour.pause(2500);
    });
    await tour.caption(`Recorrido completado: <b>${opened.code}</b> investigada, con su devolución <b>${returned.code}</b>, respondida y cerrada`);
    await tour.pause(3000);
    console.log(`Recorrido de Reclamaciones correcto: ${opened.code} → ${returned.code}`);
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
 * Código de otra reclamación que no debe salir en el listado filtrado. En la demo, una de los ejemplos; en la
 * base de pruebas, una ficha mínima con la marca, creada antes de empezar y borrada al terminar.
 */
async function otherComplaintCode(tour: Tour, marker: string, department: { id: string; code: string; name: string }) {
  if (tour.demo) {
    const row = await prisma.complaint.findFirst({ where: { status: { not: "DRAFT" }, qmsRecord: { isActive: true, businessCode: { not: null } }, NOT: { description: { contains: "lote ficticio L-REC-" } } }, include: { qmsRecord: true } });
    if (!row?.qmsRecord.businessCode) throw new Error("La demo no tiene ninguna reclamación de ejemplo: carga los ejemplos de la demo antes de grabar el recorrido.");
    return row.qmsRecord.businessCode;
  }
  const code = `REC-TOUR-${marker.slice(-8)}-2097`;
  await prisma.complaint.create({ data: {
    qmsRecord: { create: { recordType: "COMPLAINT", businessCode: code, year: 2097 } },
    status: "OPEN", complaintType: "CUSTOMER", department: { connect: { id: department.id } }, departmentCodeSnapshot: department.code, departmentNameSnapshot: department.name,
    openedAt: new Date("2097-01-01"), createdByText: "Recorrido de Reclamaciones", partyName: "Cliente del recorrido", description: `Otra reclamación del recorrido ${marker}`,
  } });
  return code;
}

/** Solo en la base aislada de pruebas: borra lo creado con la marca, también si el recorrido falló a medias. */
async function cleanup(marker: string) {
  const complaints = await prisma.complaint.findMany({ where: { OR: [{ description: { contains: marker } }, { lotReference: { contains: marker } }] }, select: { id: true, qmsRecordId: true } });
  const returns = await prisma.returnRecord.findMany({ where: { products: { some: { lot: { contains: marker } } } }, select: { id: true, qmsRecordId: true } });
  const ids = [...new Set([...complaints, ...returns].map((row) => row.qmsRecordId))];
  if (!ids.length) return;
  await prisma.qmsRelation.deleteMany({ where: { OR: [{ sourceRecordId: { in: ids } }, { targetRecordId: { in: ids } }] } });
  await prisma.changeHistory.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.generatedDocument.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.returnFollowup.deleteMany({ where: { returnRecordId: { in: returns.map((r) => r.id) } } });
  await prisma.returnProduct.deleteMany({ where: { returnRecordId: { in: returns.map((r) => r.id) } } });
  await prisma.returnRecord.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.complaintFollowup.deleteMany({ where: { complaintId: { in: complaints.map((c) => c.id) } } });
  await prisma.complaintCapaPlan.deleteMany({ where: { complaintId: { in: complaints.map((c) => c.id) } } });
  await prisma.complaintDerivedAction.deleteMany({ where: { complaintId: { in: complaints.map((c) => c.id) } } });
  await prisma.complaint.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
}

main().catch((error) => { console.error(error); process.exit(1); });

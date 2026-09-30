import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CapaActionType,
  CapaProposalStatus,
  PrismaClient,
  QmsRecordType,
  RecordVersionKind,
} from "@prisma/client";
import { parseDeviationForm } from "../src/modules/deviations/validation";
import {
  assignDeviationBusinessCode,
  suggestDeviationBusinessCode,
} from "../src/lib/qms/business-code";
import {
  createQmsRelation,
  deactivateQmsRelation,
  getIncomingRelations,
  getOutgoingRelations,
} from "../src/lib/qms/relation-service";
import {
  deviationSnapshotToAnnexRecord,
  ensureInitialVersion,
  serializeDeviationVersion,
  snapshotJson,
  startNextVersion,
  versionLabel,
} from "../src/lib/qms/versioning";
import {
  buildYearMetrics,
  type AnalyticsRow,
} from "../src/modules/deviations/analytics/domain";

const prisma = new PrismaClient();
const year = 2094;
const manualCode = `D/GC-00/007/${year}`;
const autoCode = `D/GC-00/008/${year}`;
const capaCode = `AC/GC-00/D6/${year}`;

function fullOpenForm() {
  const form = new FormData();
  form.set("departmentId", "department-d6");
  form.set("issueDate", `${year}-06-01`);
  form.set("eventDateTime", `${year}-06-01T10:30`);
  form.set("detectedBy", "Usuario D6");
  form.set("createdByText", "Usuario D6");
  form.set("materialProcessAffected", "Proceso/equipo D6");
  form.set("affectedDocumentation", "GC-00/023 y registro D6");
  form.set("whatHappened", "Evento ficticio para prueba D6.");
  form.set("whoInvolved", "Usuario ficticio");
  form.set("whenHappened", "Durante la prueba D6");
  form.set("whereHappened", "Entorno CI");
  form.set("howHappened", "Revisión controlada");
  form.set("investigation", "Investigación ficticia concluyente.");
  form.set("investigationConclusive", "YES");
  form.append("investigationMethods", "FIVE_WHYS");
  form.set("rootCause", "Causa ficticia D6.");
  form.set("recurrentRootCause", "NO");
  form.set("recurrenceDetails", "Sin antecedentes equivalentes.");
  form.set("classification", "MINOR");
  form.set("validationImpact", "NO");
  form.set("registrationImpact", "NO");
  form.set("stabilityImpact", "NA");
  form.set("otherProcessesImpact", "NO");
  form.set("otherProcessesImpactDetails", "Sin impacto adicional.");
  form.set("affectsFinishedProduct", "NO");
  form.set("capaRequired", "true");
  form.set("conclusion", "Caso D6 evaluado.");
  form.set("disposition", "No aplica disposición real.");
  form.set("dispositionQuantity", "0");
  form.set("dispositionComments", "Caso de prueba sin producto real.");
  form.set("clientNotification", "NO");
  form.set("status", "OPEN");
  form.set("dataQualityStatus", "COMPLETE");
  return form;
}

async function cleanup() {
  const records = await prisma.qmsRecord.findMany({
    where: {
      OR: [
        { businessCode: { in: [manualCode, autoCode, capaCode] } },
        { annulledBusinessCode: { in: [manualCode, autoCode, capaCode] } },
      ],
    },
    select: { id: true, recordType: true },
  });
  if (!records.length) return;

  const ids = records.map((record) => record.id);
  const deviationIds = records.filter((record) => record.recordType === QmsRecordType.DEVIATION).map((record) => record.id);
  const capaIds = records.filter((record) => record.recordType === QmsRecordType.CAPA).map((record) => record.id);

  await prisma.qmsRelation.deleteMany({
    where: { OR: [{ sourceRecordId: { in: ids } }, { targetRecordId: { in: ids } }] },
  });
  await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.capa.deleteMany({ where: { qmsRecordId: { in: capaIds } } });
  await prisma.deviation.deleteMany({ where: { qmsRecordId: { in: deviationIds } } });
  await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
}

async function assertFormStructure() {
  const source = await readFile("src/modules/deviations/components/deviation-form.tsx", "utf8");
  const headings = [
    "Identificación",
    "A. Origen",
    "B. Documentación afectada",
    "C. Descripción del evento",
    "D. Acción inmediata",
    "E. Investigación",
    "F-G. Causa raíz",
    "H. Clasificación de la desviación",
    "I. Impacto",
    "J. CAPA",
    "K-L. Conclusión y cierre",
    "Información final del expediente",
  ];
  let previous = -1;
  for (const heading of headings) {
    const index = source.indexOf(`<h2>${heading}</h2>`);
    assert.ok(index > previous, `El bloque ${heading} debe existir y conservar el orden aprobado.`);
    previous = index;
  }
  assert.ok(
    source.includes("Clasificación GMP del evento según su criticidad."),
    "La clasificación debe conservar ayuda contextual.",
  );
  assert.ok(source.includes("Guardar borrador"));
  assert.ok(source.includes("Abrir desviación"));
}

async function main() {
  await cleanup();
  await assertFormStructure();

  // Borrador incompleto: guarda sin bloquear, pero conserva avisos por campo.
  const draft = new FormData();
  draft.set("saveIntent", "draft");
  draft.set("status", "DRAFT");
  const draftParsed = parseDeviationForm(draft);
  assert.deepEqual(draftParsed.errors, []);
  assert.equal(draftParsed.values.status, "DRAFT");
  assert.ok(draftParsed.fieldIssues.departmentId?.length);
  assert.ok(draftParsed.fieldIssues.whatHappened?.length);

  // Apertura incompleta: queda bloqueada.
  const invalidOpen = new FormData();
  invalidOpen.set("saveIntent", "open");
  invalidOpen.set("status", "DRAFT");
  const invalidOpenParsed = parseDeviationForm(invalidOpen);
  assert.equal(invalidOpenParsed.values.status, "OPEN");
  assert.ok(invalidOpenParsed.errors.length > 0);

  // El origen sigue siendo opcional; si se selecciona, solo exige sus dependencias.
  const supplierOrigin = fullOpenForm();
  supplierOrigin.set("provenance", "SUPPLIER");
  const supplierParsed = parseDeviationForm(supplierOrigin);
  assert.ok(supplierParsed.fieldIssues.supplier?.length);
  assert.ok(supplierParsed.fieldIssues.supplierLot?.length);
  assert.equal(supplierParsed.fieldIssues.client, undefined);

  const validOpen = fullOpenForm();
  const validOpenParsed = parseDeviationForm(validOpen);
  assert.deepEqual(validOpenParsed.errors, []);

  const department = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });

  // Sugerencia y reserva manual en borrador.
  const firstSuggestion = await suggestDeviationBusinessCode(prisma, department.code, year);
  assert.equal(firstSuggestion, `D/GC-00/001/${year}`);

  const draftRecord = await prisma.$transaction(async (tx) => {
    const code = await assignDeviationBusinessCode(tx, {
      departmentCode: department.code,
      year,
      requestedCode: manualCode,
    });
    const qmsRecord = await tx.qmsRecord.create({
      data: { recordType: QmsRecordType.DEVIATION, businessCode: code, year },
    });
    const deviation = await tx.deviation.create({
      data: {
        qmsRecordId: qmsRecord.id,
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        issueDate: new Date(`${year}-06-01`),
        createdByText: "CI D6",
        status: "DRAFT",
      },
    });
    return { qmsRecord, deviation };
  });
  assert.equal(draftRecord.qmsRecord.businessCode, manualCode);

  const nextSuggestion = await suggestDeviationBusinessCode(prisma, department.code, year);
  assert.equal(nextSuggestion, autoCode);

  // Apertura con asignación automática segura del siguiente código.
  const opened = await prisma.$transaction(async (tx) => {
    const code = await assignDeviationBusinessCode(tx, {
      departmentCode: department.code,
      year,
    });
    assert.equal(code, autoCode);
    const qmsRecord = await tx.qmsRecord.create({
      data: { recordType: QmsRecordType.DEVIATION, businessCode: code, year },
    });
    const deviation = await tx.deviation.create({
      data: {
        qmsRecordId: qmsRecord.id,
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        issueDate: new Date(`${year}-06-02`),
        eventDateTime: new Date(`${year}-06-02T10:30:00Z`),
        detectedBy: "CI D6",
        createdByText: "CI D6",
        materialProcessAffected: "Proceso D6",
        affectedDocumentation: "GC-00/023",
        whatHappened: "Evento D6",
        whoInvolved: "Usuario D6",
        whenHappened: "Durante prueba D6",
        whereHappened: "CI",
        howHappened: "Revisión controlada",
        investigation: "Investigación D6",
        investigationConclusive: "YES",
        investigationMethods: ["FIVE_WHYS"],
        rootCause: "Causa D6",
        recurrentRootCause: "NO",
        recurrenceDetails: "Sin antecedentes D6",
        classification: "MINOR",
        validationImpact: "NO",
        registrationImpact: "NO",
        stabilityImpact: "NA",
        otherProcessesImpact: "NO",
        otherProcessesImpactDetails: "Sin impacto adicional D6",
        affectsFinishedProduct: "NO",
        capaRequired: true,
        conclusion: "Conclusión D6",
        disposition: "No aplica",
        dispositionQuantity: "0",
        dispositionComments: "Sin disposición real",
        clientNotification: "NO",
        status: "OPEN",
        dataQualityStatus: "COMPLETE",
      },
    });
    return { qmsRecord, deviation };
  });

  // CAPA real + relación canónica ida/vuelta.
  const capaRecord = await prisma.qmsRecord.create({
    data: { recordType: QmsRecordType.CAPA, businessCode: capaCode, year },
  });
  await prisma.capa.create({
    data: {
      qmsRecordId: capaRecord.id,
      actionType: CapaActionType.CORRECTIVE,
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      openedAt: new Date(`${year}-06-03`),
      createdByText: "CI D6",
      originType: "Desviación",
      originCode: autoCode,
      defectDescription: "CAPA ficticia D6",
      rootCause: "Causa D6",
      status: "OPEN",
      effectivenessStatus: "PENDING",
    },
  });
  await prisma.deviationCapaPlan.create({
    data: {
      deviationId: opened.deviation.id,
      actionType: CapaActionType.CORRECTIVE,
      description: "Acción CAPA D6",
      plannedExecutionDate: new Date(`${year}-07-01`),
      responsible: "QA",
      businessCapaCode: capaCode,
      linkedCapaRecordId: capaRecord.id,
      proposalStatus: CapaProposalStatus.REGISTERED,
    },
  });

  await createQmsRelation(prisma, {
    sourceRecordId: opened.qmsRecord.id,
    targetRecordId: capaRecord.id,
    createdByText: "CI D6",
  });
  assert.equal((await getOutgoingRelations(prisma, opened.qmsRecord.id)).length, 1);
  assert.equal((await getIncomingRelations(prisma, capaRecord.id)).length, 1);

  await deactivateQmsRelation(prisma, {
    sourceRecordId: opened.qmsRecord.id,
    targetRecordId: capaRecord.id,
  });
  assert.equal((await getOutgoingRelations(prisma, opened.qmsRecord.id)).length, 0);
  assert.equal((await getIncomingRelations(prisma, capaRecord.id)).length, 0);
  assert.ok(await prisma.capa.findUnique({ where: { qmsRecordId: capaRecord.id } }));

  await createQmsRelation(prisma, {
    sourceRecordId: opened.qmsRecord.id,
    targetRecordId: capaRecord.id,
    createdByText: "CI D6 re-link",
  });
  const exactRelations = await prisma.qmsRelation.findMany({
    where: {
      sourceRecordId: opened.qmsRecord.id,
      targetRecordId: capaRecord.id,
      relationType: "GENERATES",
    },
  });
  assert.equal(exactRelations.length, 1);
  assert.equal(exactRelations[0].isActive, true);

  // Seguimiento + V00/V01 + snapshot utilizable por el Anexo III.
  const initialRecord = await prisma.deviation.findUniqueOrThrow({
    where: { id: opened.deviation.id },
    include: {
      qmsRecord: true,
      immediateActions: true,
      followups: true,
      capaPlans: { include: { linkedCapaRecord: true } },
      formVersion: true,
      anexoIIITemplateVersion: true,
    },
  });
  await prisma.$transaction((tx) =>
    ensureInitialVersion(
      tx,
      opened.qmsRecord.id,
      snapshotJson(serializeDeviationVersion(initialRecord)),
      "CI D6",
      "SYSTEM",
      "D6 V00",
    ),
  );

  await prisma.deviationFollowup.create({
    data: {
      deviationId: opened.deviation.id,
      followupDate: new Date(`${year}-06-10`),
      completedByText: "CI D6",
      followupType: "Seguimiento",
      comment: "Seguimiento D6",
      nextFollowupDate: new Date(`${year}-07-10`),
      evidenceReference: "EVID-D6",
    },
  });
  await prisma.deviation.update({
    where: { id: opened.deviation.id },
    data: { conclusion: "Conclusión D6 actualizada en V01" },
  });

  const versionedRecord = await prisma.deviation.findUniqueOrThrow({
    where: { id: opened.deviation.id },
    include: {
      qmsRecord: true,
      immediateActions: true,
      followups: true,
      capaPlans: { include: { linkedCapaRecord: true } },
      formVersion: true,
      anexoIIITemplateVersion: true,
    },
  });
  const v1 = await prisma.$transaction((tx) =>
    startNextVersion(
      tx,
      opened.qmsRecord.id,
      RecordVersionKind.FOLLOWUP,
      snapshotJson(serializeDeviationVersion(versionedRecord)),
      "CI D6",
      "Seguimiento transversal D6",
    ),
  );
  assert.equal(versionLabel(v1.sequenceNumber), "V01");

  const versions = await prisma.qmsRecordVersion.findMany({
    where: { qmsRecordId: opened.qmsRecord.id },
    orderBy: { sequenceNumber: "asc" },
  });
  assert.deepEqual(versions.map((item) => item.sequenceNumber), [0, 1]);
  assert.ok(versions[0].frozenAt);
  assert.equal(versions[1].frozenAt, null);

  const annexRecord = deviationSnapshotToAnnexRecord(versions[1].snapshot) as unknown as {
    qmsRecord: { businessCode: string | null };
    classification: string | null;
    capaPlans: unknown[];
    followups: unknown[];
  };
  assert.equal(annexRecord.qmsRecord.businessCode, autoCode);
  assert.equal(annexRecord.classification, "MINOR");
  assert.equal(annexRecord.capaPlans.length, 1);
  assert.equal(annexRecord.followups.length, 1);

  // Los borradores no cuentan como desviaciones operativas/KPI.
  const analyticsRows: AnalyticsRow[] = [
    {
      openingYear: year,
      issueDate: new Date(`${year}-06-01`),
      closedAt: null,
      status: "DRAFT",
      classification: null,
      recurrentRootCause: null,
      affectsFinishedProduct: null,
      provenance: null,
      departmentCode: department.code,
      departmentName: department.name,
      capaRequired: null,
      capaCount: 0,
    },
    {
      openingYear: year,
      issueDate: new Date(`${year}-06-02`),
      closedAt: null,
      status: "OPEN",
      classification: "MINOR",
      recurrentRootCause: "NO",
      affectsFinishedProduct: "NO",
      provenance: null,
      departmentCode: department.code,
      departmentName: department.name,
      capaRequired: true,
      capaCount: 1,
    },
  ];
  const metrics = buildYearMetrics(analyticsRows, year);
  assert.equal(metrics.total, 1);
  assert.equal(metrics.openCurrent, 1);

  console.log(
    "D6 deviations acceptance smoke passed: estructura, borrador, validaciones, origen, código, CAPA, desvinculación/revinculación, seguimiento, versionado, snapshot Anexo III e indicadores.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

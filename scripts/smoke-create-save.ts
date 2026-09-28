import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType } from "@prisma/client";
import { parseDeviationForm } from "../src/modules/deviations/validation";
import { parseCapaForm } from "../src/modules/capa/validation";

const prisma = new PrismaClient();

async function main() {
  const department = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });

  const deviationCode = "D/C3A/001/2099";
  const deviationForm = new FormData();
  deviationForm.set("businessCode", deviationCode);
  deviationForm.set("departmentId", department.id);
  deviationForm.set("issueDate", "2099-03-01");
  deviationForm.set("createdByText", "CI C3-A");
  deviationForm.set("whatHappened", "Desviación ficticia validada mediante el mismo parser del formulario.");
  deviationForm.set("status", "OPEN");
  deviationForm.set("dataQualityStatus", "REVIEW_REQUIRED");
  deviationForm.set("immediateActionsJson", "[]");
  deviationForm.set("capaPlansJson", "[]");

  const parsedDeviation = parseDeviationForm(deviationForm);
  assert.deepEqual(parsedDeviation.errors, []);

  const deviationRecord = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.DEVIATION,
      businessCode: deviationCode,
      year: 2099,
    },
  });
  const deviation = await prisma.deviation.create({
    data: {
      qmsRecordId: deviationRecord.id,
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      issueDate: new Date("2099-03-01"),
      createdByText: parsedDeviation.values.createdByText,
      whatHappened: parsedDeviation.values.whatHappened,
      status: parsedDeviation.values.status,
      dataQualityStatus: parsedDeviation.values.dataQualityStatus,
    },
  });
  await prisma.qmsRecordVersion.create({
    data: {
      qmsRecordId: deviationRecord.id,
      sequenceNumber: 0,
      kind: "INITIAL",
      snapshot: { businessCode: deviationCode, status: "OPEN" },
      reason: "Emisión inicial de la desviación",
      createdByText: parsedDeviation.actor,
      source: "UI",
    },
  });

  const storedDeviation = await prisma.deviation.findUniqueOrThrow({
    where: { id: deviation.id },
    include: { qmsRecord: { include: { versions: true } } },
  });
  assert.equal(storedDeviation.qmsRecord.versions.length, 1);
  assert.equal(storedDeviation.qmsRecord.versions[0].sequenceNumber, 0);

  const capaCode = "AC/C3A/001/2099";
  const capaForm = new FormData();
  capaForm.set("businessCode", capaCode);
  capaForm.set("actionType", "CORRECTIVE");
  capaForm.set("departmentId", department.id);
  capaForm.set("openedAt", "2099-03-02");
  capaForm.set("createdByText", "CI C3-A");
  capaForm.set("originType", "Desviación");
  capaForm.set("originCode", deviationCode);
  capaForm.set("defectDescription", "Defecto ficticio para probar la creación CAPA.");
  capaForm.set("rootCause", "Causa ficticia sustentada.");
  capaForm.set("status", "OPEN");
  capaForm.set("effectivenessStatus", "PENDING");
  capaForm.set("dataQualityStatus", "REVIEW_REQUIRED");
  capaForm.set(
    "plannedActionsJson",
    JSON.stringify([
      {
        description: "Acción ficticia validada con el mismo parser del formulario.",
        responsible: "CI",
        plannedExecutionDate: "2099-03-20",
        impact: "",
      },
    ]),
  );

  const parsedCapa = parseCapaForm(capaForm);
  assert.deepEqual(parsedCapa.errors, []);

  const capaRecord = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.CAPA,
      businessCode: capaCode,
      year: 2099,
    },
  });
  const capa = await prisma.capa.create({
    data: {
      qmsRecordId: capaRecord.id,
      actionType: parsedCapa.values.actionType,
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      openedAt: new Date("2099-03-02"),
      createdByText: parsedCapa.values.createdByText,
      originType: parsedCapa.values.originType,
      originCode: parsedCapa.values.originCode,
      defectDescription: parsedCapa.values.defectDescription,
      rootCause: parsedCapa.values.rootCause,
      status: parsedCapa.values.status,
      effectivenessStatus: parsedCapa.values.effectivenessStatus,
      dataQualityStatus: parsedCapa.values.dataQualityStatus,
      plannedActions: {
        create: parsedCapa.values.plannedActions.map((item, index) => ({
          description: item.description,
          responsible: item.responsible || null,
          plannedExecutionDate: item.plannedExecutionDate
            ? new Date(item.plannedExecutionDate)
            : null,
          impact: item.impact || null,
          sortOrder: index,
        })),
      },
    },
  });
  await prisma.qmsRecordVersion.create({
    data: {
      qmsRecordId: capaRecord.id,
      sequenceNumber: 0,
      kind: "INITIAL",
      snapshot: { businessCode: capaCode, status: "OPEN" },
      reason: "Informe inicial CAPA",
      createdByText: parsedCapa.actor,
      source: "UI",
    },
  });
  await prisma.qmsRelation.create({
    data: {
      sourceRecordId: deviationRecord.id,
      targetRecordId: capaRecord.id,
      relationType: "GENERATES",
      createdByText: parsedCapa.actor,
    },
  });

  const storedCapa = await prisma.capa.findUniqueOrThrow({
    where: { id: capa.id },
    include: {
      plannedActions: true,
      qmsRecord: { include: { versions: true, targetRelations: true } },
    },
  });
  assert.equal(storedCapa.plannedActions.length, 1);
  assert.equal(storedCapa.qmsRecord.versions.length, 1);
  assert.equal(storedCapa.qmsRecord.versions[0].sequenceNumber, 0);
  assert.ok(
    storedCapa.qmsRecord.targetRelations.some(
      (relation) =>
        relation.sourceRecordId === deviationRecord.id &&
        relation.relationType === "GENERATES",
    ),
  );

  const invalidDeviation = new FormData();
  invalidDeviation.set("issueDate", "2099-02-31");
  invalidDeviation.set("immediateActionsJson", "[]");
  invalidDeviation.set("capaPlansJson", "[]");
  const invalidDeviationParsed = parseDeviationForm(invalidDeviation);
  assert.ok(invalidDeviationParsed.fieldIssues.issueDate?.length);
  assert.ok(invalidDeviationParsed.fieldIssues.businessCode?.length);

  const invalidCapa = new FormData();
  invalidCapa.set("openedAt", "2099-02-31");
  invalidCapa.set("plannedActionsJson", "[]");
  const invalidCapaParsed = parseCapaForm(invalidCapa);
  assert.ok(invalidCapaParsed.fieldIssues.openedAt?.length);
  assert.ok(invalidCapaParsed.fieldIssues.plannedActionsJson?.length);

  console.log("Create/save validation and PostgreSQL smoke test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

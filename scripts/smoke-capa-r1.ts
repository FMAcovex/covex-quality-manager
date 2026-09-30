import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType, RecordVersionKind } from "@prisma/client";
import {
  ensureInitialVersion,
  refreshCurrentVersion,
  serializeCapaVersion,
  snapshotJson,
  startNextVersion,
} from "../src/lib/qms/versioning";
import { syncOperationalOriginRelations } from "../src/lib/qms/relation-service";
import { saveCapaExecutionEvidence } from "../src/modules/capa/followup-service";

const prisma = new PrismaClient();
const actor = "CI R1 CAPA";
const stamp = Date.now();

async function loadVersionSource(capaId: string) {
  return prisma.capa.findUniqueOrThrow({
    where: { id: capaId },
    include: {
      qmsRecord: true,
      plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      actionFollowups: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: { orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }] },
      formVersion: true,
      annexIIITemplateVersion: true,
    },
  });
}

async function main() {
  const department = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });
  const deviationRecord = await prisma.qmsRecord.create({
    data: { recordType: QmsRecordType.DEVIATION, businessCode: `D/R1/${stamp}/2098`, year: 2098 },
  });
  const complaintRecord = await prisma.qmsRecord.create({
    data: { recordType: QmsRecordType.COMPLAINT, businessCode: `REC-R1-${stamp}-2098`, year: 2098 },
  });
  const capaRecord = await prisma.qmsRecord.create({
    data: { recordType: QmsRecordType.CAPA, businessCode: `AC/R1/${stamp}/2098`, year: 2098 },
  });

  try {
    await prisma.deviation.create({
      data: {
        qmsRecordId: deviationRecord.id,
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        issueDate: new Date("2098-01-01"),
        whatHappened: "Origen R1",
        createdByText: actor,
      },
    });
    await prisma.complaint.create({
      data: {
        qmsRecordId: complaintRecord.id,
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        openedAt: new Date("2098-01-01"),
        createdByText: actor,
        complaintType: "CUSTOMER",
        partyName: "Cliente R1",
        description: "Reclamación origen R1",
      },
    });
    const capa = await prisma.capa.create({
      data: {
        qmsRecordId: capaRecord.id,
        actionType: "CORRECTIVE",
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        openedAt: new Date("2098-01-02"),
        createdByText: actor,
        originType: "Desviación",
        originCode: deviationRecord.businessCode,
        applicableTo: "Sistema R1",
        defectDescription: "Defecto R1",
        rootCause: "Causa R1",
        status: "OPEN",
        effectivenessStatus: "PENDING",
        nextFollowupDate: new Date("2098-02-01"),
        plannedActions: {
          create: [{ description: "Acción R1", responsible: actor, plannedExecutionDate: new Date("2098-01-20"), sortOrder: 0 }],
        },
      },
    });

    await prisma.$transaction(async (tx) => {
      await syncOperationalOriginRelations(tx, {
        capaRecordId: capaRecord.id,
        originRecordIds: [deviationRecord.id, complaintRecord.id],
        changedByText: actor,
      });
    });

    let source = await loadVersionSource(capa.id);
    await prisma.$transaction(async (tx) => {
      await ensureInitialVersion(
        tx,
        capaRecord.id,
        snapshotJson(serializeCapaVersion(source)),
        actor,
        "UI",
        "Seguimiento 00 R1",
      );
    });

    await prisma.capa.update({
      where: { id: capa.id },
      data: { defectDescription: "Defecto R1 actualizado sin nueva versión" },
    });
    source = await loadVersionSource(capa.id);
    await prisma.$transaction(async (tx) => {
      await refreshCurrentVersion(
        tx,
        capaRecord.id,
        snapshotJson(serializeCapaVersion(source)),
        actor,
        "Edición ordinaria",
      );
    });
    let versions = await prisma.qmsRecordVersion.findMany({
      where: { qmsRecordId: capaRecord.id },
      orderBy: { sequenceNumber: "asc" },
    });
    assert.deepEqual(versions.map((item) => item.sequenceNumber), [0]);
    assert.equal(versions[0].frozenAt, null);

    await prisma.capa.update({
      where: { id: capa.id },
      data: {
        nextFollowupDate: new Date("2098-03-01"),
        actionFollowupObservations: "Observación R1",
        actionFollowups: {
          create: [{ followupDate: new Date("2098-02-01"), description: "Comprobación R1", sortOrder: 0 }],
        },
      },
    });
    source = await loadVersionSource(capa.id);
    await prisma.$transaction(async (tx) => {
      await startNextVersion(
        tx,
        capaRecord.id,
        RecordVersionKind.FOLLOWUP,
        snapshotJson(serializeCapaVersion(source)),
        actor,
        "Seguimiento funcional R1",
      );
    });

    versions = await prisma.qmsRecordVersion.findMany({
      where: { qmsRecordId: capaRecord.id },
      orderBy: { sequenceNumber: "asc" },
    });
    assert.deepEqual(versions.map((item) => item.sequenceNumber), [0, 1]);
    assert.ok(versions[0].frozenAt);
    assert.equal(versions[1].frozenAt, null);

    const latestSnapshot = versions[1].snapshot as {
      capa?: {
        nextFollowupDate?: string | null;
        actionFollowupObservations?: string | null;
        actionFollowups?: Array<{ description?: string | null }>;
      };
    };
    assert.match(latestSnapshot.capa?.nextFollowupDate ?? "", /^2098-03-01/);
    assert.equal(latestSnapshot.capa?.actionFollowupObservations, "Observación R1");
    assert.equal(latestSnapshot.capa?.actionFollowups?.[0]?.description, "Comprobación R1");

    const evidenceForm = new FormData();
    evidenceForm.set("followupDate", "2098-02-15");
    evidenceForm.set("completedByText", actor);
    evidenceForm.set("evidenceReference", "EV-R1-001");
    evidenceForm.set("observations", "Evidencia de ejecución R1");
    const evidenceResult = await saveCapaExecutionEvidence(capa.id, evidenceForm);
    assert.equal(evidenceResult.error, undefined);
    assert.equal(evidenceResult.success, "Evidencia de ejecución registrada correctamente.");

    const evidenceRows = await prisma.capaFollowup.findMany({
      where: { capaId: capa.id, evidenceReference: { not: null } },
    });
    assert.equal(evidenceRows.length, 1);
    assert.equal(evidenceRows[0].evidenceReference, "EV-R1-001");

    versions = await prisma.qmsRecordVersion.findMany({
      where: { qmsRecordId: capaRecord.id },
      orderBy: { sequenceNumber: "asc" },
    });
    assert.deepEqual(versions.map((item) => item.sequenceNumber), [0, 1]);

    let relations = await prisma.qmsRelation.findMany({
      where: { targetRecordId: capaRecord.id, isActive: true },
    });
    assert.equal(relations.length, 2);

    await prisma.$transaction(async (tx) => {
      await syncOperationalOriginRelations(tx, {
        capaRecordId: capaRecord.id,
        originRecordIds: [complaintRecord.id],
        changedByText: actor,
      });
    });
    relations = await prisma.qmsRelation.findMany({
      where: { targetRecordId: capaRecord.id, isActive: true },
    });
    assert.equal(relations.length, 1);
    assert.equal(relations[0].sourceRecordId, complaintRecord.id);

    console.log("R1 CAPA smoke passed: action follow-up, execution evidence without new version, next date, multi-origin and Seguimiento 00→01.");
  } finally {
    await prisma.qmsRelation.deleteMany({
      where: { OR: [{ sourceRecordId: { in: [deviationRecord.id, complaintRecord.id] } }, { targetRecordId: capaRecord.id }] },
    });
    await prisma.changeHistory.deleteMany({ where: { qmsRecordId: capaRecord.id } });
    await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: capaRecord.id } });
    await prisma.capa.deleteMany({ where: { qmsRecordId: capaRecord.id } });
    await prisma.complaint.deleteMany({ where: { qmsRecordId: complaintRecord.id } });
    await prisma.deviation.deleteMany({ where: { qmsRecordId: deviationRecord.id } });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: [deviationRecord.id, complaintRecord.id, capaRecord.id] } } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

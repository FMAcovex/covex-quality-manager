import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType } from "@prisma/client";
import {
  createQmsRelation,
  getIncomingRelations,
  getOutgoingRelations,
} from "../src/lib/qms/relation-service";
import { canRelate } from "../src/lib/qms/relation-rules";
import { qmsRecordHref } from "../src/lib/qms/record-links";

const prisma = new PrismaClient();

async function main() {
  const department = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });
  const existingRelations = await prisma.qmsRelation.findMany({
    include: { sourceRecord: true, targetRecord: true },
  });
  const incompatibleHistoricalRelations = existingRelations.filter(
    (relation) =>
      relation.sourceRecordId === relation.targetRecordId ||
      !canRelate(
        relation.sourceRecord.recordType,
        relation.targetRecord.recordType,
        relation.relationType,
      ),
  );
  if (incompatibleHistoricalRelations.length) {
    console.warn(
      "Relaciones históricas fuera de la matriz B1 (no modificadas):",
      incompatibleHistoricalRelations.map((relation) => ({
        id: relation.id,
        source: relation.sourceRecord.businessCode ?? relation.sourceRecordId,
        target: relation.targetRecord.businessCode ?? relation.targetRecordId,
        relationType: relation.relationType,
      })),
    );
  }
  console.log(
    `Relaciones históricas incompatibles detectadas: ${incompatibleHistoricalRelations.length}`,
  );

  const records = await Promise.all([
    prisma.qmsRecord.create({
      data: { recordType: QmsRecordType.DEVIATION, businessCode: "D/B3/001/2098", year: 2098 },
    }),
    prisma.qmsRecord.create({
      data: { recordType: QmsRecordType.COMPLAINT, businessCode: "R/B3/001/2098", year: 2098 },
    }),
    prisma.qmsRecord.create({
      data: { recordType: QmsRecordType.CAPA, businessCode: "AC/B3/001/2098", year: 2098 },
    }),
    prisma.qmsRecord.create({
      data: { recordType: QmsRecordType.CAPA, businessCode: "AC/B3/002/2098", year: 2098 },
    }),
    prisma.qmsRecord.create({
      data: { recordType: QmsRecordType.RETURN, businessCode: "DEV/B3/001/2098", year: 2098 },
    }),
  ]);

  const [deviationQr, complaintQr, deviationCapaQr, complaintCapaQr, returnQr] = records;

  try {
    await prisma.deviation.create({
      data: {
        qmsRecordId: deviationQr.id,
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        issueDate: new Date("2098-04-01"),
        createdByText: "CI B3",
        whatHappened: "Desviación ficticia para prueba transversal de relaciones.",
      },
    });

    await prisma.complaint.create({
      data: {
        qmsRecordId: complaintQr.id,
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        openedAt: new Date("2098-04-02"),
        createdByText: "CI B3",
        complaintType: "CUSTOMER",
        partyName: "Cliente ficticio B3",
        description: "Reclamación ficticia para prueba transversal de relaciones.",
      },
    });

    await prisma.capa.createMany({
      data: [
        {
          qmsRecordId: deviationCapaQr.id,
          actionType: "CORRECTIVE",
          departmentId: department.id,
          departmentCodeSnapshot: department.code,
          departmentNameSnapshot: department.name,
          openedAt: new Date("2098-04-03"),
          createdByText: "CI B3",
          originType: "Desviación",
          originCode: deviationQr.businessCode,
          defectDescription: "Defecto ficticio D-CAPA.",
          rootCause: "Causa ficticia.",
        },
        {
          qmsRecordId: complaintCapaQr.id,
          actionType: "CORRECTIVE",
          departmentId: department.id,
          departmentCodeSnapshot: department.code,
          departmentNameSnapshot: department.name,
          openedAt: new Date("2098-04-04"),
          createdByText: "CI B3",
          originType: "Reclamación",
          originCode: complaintQr.businessCode,
          defectDescription: "Defecto ficticio R-CAPA.",
          rootCause: "Causa ficticia.",
        },
      ],
    });

    await prisma.returnRecord.create({
      data: {
        qmsRecordId: returnQr.id,
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        communicationDate: new Date("2098-04-05"),
        createdByText: "CI B3",
        returnType: "COMPLAINT",
        customerEntity: "Cliente ficticio B3",
        reasonObservations: "Devolución ficticia vinculada a reclamación.",
      },
    });

    const desired = [
      { sourceRecordId: deviationQr.id, targetRecordId: deviationCapaQr.id },
      { sourceRecordId: complaintQr.id, targetRecordId: complaintCapaQr.id },
      { sourceRecordId: complaintQr.id, targetRecordId: returnQr.id },
    ];

    for (const relation of desired) {
      await createQmsRelation(prisma, { ...relation, createdByText: "CI B3" });
    }
    await createQmsRelation(prisma, { ...desired[0], createdByText: "CI B3 duplicado" });

    const capaOrigins = await getIncomingRelations(prisma, deviationCapaQr.id);
    assert.equal(capaOrigins.length, 1);
    assert.equal(capaOrigins[0].sourceRecord.recordType, QmsRecordType.DEVIATION);
    const complaintDerived = await getOutgoingRelations(prisma, complaintQr.id);
    assert.deepEqual(
      complaintDerived.map((relation) => relation.targetRecord.recordType).sort(),
      [QmsRecordType.CAPA, QmsRecordType.RETURN].sort(),
    );

    const deviation = await prisma.deviation.findFirstOrThrow({
      where: { qmsRecordId: deviationQr.id },
      include: {
        qmsRecord: {
          include: {
            sourceRelations: { include: { targetRecord: true } },
            targetRelations: { include: { sourceRecord: true } },
          },
        },
      },
    });
    assert.equal(deviation.qmsRecord.sourceRelations.length, 1);
    assert.equal(deviation.qmsRecord.sourceRelations[0].targetRecord.recordType, QmsRecordType.CAPA);
    assert.equal(deviation.qmsRecord.targetRelations.length, 0);

    const capas = await prisma.capa.findMany({
      where: { qmsRecordId: { in: [deviationCapaQr.id, complaintCapaQr.id] } },
      include: {
        qmsRecord: {
          include: {
            targetRelations: { include: { sourceRecord: true } },
            sourceRelations: true,
          },
        },
      },
      orderBy: { openedAt: "asc" },
    });
    assert.equal(capas.length, 2);
    assert.equal(capas[0].qmsRecord.targetRelations[0].sourceRecord.recordType, QmsRecordType.DEVIATION);
    assert.equal(capas[1].qmsRecord.targetRelations[0].sourceRecord.recordType, QmsRecordType.COMPLAINT);
    assert.equal(capas[0].qmsRecord.sourceRelations.length, 0);
    assert.equal(capas[1].qmsRecord.sourceRelations.length, 0);

    const complaint = await prisma.complaint.findFirstOrThrow({
      where: { qmsRecordId: complaintQr.id },
      include: {
        qmsRecord: {
          include: {
            sourceRelations: { include: { targetRecord: true } },
            targetRelations: true,
          },
        },
      },
    });
    assert.deepEqual(
      complaint.qmsRecord.sourceRelations
        .map((relation) => relation.targetRecord.recordType)
        .sort(),
      [QmsRecordType.CAPA, QmsRecordType.RETURN].sort(),
    );
    assert.equal(complaint.qmsRecord.targetRelations.length, 0);

    const returnRecord = await prisma.returnRecord.findFirstOrThrow({
      where: { qmsRecordId: returnQr.id },
      include: {
        qmsRecord: {
          include: {
            targetRelations: { include: { sourceRecord: true } },
            sourceRelations: true,
          },
        },
      },
    });
    assert.equal(returnRecord.qmsRecord.targetRelations.length, 1);
    assert.equal(returnRecord.qmsRecord.targetRelations[0].sourceRecord.recordType, QmsRecordType.COMPLAINT);
    assert.equal(returnRecord.qmsRecord.sourceRelations.length, 0);

    const reverseDuplicates = await prisma.qmsRelation.count({
      where: {
        OR: [
          { sourceRecordId: deviationCapaQr.id, targetRecordId: deviationQr.id },
          { sourceRecordId: complaintCapaQr.id, targetRecordId: complaintQr.id },
          { sourceRecordId: returnQr.id, targetRecordId: complaintQr.id },
        ],
      },
    });
    assert.equal(reverseDuplicates, 0);

    const createdRelations = await prisma.qmsRelation.count({
      where: {
        OR: desired.map((relation) => ({
          sourceRecordId: relation.sourceRecordId,
          targetRecordId: relation.targetRecordId,
          relationType: "GENERATES" as const,
        })),
      },
    });
    assert.equal(createdRelations, 3);

    assert.equal(qmsRecordHref(QmsRecordType.CAPA, deviationCapaQr.id), `/qms/${deviationCapaQr.id}`);
    assert.equal(qmsRecordHref(QmsRecordType.COMPLAINT, complaintQr.id), `/qms/${complaintQr.id}`);
    assert.equal(qmsRecordHref(QmsRecordType.RETURN, returnQr.id), `/qms/${returnQr.id}`);

    console.log("Operational QMS relations transversal smoke test passed.");
  } finally {
    const ids = records.map((record) => record.id);
    await prisma.qmsRelation.deleteMany({
      where: {
        OR: [
          { sourceRecordId: { in: ids } },
          { targetRecordId: { in: ids } },
        ],
      },
    });
    await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.capa.deleteMany({ where: { qmsRecordId: { in: [deviationCapaQr.id, complaintCapaQr.id] } } });
    await prisma.returnRecord.deleteMany({ where: { qmsRecordId: returnQr.id } });
    await prisma.complaint.deleteMany({ where: { qmsRecordId: complaintQr.id } });
    await prisma.deviation.deleteMany({ where: { qmsRecordId: deviationQr.id } });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

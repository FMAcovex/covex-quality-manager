import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const deviationRecord = await prisma.qmsRecord.create({
    data: { recordType: QmsRecordType.DEVIATION, year: 2099 },
  });
  const capaRecord = await prisma.qmsRecord.create({
    data: { recordType: QmsRecordType.CAPA, year: 2099 },
  });

  try {
    const deviationV00 = await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: deviationRecord.id,
        sequenceNumber: 0,
        kind: "INITIAL",
        snapshot: {
          recordType: "DEVIATION",
          deviation: {
            status: "OPEN",
            closedAt: null,
            investigation: "Investigación inicial V00",
          },
        },
        frozenAt: new Date(),
      },
    });
    const deviationV01 = await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: deviationRecord.id,
        sequenceNumber: 1,
        kind: "FOLLOWUP",
        snapshot: {
          recordType: "DEVIATION",
          deviation: {
            status: "CLOSED",
            closedAt: "2099-01-15T00:00:00.000Z",
            investigation: "Investigación completada V01",
          },
        },
        frozenAt: new Date(),
      },
    });
    const deviationV02 = await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: deviationRecord.id,
        sequenceNumber: 2,
        kind: "REOPENING",
        snapshot: {
          recordType: "DEVIATION",
          deviation: {
            status: "OPEN",
            closedAt: null,
            investigation: "Investigación ampliada V02",
          },
        },
      },
    });

    const deviationVersions = await prisma.qmsRecordVersion.findMany({
      where: { qmsRecordId: deviationRecord.id },
      orderBy: { sequenceNumber: "asc" },
    });
    assert.deepEqual(deviationVersions.map((item) => item.sequenceNumber), [0, 1, 2]);
    assert.deepEqual(deviationVersions.map((item) => item.kind), ["INITIAL", "FOLLOWUP", "REOPENING"]);
    assert.equal(deviationV00.sequenceNumber, 0);
    assert.equal(deviationV01.sequenceNumber, 1);
    assert.equal(deviationV02.sequenceNumber, 2);

    await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: capaRecord.id,
        sequenceNumber: 0,
        kind: "INITIAL",
        snapshot: {
          recordType: "CAPA",
          capa: { status: "OPEN", effectivenessStatus: "PENDING", followups: [] },
        },
        frozenAt: new Date(),
      },
    });
    await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: capaRecord.id,
        sequenceNumber: 1,
        kind: "FOLLOWUP",
        snapshot: {
          recordType: "CAPA",
          capa: {
            status: "CLOSED",
            effectivenessStatus: "PENDING",
            operationalClosedAt: "2099-02-01T00:00:00.000Z",
            followups: [{ sequenceNumber: 1, nextFollowupDate: "2099-03-01T00:00:00.000Z" }],
          },
        },
        frozenAt: new Date(),
      },
    });
    await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: capaRecord.id,
        sequenceNumber: 2,
        kind: "FOLLOWUP",
        snapshot: {
          recordType: "CAPA",
          capa: {
            status: "CLOSED",
            effectivenessStatus: "CONFORMING",
            effectiveClosedAt: "2099-03-01T00:00:00.000Z",
            followups: [
              { sequenceNumber: 1, nextFollowupDate: "2099-03-01T00:00:00.000Z" },
              { sequenceNumber: 2, nextFollowupDate: null },
            ],
          },
        },
      },
    });

    const versions = await prisma.qmsRecordVersion.findMany({
      where: { qmsRecordId: capaRecord.id },
      orderBy: { sequenceNumber: "asc" },
    });
    assert.deepEqual(versions.map((item) => item.sequenceNumber), [0, 1, 2]);
    assert.deepEqual(versions.map((item) => item.kind), ["INITIAL", "FOLLOWUP", "FOLLOWUP"]);

    console.log("Record versioning PostgreSQL smoke test passed.");
  } finally {
    await prisma.qmsRecordVersion.deleteMany({
      where: { qmsRecordId: { in: [deviationRecord.id, capaRecord.id] } },
    });
    await prisma.qmsRecord.deleteMany({
      where: { id: { in: [deviationRecord.id, capaRecord.id] } },
    });
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

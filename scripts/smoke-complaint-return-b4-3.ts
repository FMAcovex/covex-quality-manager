import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType } from "@prisma/client";
import {
  getComplaintReturnOrigin,
  registerComplaintReturnOrigin,
} from "../src/modules/returns/complaint-origin";
import { createQmsRelation } from "../src/lib/qms/relation-service";
import { qmsRecordHref } from "../src/lib/qms/record-links";

const prisma = new PrismaClient();

const complaintCode = "R/B43/001/2095";
const returnCodes = ["DEV/B43/001/2095", "DEV/B43/002/2095"] as const;
const allCodes = [complaintCode, ...returnCodes];

async function cleanup() {
  const records = await prisma.qmsRecord.findMany({
    where: { businessCode: { in: [...allCodes] } },
    select: { id: true, recordType: true },
  });
  if (!records.length) return;

  const ids = records.map((record) => record.id);
  const returnIds = records
    .filter((record) => record.recordType === QmsRecordType.RETURN)
    .map((record) => record.id);
  const complaintIds = records
    .filter((record) => record.recordType === QmsRecordType.COMPLAINT)
    .map((record) => record.id);

  await prisma.qmsRelation.deleteMany({
    where: {
      OR: [
        { sourceRecordId: { in: ids } },
        { targetRecordId: { in: ids } },
      ],
    },
  });
  await prisma.returnRecord.deleteMany({
    where: { qmsRecordId: { in: returnIds } },
  });
  await prisma.complaint.deleteMany({
    where: { qmsRecordId: { in: complaintIds } },
  });
  await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
}

async function createReturnFromComplaint(input: {
  complaintId: string;
  businessCode: string;
  productNameCode: string;
  lot: string;
  department: { id: string; code: string; name: string };
}) {
  return prisma.$transaction(async (tx) => {
    const origin = await getComplaintReturnOrigin(tx, input.complaintId);

    const qmsRecord = await tx.qmsRecord.create({
      data: {
        recordType: QmsRecordType.RETURN,
        businessCode: input.businessCode,
        year: 2095,
      },
    });

    const returnRecord = await tx.returnRecord.create({
      data: {
        qmsRecordId: qmsRecord.id,
        departmentId: input.department.id,
        departmentCodeSnapshot: input.department.code,
        departmentNameSnapshot: input.department.name,
        communicationDate: new Date("2095-08-02"),
        createdByText: "CI B4.3",
        returnType: "COMPLAINT",
        customerEntity: "Cliente ficticio B4.3",
        relatedDocument: origin.complaintBusinessCode,
        reasonObservations: "Devolución ficticia derivada de reclamación para B4.3.",
        products: {
          create: {
            departmentId: input.department.id,
            productType: "OTHER",
            otherProductType: "Producto ficticio",
            productNameCode: input.productNameCode,
            lot: input.lot,
            quantity: "1",
            unit: "ud",
            sortOrder: 0,
          },
        },
      },
    });

    await registerComplaintReturnOrigin(tx, {
      complaintQmsRecordId: origin.complaintQmsRecordId,
      returnQmsRecordId: qmsRecord.id,
      actor: "CI B4.3",
    });

    return { qmsRecord, returnRecord };
  });
}

async function main() {
  await cleanup();

  const department = await prisma.department.findUniqueOrThrow({
    where: { code: "GC-00" },
  });

  const complaintRecord = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.COMPLAINT,
      businessCode: complaintCode,
      year: 2095,
    },
  });

  try {
    const complaint = await prisma.complaint.create({
      data: {
        qmsRecordId: complaintRecord.id,
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        openedAt: new Date("2095-08-01"),
        createdByText: "CI B4.3",
        complaintType: "CUSTOMER",
        partyName: "Cliente ficticio B4.3",
        description:
          "Reclamación ficticia que origina dos devoluciones para prueba transversal.",
      },
    });

    const created1 = await createReturnFromComplaint({
      complaintId: complaint.id,
      businessCode: returnCodes[0],
      productNameCode: "PRODUCTO-B43-A",
      lot: "LOTE-B43-A",
      department,
    });
    const created2 = await createReturnFromComplaint({
      complaintId: complaint.id,
      businessCode: returnCodes[1],
      productNameCode: "PRODUCTO-B43-B",
      lot: "LOTE-B43-B",
      department,
    });

    await createQmsRelation(prisma, {
      sourceRecordId: complaintRecord.id,
      targetRecordId: created1.qmsRecord.id,
      createdByText: "CI B4.3 duplicate attempt",
    });
    await createQmsRelation(prisma, {
      sourceRecordId: complaintRecord.id,
      targetRecordId: created2.qmsRecord.id,
      createdByText: "CI B4.3 duplicate attempt",
    });

    const storedComplaint = await prisma.complaint.findUniqueOrThrow({
      where: { id: complaint.id },
      include: {
        qmsRecord: {
          include: {
            sourceRelations: {
              where: { isActive: true, relationType: "GENERATES" },
              include: { targetRecord: true },
            },
            targetRelations: { where: { isActive: true } },
          },
        },
      },
    });

    const returnRelations = storedComplaint.qmsRecord.sourceRelations.filter(
      (relation) => relation.targetRecord.recordType === QmsRecordType.RETURN,
    );
    assert.equal(returnRelations.length, 2);
    assert.deepEqual(
      returnRelations
        .map((relation) => relation.targetRecord.businessCode)
        .sort(),
      [...returnCodes].sort(),
    );
    assert.equal(storedComplaint.qmsRecord.targetRelations.length, 0);

    const exactRelations = await prisma.qmsRelation.findMany({
      where: {
        sourceRecordId: complaintRecord.id,
        targetRecordId: { in: [created1.qmsRecord.id, created2.qmsRecord.id] },
        relationType: "GENERATES",
      },
    });
    assert.equal(exactRelations.length, 2);

    const reverseRelations = await prisma.qmsRelation.count({
      where: {
        sourceRecordId: { in: [created1.qmsRecord.id, created2.qmsRecord.id] },
        targetRecordId: complaintRecord.id,
      },
    });
    assert.equal(reverseRelations, 0);

    const storedReturns = await prisma.returnRecord.findMany({
      where: {
        qmsRecordId: { in: [created1.qmsRecord.id, created2.qmsRecord.id] },
      },
      include: {
        products: true,
        qmsRecord: {
          include: {
            targetRelations: {
              where: { isActive: true, relationType: "GENERATES" },
              include: { sourceRecord: true },
            },
            sourceRelations: { where: { isActive: true } },
          },
        },
      },
      orderBy: { qmsRecord: { businessCode: "asc" } },
    });

    assert.equal(storedReturns.length, 2);
    for (const returnRecord of storedReturns) {
      assert.equal(returnRecord.returnType, "COMPLAINT");
      assert.equal(returnRecord.relatedDocument, complaintCode);
      assert.equal(returnRecord.products.length, 1);
      assert.equal(returnRecord.qmsRecord.targetRelations.length, 1);
      assert.equal(
        returnRecord.qmsRecord.targetRelations[0].sourceRecordId,
        complaintRecord.id,
      );
      assert.equal(
        returnRecord.qmsRecord.targetRelations[0].sourceRecord.recordType,
        QmsRecordType.COMPLAINT,
      );
      assert.equal(
        returnRecord.qmsRecord.targetRelations[0].sourceRecord.businessCode,
        complaintCode,
      );
      assert.equal(returnRecord.qmsRecord.sourceRelations.length, 0);

      assert.equal(
        qmsRecordHref(QmsRecordType.RETURN, returnRecord.qmsRecordId),
        `/qms/${returnRecord.qmsRecordId}`,
      );
    }

    assert.equal(
      qmsRecordHref(QmsRecordType.COMPLAINT, complaintRecord.id),
      `/qms/${complaintRecord.id}`,
    );

    console.log(
      "B4.3 transversal smoke passed: 1 reclamación, 2 devoluciones, 2 relaciones, origen canónico, navegación ida/vuelta y 0 duplicados.",
    );
  } finally {
    await cleanup();
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

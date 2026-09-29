import assert from "node:assert/strict";
import {
  CapaActionType,
  CapaProposalStatus,
  PrismaClient,
  QmsRecordType,
} from "@prisma/client";
import {
  getComplaintCapaPlanOrigin,
  registerComplaintCapaPlan,
} from "../src/modules/capa/complaint-origin";
import { capaPlanNavigation } from "../src/modules/capa/proposal-ui";
import { createQmsRelation } from "../src/lib/qms/relation-service";
import { qmsRecordHref } from "../src/lib/qms/record-links";

const prisma = new PrismaClient();

const complaintCode = "R/B33/001/2096";
const capaCodes = ["AC/B33/001/2096", "AP/B33/002/2096"] as const;
const allCodes = [complaintCode, ...capaCodes];

async function cleanup() {
  const records = await prisma.qmsRecord.findMany({
    where: { businessCode: { in: [...allCodes] } },
    select: { id: true, recordType: true },
  });
  if (!records.length) return;

  const ids = records.map((record) => record.id);
  const capaIds = records
    .filter((record) => record.recordType === QmsRecordType.CAPA)
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
  await prisma.capa.deleteMany({ where: { qmsRecordId: { in: capaIds } } });
  await prisma.complaint.deleteMany({ where: { qmsRecordId: { in: complaintIds } } });
  await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
}

async function createCapaFromComplaintPlan(input: {
  planId: string;
  businessCode: string;
  actionType: CapaActionType;
  department: { id: string; code: string; name: string };
}) {
  return prisma.$transaction(async (tx) => {
    const origin = await getComplaintCapaPlanOrigin(tx, input.planId);

    const qmsRecord = await tx.qmsRecord.create({
      data: {
        recordType: QmsRecordType.CAPA,
        businessCode: input.businessCode,
        year: 2096,
      },
    });

    const capa = await tx.capa.create({
      data: {
        qmsRecordId: qmsRecord.id,
        actionType: input.actionType,
        departmentId: input.department.id,
        departmentCodeSnapshot: input.department.code,
        departmentNameSnapshot: input.department.name,
        openedAt: new Date("2096-07-02"),
        createdByText: "CI B3.3",
        originType: "Reclamación",
        originCode: origin.complaintBusinessCode,
        defectDescription: `CAPA ficticia creada desde propuesta ${input.planId}.`,
        rootCause: "Causa ficticia para B3.3.",
        status: "OPEN",
        effectivenessStatus: "PENDING",
        dataQualityStatus: "REVIEW_REQUIRED",
        plannedActions: {
          create: {
            description: `Acción ficticia para ${input.businessCode}.`,
            responsible: "CI",
            plannedExecutionDate: new Date("2096-07-31"),
            sortOrder: 0,
          },
        },
      },
    });

    await registerComplaintCapaPlan(tx, {
      planId: origin.planId,
      capaQmsRecordId: qmsRecord.id,
      capaBusinessCode: input.businessCode,
      actor: "CI B3.3",
    });

    return { qmsRecord, capa };
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
      year: 2096,
    },
  });

  try {
    const complaint = await prisma.complaint.create({
      data: {
        qmsRecordId: complaintRecord.id,
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        openedAt: new Date("2096-07-01"),
        createdByText: "CI B3.3",
        complaintType: "CUSTOMER",
        partyName: "Cliente ficticio B3.3",
        description: "Reclamación ficticia con dos propuestas CAPA para prueba transversal.",
      },
    });

    const plan1 = await prisma.complaintCapaPlan.create({
      data: {
        complaintId: complaint.id,
        actionType: CapaActionType.CORRECTIVE,
        description: "Primera propuesta CAPA de la reclamación.",
        responsible: "QA",
        plannedExecutionDate: new Date("2096-07-20"),
      },
    });
    const plan2 = await prisma.complaintCapaPlan.create({
      data: {
        complaintId: complaint.id,
        actionType: CapaActionType.PREVENTIVE,
        description: "Segunda propuesta CAPA de la reclamación.",
        responsible: "Producción",
        plannedExecutionDate: new Date("2096-07-25"),
      },
    });

    assert.equal(plan1.proposalStatus, CapaProposalStatus.PROPOSED);
    assert.equal(plan2.proposalStatus, CapaProposalStatus.PROPOSED);

    const created1 = await createCapaFromComplaintPlan({
      planId: plan1.id,
      businessCode: capaCodes[0],
      actionType: CapaActionType.CORRECTIVE,
      department,
    });
    const created2 = await createCapaFromComplaintPlan({
      planId: plan2.id,
      businessCode: capaCodes[1],
      actionType: CapaActionType.PREVENTIVE,
      department,
    });

    await createQmsRelation(prisma, {
      sourceRecordId: complaintRecord.id,
      targetRecordId: created1.qmsRecord.id,
      createdByText: "CI B3.3 duplicate attempt",
    });
    await createQmsRelation(prisma, {
      sourceRecordId: complaintRecord.id,
      targetRecordId: created2.qmsRecord.id,
      createdByText: "CI B3.3 duplicate attempt",
    });

    const storedComplaint = await prisma.complaint.findUniqueOrThrow({
      where: { id: complaint.id },
      include: {
        capaPlans: {
          include: { linkedCapaRecord: true },
        },
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

    assert.equal(storedComplaint.capaPlans.length, 2);

    const storedPlan1 = storedComplaint.capaPlans.find((plan) => plan.id === plan1.id);
    const storedPlan2 = storedComplaint.capaPlans.find((plan) => plan.id === plan2.id);
    assert.ok(storedPlan1);
    assert.ok(storedPlan2);

    assert.equal(storedPlan1.proposalStatus, CapaProposalStatus.REGISTERED);
    assert.equal(storedPlan1.linkedCapaRecordId, created1.qmsRecord.id);
    assert.equal(storedPlan1.businessCapaCode, capaCodes[0]);
    assert.equal(storedPlan2.proposalStatus, CapaProposalStatus.REGISTERED);
    assert.equal(storedPlan2.linkedCapaRecordId, created2.qmsRecord.id);
    assert.equal(storedPlan2.businessCapaCode, capaCodes[1]);

    assert.equal(storedComplaint.qmsRecord.sourceRelations.length, 2);
    assert.deepEqual(
      storedComplaint.qmsRecord.sourceRelations
        .map((relation) => relation.targetRecord.businessCode)
        .sort(),
      [...capaCodes].sort(),
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

    const storedCapas = await prisma.capa.findMany({
      where: { qmsRecordId: { in: [created1.qmsRecord.id, created2.qmsRecord.id] } },
      include: {
        qmsRecord: {
          include: {
            targetRelations: {
              where: { isActive: true, relationType: "GENERATES" },
              include: { sourceRecord: true },
            },
          },
        },
      },
    });

    assert.equal(storedCapas.length, 2);
    for (const capa of storedCapas) {
      assert.equal(capa.qmsRecord.targetRelations.length, 1);
      assert.equal(capa.qmsRecord.targetRelations[0].sourceRecordId, complaintRecord.id);
      assert.equal(
        capa.qmsRecord.targetRelations[0].sourceRecord.recordType,
        QmsRecordType.COMPLAINT,
      );
      assert.equal(
        capa.qmsRecord.targetRelations[0].sourceRecord.businessCode,
        complaintCode,
      );
    }

    for (const plan of [storedPlan1, storedPlan2]) {
      const navigation = capaPlanNavigation({
        proposalStatus: plan.proposalStatus,
        linkedCapaRecordId: plan.linkedCapaRecordId,
      });
      assert.equal(navigation.kind, "OPEN");
      if (navigation.kind === "OPEN") {
        assert.equal(
          qmsRecordHref(QmsRecordType.CAPA, navigation.recordId),
          `/qms/${navigation.recordId}`,
        );
      }
    }

    assert.equal(
      qmsRecordHref(QmsRecordType.COMPLAINT, complaintRecord.id),
      `/qms/${complaintRecord.id}`,
    );

    console.log(
      "B3.3 transversal smoke passed: 1 reclamación, 2 propuestas, 2 CAPA, 2 relaciones, navegación ida/vuelta y 0 duplicados.",
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

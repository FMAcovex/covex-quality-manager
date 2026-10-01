import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType, RecordVersionKind } from "@prisma/client";
import {
  complaintSnapshotToAnnexRecord,
  complaintSnapshotVersionFollowupDate,
  ensureInitialVersion,
  serializeComplaintVersion,
  snapshotJson,
  startNextVersion,
} from "../src/lib/qms/versioning";
import { createQmsRelation } from "../src/lib/qms/relation-service";
import {
  getSignedVersionDocumentBySequence,
  storeSignedVersionPdf,
} from "../src/lib/qms/signed-version-document";

const prisma = new PrismaClient();
const actor = "CI R3 Reclamaciones";
const stamp = Date.now();
const year = 2097;
const complaintCode = `R/C/R3-${stamp}/${year}`;
const capaCode = `AC/R3-COMP-${stamp}/${year}`;
const returnCode = `DEV/R3-COMP-${stamp}/${year}`;

function pdfFile(name: string, body: string) {
  const bytes = new TextEncoder().encode(`%PDF-1.7\n${body}\n%%EOF`);
  return {
    name,
    size: bytes.byteLength,
    type: "application/pdf",
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as File;
}

async function loadVersionSource(complaintId: string) {
  return prisma.complaint.findUniqueOrThrow({
    where: { id: complaintId },
    include: {
      qmsRecord: true,
      followups: { orderBy: [{ followupDate: "asc" }, { createdAt: "asc" }] },
      capaPlans: {
        orderBy: { createdAt: "asc" },
        include: { linkedCapaRecord: true },
      },
      derivedActions: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      formVersion: true,
      annexIIITemplateVersion: true,
      annexIVTemplateVersion: true,
      annexVTemplateVersion: true,
    },
  });
}

async function main() {
  const department = await prisma.department.findUniqueOrThrow({
    where: { code: "GC-00" },
  });

  const complaintQms = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.COMPLAINT,
      businessCode: complaintCode,
      year,
    },
  });
  const capaQms = await prisma.qmsRecord.create({
    data: { recordType: QmsRecordType.CAPA, businessCode: capaCode, year },
  });
  const returnQms = await prisma.qmsRecord.create({
    data: { recordType: QmsRecordType.RETURN, businessCode: returnCode, year },
  });

  try {
    const complaint = await prisma.complaint.create({
      data: {
        qmsRecordId: complaintQms.id,
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        openedAt: new Date(`${year}-01-05`),
        detectionDate: new Date(`${year}-01-05`),
        receptionDate: new Date(`${year}-01-05`),
        createdByText: actor,
        complaintType: "CUSTOMER",
        partyName: "Cliente ficticio R3",
        contact: "qa@example.invalid",
        sourceTypes: ["CUSTOMER"],
        scopeTypes: ["MEDICINE"],
        affectedObjectTypes: ["SERVICE"],
        categoryTypes: ["SERVICE_SUPPLY"],
        reference: "SERVICIO-R3",
        description: "R3 MARCA V00",
        recurrent: false,
        emittedBy: actor,
        impactQualityGmp: "NO",
        impactSafetyEfficacy: "NO",
        impactRegulatory: "NO",
        impactEnvironment: "NO",
        impactOtherSimilar: "NO",
        containmentActions: ["NONE"],
        riskJustification: "Sin impacto R3",
        investigation: "Investigación R3",
        impactAssessment: "Sin impacto",
        investigationResult: "PROCEDENT",
        rootCause: "Causa R3",
        classification: "MINOR",
        potentialRecall: "NO",
        recallProcedureRequired: "NO",
        authorityNotificationRequired: "NO",
        responsiblePartyCommunicationRequired: "YES",
        regulatoryJustification: "Sin notificación",
        resolutionLines: "Seguimiento R3",
        resolutionActions: ["CORRECTIVE_ACTION", "RETURN", "CREDIT"],
        hasDerivedActions: true,
        creditActionDetails: "Abono R3 V00",
        communicationDate: new Date(`${year}-01-06`),
        communicationMedium: "Correo",
        communicationParties: "QA / Cliente",
        communicationSummary: "Comunicación inicial R3",
        partIIRequired: null,
        nextFollowupDate: new Date(`${year}-02-01`),
        conclusion: "Pendiente Parte II",
        effectivenessStatus: "PENDING",
        status: "OPEN",
        capaPlans: {
          create: {
            actionType: "CORRECTIVE",
            description: "CAPA propuesta R3",
            responsible: actor,
            plannedExecutionDate: new Date(`${year}-01-20`),
            businessCapaCode: capaCode,
            linkedCapaRecordId: capaQms.id,
          },
        },
        derivedActions: {
          create: {
            actionType: "RETURN",
            businessCode: returnCode,
            description: "Devolución R3",
            responsible: actor,
            plannedExecutionDate: new Date(`${year}-01-21`),
            sortOrder: 0,
          },
        },
      },
    });

    await prisma.capa.create({
      data: {
        qmsRecordId: capaQms.id,
        actionType: "CORRECTIVE",
        status: "OPEN",
        createdByText: actor,
      },
    });
    await prisma.returnRecord.create({
      data: {
        qmsRecordId: returnQms.id,
        returnType: "COMPLAINT",
        status: "OPEN",
        createdByText: actor,
      },
    });

    await createQmsRelation(prisma, {
      sourceRecordId: complaintQms.id,
      targetRecordId: capaQms.id,
      createdByText: actor,
    });
    await createQmsRelation(prisma, {
      sourceRecordId: complaintQms.id,
      targetRecordId: returnQms.id,
      createdByText: actor,
    });

    const v00Source = await loadVersionSource(complaint.id);
    await prisma.$transaction(async (tx) => {
      await ensureInitialVersion(
        tx,
        complaintQms.id,
        snapshotJson(
          serializeComplaintVersion(v00Source, {
            versionFollowupDate: v00Source.openedAt,
          }),
        ),
        actor,
        "UI",
        "Versión inicial R3",
      );
    });

    await prisma.complaint.update({
      where: { id: complaint.id },
      data: {
        description: "R3 MARCA V01",
        partIIRequired: true,
        responseDate: new Date(`${year}-02-01`),
        responseMedium: "Correo",
        responseSummary: "Respuesta R3 V01",
        responseSufficient: true,
        effectivenessStatus: "ACCEPTABLE",
        effectivenessAssessment: "Conforme R3",
        closeActionStatus: "COMPLETED",
        closeActionReferences: "CAPA y devolución R3",
        closeConclusion: "Cierre R3 V01",
        status: "CLOSED",
        closedAt: new Date(`${year}-02-01`),
        nextFollowupDate: null,
        creditActionDetails: "Abono R3 V01",
      },
    });

    const v01Source = await loadVersionSource(complaint.id);
    await prisma.$transaction(async (tx) => {
      await startNextVersion(
        tx,
        complaintQms.id,
        RecordVersionKind.FOLLOWUP,
        snapshotJson(
          serializeComplaintVersion(v01Source, {
            versionFollowupDate: new Date(`${year}-02-01`),
          }),
        ),
        actor,
        "Seguimiento y cierre R3",
      );
    });

    const versions = await prisma.qmsRecordVersion.findMany({
      where: { qmsRecordId: complaintQms.id },
      orderBy: { sequenceNumber: "asc" },
    });

    assert.deepEqual(
      versions.map((version) => version.sequenceNumber),
      [0, 1],
    );
    assert.equal(versions[0].kind, "INITIAL");
    assert.equal(versions[1].kind, "FOLLOWUP");
    assert.ok(versions[0].frozenAt);
    assert.equal(versions[1].frozenAt, null);

    const v00 = complaintSnapshotToAnnexRecord(versions[0].snapshot) as {
      description: string;
      status: string;
      nextFollowupDate: Date | null;
      capaPlans: Array<{ businessCapaCode?: string | null }>;
      derivedActions: Array<{ businessCode?: string | null }>;
    };
    const v01 = complaintSnapshotToAnnexRecord(versions[1].snapshot) as typeof v00;

    assert.equal(v00.description, "R3 MARCA V00");
    assert.equal(v01.description, "R3 MARCA V01");
    assert.equal(v00.status, "OPEN");
    assert.equal(v01.status, "CLOSED");
    assert.equal(v00.nextFollowupDate?.toISOString().slice(0, 10), `${year}-02-01`);
    assert.equal(v01.nextFollowupDate, null);
    assert.equal(v00.capaPlans[0].businessCapaCode, capaCode);
    assert.equal(v00.derivedActions[0].businessCode, returnCode);
    assert.equal(
      complaintSnapshotVersionFollowupDate(versions[0].snapshot, 0)
        ?.toISOString()
        .slice(0, 10),
      `${year}-01-05`,
    );
    assert.equal(
      complaintSnapshotVersionFollowupDate(versions[1].snapshot, 1)
        ?.toISOString()
        .slice(0, 10),
      `${year}-02-01`,
    );

    const relations = await prisma.qmsRelation.findMany({
      where: { sourceRecordId: complaintQms.id, isActive: true },
    });
    assert.equal(relations.length, 2);
    assert.equal(
      await prisma.qmsRelation.count({
        where: { targetRecordId: complaintQms.id, isActive: true },
      }),
      0,
    );

    const signed = await storeSignedVersionPdf({
      qmsRecordId: complaintQms.id,
      recordVersionId: versions[1].id,
      file: pdfFile("R3_Reclamacion_V01_firmada.pdf", "signed complaint R3"),
      actor,
      replacementReason: "",
      ownershipError: "La versión indicada no pertenece a esta reclamación.",
      initialReason: (sequenceNumber) =>
        `Carga de PDF firmado V${String(sequenceNumber).padStart(2, "0")}`,
    });
    assert.equal(signed.error, null);
    assert.equal(signed.sequenceNumber, 1);

    const signedV00 = await getSignedVersionDocumentBySequence(complaintQms.id, 0);
    const signedV01 = await getSignedVersionDocumentBySequence(complaintQms.id, 1);
    assert.equal(signedV00?.documents.length, 0);
    assert.equal(signedV01?.documents.length, 1);
    assert.equal(signedV01?.documents[0].fileName, "R3_Reclamacion_V01_firmada.pdf");

    const replacement = await storeSignedVersionPdf({
      qmsRecordId: complaintQms.id,
      recordVersionId: versions[1].id,
      file: pdfFile("R3_Reclamacion_V01_firmada_rev2.pdf", "replacement complaint R3"),
      actor,
      replacementReason: "Sustitución controlada R3",
      ownershipError: "La versión indicada no pertenece a esta reclamación.",
      initialReason: () => "No aplica",
    });
    assert.equal(replacement.error, null);

    const history = await prisma.changeHistory.findMany({
      where: { qmsRecordId: complaintQms.id, fieldPath: "documents.signedPdf" },
      orderBy: { changedAt: "asc" },
    });
    assert.equal(history.length, 2);
    assert.equal(history.at(-1)?.reason, "Sustitución controlada R3");

    console.log(
      "R3 Reclamaciones smoke passed: V00/V01 congeladas, Parte II/cierre, CAPA+Devolución canónicas, snapshots históricos y PDF firmado por versión.",
    );
  } finally {
    const recordIds = [complaintQms.id, capaQms.id, returnQms.id];
    const versions = await prisma.qmsRecordVersion.findMany({
      where: { qmsRecordId: { in: recordIds } },
      select: { id: true },
    });
    const versionIds = versions.map((version) => version.id);

    await prisma.qmsRelation.deleteMany({
      where: {
        OR: [
          { sourceRecordId: { in: recordIds } },
          { targetRecordId: { in: recordIds } },
        ],
      },
    });
    if (versionIds.length) {
      await prisma.recordVersionDocument.deleteMany({
        where: { recordVersionId: { in: versionIds } },
      });
      await prisma.generatedDocument.deleteMany({
        where: { recordVersionId: { in: versionIds } },
      });
    }
    await prisma.changeHistory.deleteMany({
      where: { qmsRecordId: { in: recordIds } },
    });
    await prisma.generatedDocument.deleteMany({
      where: { qmsRecordId: { in: recordIds } },
    });
    await prisma.qmsRecordVersion.deleteMany({
      where: { qmsRecordId: { in: recordIds } },
    });

    await prisma.complaint.deleteMany({
      where: { qmsRecordId: complaintQms.id },
    });
    await prisma.capa.deleteMany({
      where: { qmsRecordId: capaQms.id },
    });
    await prisma.returnRecord.deleteMany({
      where: { qmsRecordId: returnQms.id },
    });
    await prisma.qmsRecord.deleteMany({
      where: { id: { in: recordIds } },
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

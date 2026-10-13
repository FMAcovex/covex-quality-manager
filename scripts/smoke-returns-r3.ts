import { purgeLegacyFixtureDocuments } from "./audit-fixtures/legacy-cleanup";
import assert from "node:assert/strict";
import {
  PrismaClient,
  QmsRecordType,
  RecordVersionDocumentKind,
} from "@prisma/client";
import {
  ensureInitialVersion,
  refreshCurrentVersion,
  serializeReturnVersion,
  snapshotJson,
} from "../src/lib/qms/versioning";
import { createQmsRelation } from "../src/lib/qms/relation-service";
import { isReturnDepartmentCode } from "../src/modules/returns/departments";
import { storeSignedVersionPdf } from "../src/lib/qms/signed-version-document";

const prisma = new PrismaClient();
const actor = "CI R3 Devoluciones";
const stamp = Date.now();
const year = 2096;
const complaintCode = `R/C/R3-RET-${stamp}/${year}`;
const returnCode = `DEV/LG-30/R3-${stamp}/${year}`;

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

async function loadReturnSource(returnId: string) {
  return prisma.returnRecord.findUniqueOrThrow({
    where: { id: returnId },
    include: {
      qmsRecord: true,
      products: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: { orderBy: [{ followupDate: "asc" }, { createdAt: "asc" }] },
      formVersion: true,
      annexIIITemplateVersion: true,
      annexIVTemplateVersion: true,
      annexVTemplateVersion: true,
      annexVITemplateVersion: true,
    },
  });
}

async function refreshReturn(returnId: string, qmsRecordId: string, reason: string) {
  const source = await loadReturnSource(returnId);
  await prisma.$transaction(async (tx) => {
    await refreshCurrentVersion(
      tx,
      qmsRecordId,
      snapshotJson(serializeReturnVersion(source)),
      actor,
      reason,
    );
  });
}

async function main() {
  const lg = await prisma.department.findUniqueOrThrow({ where: { code: "LG-30" } });
  const gc = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });

  assert.equal(isReturnDepartmentCode(lg.code), true);
  assert.equal(isReturnDepartmentCode(gc.code), false);

  const complaintQms = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.COMPLAINT,
      businessCode: complaintCode,
      year,
    },
  });
  const returnQms = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.RETURN,
      businessCode: returnCode,
      year,
    },
  });

  try {
    const complaint = await prisma.complaint.create({
      data: {
        qmsRecordId: complaintQms.id,
        departmentId: gc.id,
        departmentCodeSnapshot: gc.code,
        departmentNameSnapshot: gc.name,
        openedAt: new Date(`${year}-01-02`),
        createdByText: actor,
        complaintType: "CUSTOMER",
        partyName: "Cliente R3 Devoluciones",
        reference: "MAT-R3",
        lotReference: "LOT-R3",
        quantity: "5",
        expiryReanalysis: "12/2097",
        description: "Origen R3 para devolución",
        status: "OPEN",
      },
    });
    assert.ok(complaint.id);

    const ret = await prisma.returnRecord.create({
      data: {
        qmsRecordId: returnQms.id,
        departmentId: lg.id,
        departmentCodeSnapshot: lg.code,
        departmentNameSnapshot: lg.name,
        communicationDate: new Date(`${year}-01-03`),
        receivedAt: new Date(`${year}-01-04`),
        createdByText: actor,
        returnType: "COMPLAINT",
        customerEntity: "Cliente R3 Devoluciones",
        country: "España",
        address: "Dirección R3",
        relatedDocument: complaintCode,
        conservationConditions: "15-25 ºC",
        reasonObservations: "Devolución R3",
        attachedDocumentation: "Documentación R3",
        withinAcceptedReturnPeriod: "YES",
        roomTemperatureWithinTenDays: "YES",
        coldChainWithinFortyEightHours: "NA",
        uniqueIdentifierActive: "YES",
        tamperEvidenceIntact: "YES",
        packagingIntegrityOk: "YES",
        customerDeclarationAvailable: "YES",
        storageTransportConditionsOk: "YES",
        noUseDamageContamination: "YES",
        noRecallAlertBlock: "YES",
        expiryAcceptable: "YES",
        qcAssessmentCompleted: "YES",
        storageTemperatureRecord: "NA",
        returnTransportTempEvidence: "NA",
        transportPackagingSuitable: "NA",
        receiptTemperatureAcceptable: "NA",
        temperatureExcursionEvaluated: "NA",
        coldChainReturnSystemValidated: "NA",
        decision: "PENDING",
        status: "OPEN",
        products: {
          create: [{
            departmentId: lg.id,
            productType: "API",
            productNameCode: "MAT-R3",
            format: "1 kg",
            lot: "LOT-R3",
            expiryReanalysis: "12/2097",
            quantity: "5",
            unit: "kg",
            receptionObservations: "Recepción conforme",
            sortOrder: 0,
          }],
        },
      },
    });

    const initialSource = await loadReturnSource(ret.id);
    await prisma.$transaction(async (tx) => {
      await ensureInitialVersion(
        tx,
        returnQms.id,
        snapshotJson(serializeReturnVersion(initialSource)),
        actor,
        "UI",
        "Snapshot técnico inicial R3 Devoluciones",
      );
    });

    await createQmsRelation(prisma, {
      sourceRecordId: complaintQms.id,
      targetRecordId: returnQms.id,
      createdByText: actor,
      notes: "Relación canónica R3 Reclamación → Devolución",
    });

    await prisma.returnFollowup.create({
      data: {
        returnRecordId: ret.id,
        followupDate: new Date(`${year}-01-10`),
        completedByText: actor,
        comment: "Seguimiento operativo R3",
        nextFollowupDate: new Date(`${year}-01-20`),
        evidenceReference: "EV-R3-RET-01",
      },
    });
    await refreshReturn(ret.id, returnQms.id, "Seguimiento operativo R3");

    await prisma.returnRecord.update({
      where: { id: ret.id },
      data: {
        decision: "ACCEPTED",
        decisionDate: new Date(`${year}-01-20`),
        finalDestination: "Reintegración autorizada R3",
        traceabilityUpdated: "YES",
        closedAt: new Date(`${year}-01-20`),
        status: "CLOSED",
      },
    });
    await refreshReturn(ret.id, returnQms.id, "Cierre R3");

    const stored = await prisma.returnRecord.findUniqueOrThrow({
      where: { id: ret.id },
      include: {
        products: { orderBy: { sortOrder: "asc" } },
        followups: { orderBy: { followupDate: "asc" } },
        qmsRecord: {
          include: {
            targetRelations: true,
            sourceRelations: true,
            versions: {
              orderBy: { sequenceNumber: "asc" },
              include: { documents: true },
            },
          },
        },
      },
    });

    assert.equal(stored.status, "CLOSED");
    assert.equal(stored.decision, "ACCEPTED");
    assert.equal(stored.departmentCodeSnapshot, "LG-30");
    assert.equal(stored.products.length, 1);
    assert.equal(stored.products[0].productNameCode, "MAT-R3");
    assert.equal(stored.products[0].format, "1 kg");
    assert.equal(stored.products[0].lot, "LOT-R3");
    assert.equal(stored.products[0].expiryReanalysis, "12/2097");
    assert.equal(stored.products[0].quantity, "5");
    assert.equal(stored.followups.length, 1);

    // Devoluciones conserva un único snapshot técnico editable: no V01/V02 funcionales.
    assert.deepEqual(
      stored.qmsRecord.versions.map((version) => version.sequenceNumber),
      [0],
    );
    assert.equal(stored.qmsRecord.versions[0].frozenAt, null);

    const snapshot = stored.qmsRecord.versions[0].snapshot as {
      returnRecord?: {
        status?: string;
        decision?: string;
        finalDestination?: string | null;
        products?: Array<{ productNameCode?: string; lot?: string | null }>;
        followups?: Array<{ comment?: string }>;
      };
    };
    assert.equal(snapshot.returnRecord?.status, "CLOSED");
    assert.equal(snapshot.returnRecord?.decision, "ACCEPTED");
    assert.equal(snapshot.returnRecord?.finalDestination, "Reintegración autorizada R3");
    assert.equal(snapshot.returnRecord?.products?.[0]?.productNameCode, "MAT-R3");
    assert.equal(snapshot.returnRecord?.products?.[0]?.lot, "LOT-R3");
    assert.equal(snapshot.returnRecord?.followups?.[0]?.comment, "Seguimiento operativo R3");

    const incoming = await prisma.qmsRelation.findMany({
      where: { targetRecordId: returnQms.id, isActive: true },
    });
    const outgoing = await prisma.qmsRelation.findMany({
      where: { sourceRecordId: returnQms.id, isActive: true },
    });
    assert.equal(incoming.length, 1);
    assert.equal(incoming[0].sourceRecordId, complaintQms.id);
    assert.equal(outgoing.length, 0);

    const versionId = stored.qmsRecord.versions[0].id;
    const annexIII = await storeSignedVersionPdf({
      qmsRecordId: returnQms.id,
      recordVersionId: versionId,
      file: pdfFile("R3_Anexo_III_firmado.pdf", "Annex III R3"),
      actor,
      replacementReason: "",
      ownershipError: "Snapshot ajeno",
      initialReason: () => "Carga R3 Anexo III",
      kind: RecordVersionDocumentKind.RETURN_ANNEX_III_SIGNED,
      historyFieldPath: "__return_annex_iii_signed__",
    });
    assert.equal(annexIII.error, null);

    const annexV = await storeSignedVersionPdf({
      qmsRecordId: returnQms.id,
      recordVersionId: versionId,
      file: pdfFile("R3_Anexo_V_cliente.pdf", "Annex V R3"),
      actor,
      replacementReason: "",
      ownershipError: "Snapshot ajeno",
      initialReason: () => "Carga R3 Anexo V",
      kind: RecordVersionDocumentKind.RETURN_ANNEX_V_SIGNED,
      historyFieldPath: "__return_annex_v_signed__",
    });
    assert.equal(annexV.error, null);

    const rejectedReplacement = await storeSignedVersionPdf({
      qmsRecordId: returnQms.id,
      recordVersionId: versionId,
      file: pdfFile("R3_Anexo_V_sin_motivo.pdf", "Rejected replacement"),
      actor,
      replacementReason: "",
      ownershipError: "Snapshot ajeno",
      initialReason: () => "No aplica",
      kind: RecordVersionDocumentKind.RETURN_ANNEX_V_SIGNED,
      historyFieldPath: "__return_annex_v_signed__",
    });
    assert.equal(
      rejectedReplacement.error,
      "Para sustituir un PDF firmado debe indicarse el motivo.",
    );

    const replacement = await storeSignedVersionPdf({
      qmsRecordId: returnQms.id,
      recordVersionId: versionId,
      file: pdfFile("R3_Anexo_V_cliente_rev2.pdf", "Annex V replacement R3"),
      actor,
      replacementReason: "Cliente remite PDF corregido R3",
      ownershipError: "Snapshot ajeno",
      initialReason: () => "No aplica",
      kind: RecordVersionDocumentKind.RETURN_ANNEX_V_SIGNED,
      historyFieldPath: "__return_annex_v_signed__",
    });
    assert.equal(replacement.error, null);

    const documents = await prisma.recordVersionDocument.findMany({
      where: { recordVersionId: versionId },
    });
    assert.equal(documents.length, 2);
    assert.equal(
      documents.find((doc) => doc.kind === RecordVersionDocumentKind.RETURN_ANNEX_III_SIGNED)?.fileName,
      "R3_Anexo_III_firmado.pdf",
    );
    assert.equal(
      documents.find((doc) => doc.kind === RecordVersionDocumentKind.RETURN_ANNEX_V_SIGNED)?.fileName,
      "R3_Anexo_V_cliente_rev2.pdf",
    );

    const history = await prisma.changeHistory.findMany({
      where: { qmsRecordId: returnQms.id },
      orderBy: { changedAt: "asc" },
    });
    assert.equal(
      history.filter((item) => item.fieldPath === "__return_annex_iii_signed__").length,
      1,
    );
    assert.equal(
      history.filter((item) => item.fieldPath === "__return_annex_v_signed__").length,
      2,
    );
    assert.equal(
      history.filter((item) => item.fieldPath === "__return_annex_v_signed__").at(-1)?.reason,
      "Cliente remite PDF corregido R3",
    );

    console.log(
      "R3 Devoluciones smoke passed: LG, producto, seguimiento, cierre, relación canónica, snapshot único editable y PDF firmados III/V.",
    );
  } finally {
    const recordIds = [complaintQms.id, returnQms.id];
    const versions = await prisma.qmsRecordVersion.findMany({
      where: { qmsRecordId: { in: recordIds } },
      select: { id: true },
    });
    const versionIds = versions.map((item) => item.id);

    await prisma.qmsRelation.deleteMany({
      where: {
        OR: [
          { sourceRecordId: { in: recordIds } },
          { targetRecordId: { in: recordIds } },
        ],
      },
    });
    if (versionIds.length) {
      await purgeLegacyFixtureDocuments(prisma, { recordVersionId: { in: versionIds } });
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
    await prisma.returnRecord.deleteMany({
      where: { qmsRecordId: returnQms.id },
    });
    await prisma.complaint.deleteMany({
      where: { qmsRecordId: complaintQms.id },
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

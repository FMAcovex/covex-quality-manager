import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  DocumentType,
  PrismaClient,
  QmsRecordType,
  RecordVersionKind,
} from "@prisma/client";
import { GET as downloadCapaSignedPdf } from "../src/app/api/capa/[id]/versions/[sequence]/signed-pdf/route";
import {
  capaSnapshotToAnnexRecord,
  capaSnapshotVersionFollowupDate,
  ensureInitialVersion,
  refreshCurrentVersion,
  serializeCapaVersion,
  snapshotJson,
} from "../src/lib/qms/versioning";
import {
  hasPdfHeader,
  MAX_SIGNED_PDF_SIZE,
  storeSignedVersionPdf,
  validateSignedPdfMetadata,
} from "../src/lib/qms/signed-version-document";
import { syncOperationalOriginRelations } from "../src/lib/qms/relation-service";
import { getZipEntryText, readZip, writeZip } from "../src/lib/ooxml/zip";
import { generateCapaAnnexIII } from "../src/modules/capa/documents/annex-iii";
import { saveCapaFollowup } from "../src/modules/capa/followup-service";
import { parseCapaFollowupTransition } from "../src/modules/capa/followup-transition";
import { capaSignedPdfUploadError } from "../src/modules/capa/signed-document-policy";

const prisma = new PrismaClient();
const actor = "CI R3 CAPA";
const stamp = Date.now();
const year = 2096;
const devCode = `D/R3/${stamp}/${year}`;
const complaintCode = `REC-R3-${stamp}-${year}`;
const capaCode = `AC/R3/${stamp}/${year}`;
const otherCapaCode = `AC/R3-OTHER/${stamp}/${year}`;
const templateCode = `R3-${stamp}`;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pdfFile(name: string, body: string, validHeader = true) {
  const prefix = validHeader ? "%PDF-1.7" : "NOT-PDF";
  const bytes = new TextEncoder().encode(`${prefix}\n${body}\n%%EOF`);
  return {
    name,
    size: bytes.byteLength,
    type: "application/pdf",
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as File;
}

function mockAnnexTemplate() {
  const plain = (text = "Vacío") =>
    `<w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
  const shaded = (text: string, fill: string) =>
    `<w:tc><w:tcPr><w:shd w:fill="${fill}"/></w:tcPr><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
  const checkbox = (text = "☐") =>
    `<w:tc><w:sdt><w:sdtPr><w14:checkbox><w14:checked w14:val="0"/></w14:checkbox></w:sdtPr><w:sdtContent><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:sdtContent></w:sdt></w:tc>`;

  const table0 =
    "<w:tbl>" +
    Array.from({ length: 18 }, (_, row) => {
      if (row === 5) return "<w:tr>" + shaded("ORIGEN", "D9D9D9") + "</w:tr>";
      if (row === 6) {
        return "<w:tr>" + checkbox("☐ AUDITORIA") + checkbox("☐ INSPECCIÓN") + "</w:tr>";
      }
      if (row === 7) {
        return "<w:tr>" + checkbox("☐ DESVIACIÓN") + checkbox("☐ RECHAZOS") + "</w:tr>";
      }
      if (row === 8) {
        return "<w:tr>" + checkbox("☐ RECLAMACIÓN") + checkbox("☐ OTROS") + "</w:tr>";
      }
      if (row === 1) {
        return "<w:tr>" + checkbox("☐ Correctiva") + checkbox("☐ Preventiva") + "</w:tr>";
      }
      const cells = row === 2 || row === 3 ? 4 : row === 4 ? 2 : row === 17 ? 4 : 1;
      return "<w:tr>" + Array.from({ length: cells }, () => plain()).join("") + "</w:tr>";
    }).join("") +
    "</w:tbl>";

  const table1 =
    "<w:tbl>" +
    Array.from({ length: 16 }, (_, row) => {
      if (row === 6 || row === 9) {
        return "<w:tr>" + checkbox() + checkbox() + checkbox() + "</w:tr>";
      }
      if (row === 10) return "<w:tr>" + plain("Valoración :") + "</w:tr>";
      const cells = [1, 2, 13, 14, 15].includes(row) ? 2 : 1;
      return "<w:tr>" + Array.from({ length: cells }, () => plain()).join("") + "</w:tr>";
    }).join("") +
    "</w:tbl>";

  const xml =
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:body>' +
    table0 +
    table1 +
    "</w:body></w:document>";

  return writeZip([{ name: "word/document.xml", data: Buffer.from(xml) }]);
}

async function loadVersionSource(capaId: string) {
  return prisma.capa.findUniqueOrThrow({
    where: { id: capaId },
    include: {
      qmsRecord: {
        include: {
          targetRelations: {
            where: { isActive: true, relationType: "GENERATES" },
            include: { sourceRecord: true },
          },
        },
      },
      plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      actionFollowups: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: { orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }] },
      formVersion: true,
      annexIIITemplateVersion: true,
    },
  });
}

async function refreshCurrentCapaVersion(capaId: string, qmsRecordId: string) {
  const source = await loadVersionSource(capaId);
  await prisma.$transaction(async (tx) => {
    await refreshCurrentVersion(
      tx,
      qmsRecordId,
      snapshotJson(
        serializeCapaVersion(source, {
          versionFollowupDate:
            source.followups.at(-1)?.followupDate ?? source.openedAt,
        }),
      ),
      actor,
      null,
    );
  });
}

async function main() {
  const department = await prisma.department.findUniqueOrThrow({
    where: { code: "GC-00" },
  });

  const templateBytes = mockAnnexTemplate();
  const templateData = Uint8Array.from(templateBytes);
  const template = await prisma.templateVersion.create({
    data: {
      module: QmsRecordType.CAPA,
      documentType: DocumentType.CAPA_ANNEX_III,
      versionCode: templateCode,
      fileName: `R3_CAPA_${templateCode}.docx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileData: templateData,
      fileSize: templateData.byteLength,
      checksum: createHash("sha256").update(templateBytes).digest("hex"),
      effectiveFrom: new Date(`${year}-01-01`),
      isActive: false,
    },
  });

  const deviationRecord = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.DEVIATION,
      businessCode: devCode,
      year,
    },
  });
  const complaintRecord = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.COMPLAINT,
      businessCode: complaintCode,
      year,
    },
  });
  const capaRecord = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.CAPA,
      businessCode: capaCode,
      year,
    },
  });
  const otherCapaRecord = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.CAPA,
      businessCode: otherCapaCode,
      year,
    },
  });

  try {
    await prisma.deviation.create({
      data: {
        qmsRecordId: deviationRecord.id,
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        issueDate: new Date(`${year}-01-02`),
        whatHappened: "Origen ficticio R3",
        createdByText: actor,
      },
    });
    await prisma.complaint.create({
      data: {
        qmsRecordId: complaintRecord.id,
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        openedAt: new Date(`${year}-01-03`),
        createdByText: actor,
        complaintType: "CUSTOMER",
        partyName: "Cliente ficticio R3",
        description: "Reclamación ficticia origen R3",
      },
    });
    const capa = await prisma.capa.create({
      data: {
        qmsRecordId: capaRecord.id,
        actionType: "CORRECTIVE",
        departmentId: department.id,
        departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name,
        openedAt: new Date(`${year}-01-05`),
        createdByText: actor,
        applicableTo: "Sistema ficticio R3",
        defectDescription: "R3 MARCA V00",
        rootCause: "Causa ficticia R3",
        status: "DRAFT",
        effectivenessStatus: "PENDING",
        annexIIITemplateVersionId: template.id,
        plannedActions: {
          create: [
            {
              description: "Acción propuesta R3 A",
              responsible: actor,
              plannedExecutionDate: new Date(`${year}-01-20`),
              sortOrder: 0,
            },
            {
              description: "Acción propuesta R3 B",
              responsible: actor,
              plannedExecutionDate: new Date(`${year}-01-25`),
              sortOrder: 1,
            },
          ],
        },
        actionFollowups: {
          create: [
            {
              followupDate: new Date(`${year}-01-15`),
              description: "Seguimiento acción R3 A1",
              sortOrder: 0,
            },
          ],
        },
      },
    });
    await prisma.capa.create({
      data: {
        qmsRecordId: otherCapaRecord.id,
        actionType: "CORRECTIVE",
        status: "OPEN",
        createdByText: actor,
      },
    });
    const foreignVersion = await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: otherCapaRecord.id,
        sequenceNumber: 0,
        kind: RecordVersionKind.INITIAL,
        snapshot: { capa: { status: "OPEN" } },
        createdByText: actor,
      },
    });

    const blockedFollowup = await saveCapaFollowup(
      capa.id,
      form({
        followupDate: `${year}-01-10`,
        completedByText: actor,
        description: "No debe guardarse",
        status: "OPEN",
        effectivenessStatus: "PENDING",
      }),
    );
    assert.match(blockedFollowup.error ?? "", /abierta/i);
    assert.equal(
      capaSignedPdfUploadError("DRAFT"),
      "No se puede cargar un PDF firmado mientras la CAPA está en Borrador.",
    );
    assert.equal(
      await prisma.qmsRelation.count({ where: { targetRecordId: capaRecord.id } }),
      0,
    );

    await prisma.capa.update({
      where: { id: capa.id },
      data: { status: "OPEN", nextFollowupDate: new Date(`${year}-02-01`) },
    });
    await prisma.$transaction(async (tx) => {
      await syncOperationalOriginRelations(tx, {
        capaRecordId: capaRecord.id,
        originRecordIds: [deviationRecord.id, complaintRecord.id],
        changedByText: actor,
      });
    });

    const source = await loadVersionSource(capa.id);
    await prisma.$transaction(async (tx) => {
      await ensureInitialVersion(
        tx,
        capaRecord.id,
        snapshotJson(
          serializeCapaVersion(source, { versionFollowupDate: source.openedAt }),
        ),
        actor,
        "UI",
        "Informe inicial CAPA R3",
      );
    });

    const followup01 = await saveCapaFollowup(
      capa.id,
      form({
        followupDate: `${year}-02-01`,
        completedByText: actor,
        reason: "Cierre operativo R3",
        description: "R3 resultado Seguimiento 01",
        evidenceReference: "EV-R3-01",
        status: "CLOSED",
        operationalClosedAt: `${year}-02-01`,
        conclusion: "Acción implantada con evidencia R3.",
        effectivenessStatus: "PENDING",
      }),
    );
    assert.equal(followup01.error, undefined, followup01.error);
    assert.match(followup01.success ?? "", /Seguimiento 01/);

    await prisma.capa.update({
      where: { id: capa.id },
      data: {
        defectDescription: "R3 MARCA V01",
        actionFollowups: {
          create: {
            followupDate: new Date(`${year}-02-15`),
            description: "Seguimiento acción R3 A2",
            sortOrder: 1,
          },
        },
      },
    });
    await refreshCurrentCapaVersion(capa.id, capaRecord.id);

    const followup02 = await saveCapaFollowup(
      capa.id,
      form({
        followupDate: `${year}-03-01`,
        completedByText: actor,
        reason: "Verificación de eficacia R3",
        description: "R3 resultado Seguimiento 02",
        status: "CLOSED",
        effectivenessStatus: "CONFORMING",
        effectivenessAssessment: "Conforme R3",
        effectivenessEvidence: "EV-R3-EF",
        effectiveClosedAt: `${year}-03-01`,
      }),
    );
    assert.equal(followup02.error, undefined, followup02.error);
    assert.match(followup02.success ?? "", /Seguimiento 02/);

    const versionsBeforeOperationalChange = await prisma.qmsRecordVersion.findMany({
      where: { qmsRecordId: capaRecord.id },
      orderBy: { sequenceNumber: "asc" },
    });
    const frozenV00 = JSON.stringify(versionsBeforeOperationalChange[0].snapshot);
    const frozenV01 = JSON.stringify(versionsBeforeOperationalChange[1].snapshot);

    await prisma.capa.update({
      where: { id: capa.id },
      data: { defectDescription: "R3 MARCA V02" },
    });
    await prisma.$transaction(async (tx) => {
      await syncOperationalOriginRelations(tx, {
        capaRecordId: capaRecord.id,
        originRecordIds: [complaintRecord.id],
        changedByText: actor,
      });
    });
    await refreshCurrentCapaVersion(capa.id, capaRecord.id);

    const stored = await prisma.capa.findUniqueOrThrow({
      where: { id: capa.id },
      include: {
        plannedActions: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        actionFollowups: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        followups: {
          orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }],
        },
        qmsRecord: {
          include: {
            versions: { orderBy: { sequenceNumber: "asc" } },
            targetRelations: { orderBy: { createdAt: "asc" } },
            sourceRelations: true,
          },
        },
      },
    });
    const versions = stored.qmsRecord.versions;

    assert.deepEqual(
      versions.map((item) => item.sequenceNumber),
      [0, 1, 2],
    );
    assert.deepEqual(
      versions.map((item) => item.kind),
      ["INITIAL", "FOLLOWUP", "FOLLOWUP"],
    );
    assert.ok(versions[0].frozenAt);
    assert.ok(versions[1].frozenAt);
    assert.equal(versions[2].frozenAt, null);
    assert.equal(JSON.stringify(versions[0].snapshot), frozenV00);
    assert.equal(JSON.stringify(versions[1].snapshot), frozenV01);
    assert.equal(versions[1].sourceEntityId, stored.followups[0].id);
    assert.equal(versions[2].sourceEntityId, stored.followups[1].id);
    assert.equal(versions[1].reason, "Cierre operativo R3");
    assert.equal(versions[2].reason, "Verificación de eficacia R3");
    assert.equal(versions[1].createdByText, actor);
    assert.equal(versions[2].createdByText, actor);
    assert.equal(
      capaSnapshotVersionFollowupDate(
        versions[0].snapshot,
        0,
      )?.toISOString().slice(0, 10),
      `${year}-01-05`,
    );
    assert.equal(
      capaSnapshotVersionFollowupDate(
        versions[1].snapshot,
        1,
      )?.toISOString().slice(0, 10),
      `${year}-02-01`,
    );
    assert.equal(
      capaSnapshotVersionFollowupDate(
        versions[2].snapshot,
        2,
      )?.toISOString().slice(0, 10),
      `${year}-03-01`,
    );

    const annexRecords = versions.map((item) =>
      capaSnapshotToAnnexRecord(item.snapshot) as {
        status: string;
        effectivenessStatus: string;
        defectDescription: string;
        origins: Array<{ businessCode: string | null }>;
        plannedActions: Array<{ description: string }>;
        actionFollowups: Array<{ description: string | null }>;
        nextFollowupDate: Date | null;
        operationalClosedAt: Date | null;
        effectiveClosedAt: Date | null;
      },
    );
    assert.deepEqual(
      annexRecords.map((item) => item.defectDescription),
      ["R3 MARCA V00", "R3 MARCA V01", "R3 MARCA V02"],
    );
    assert.deepEqual(
      annexRecords.map((item) => item.status),
      ["OPEN", "CLOSED", "CLOSED"],
    );
    assert.deepEqual(
      annexRecords.map((item) => item.effectivenessStatus),
      ["PENDING", "PENDING", "CONFORMING"],
    );
    assert.deepEqual(
      annexRecords[0].origins.map((item) => item.businessCode).sort(),
      [complaintCode, devCode].sort(),
    );
    assert.deepEqual(
      annexRecords[1].origins.map((item) => item.businessCode).sort(),
      [complaintCode, devCode].sort(),
    );
    assert.deepEqual(
      annexRecords[2].origins.map((item) => item.businessCode),
      [complaintCode],
    );
    assert.deepEqual(
      annexRecords.map((item) => item.plannedActions.length),
      [2, 2, 2],
    );
    assert.deepEqual(
      annexRecords.map((item) => item.actionFollowups.map((row) => row.description)),
      [
        ["Seguimiento acción R3 A1"],
        ["Seguimiento acción R3 A1", "Seguimiento acción R3 A2"],
        ["Seguimiento acción R3 A1", "Seguimiento acción R3 A2"],
      ],
    );
    assert.equal(annexRecords[2].nextFollowupDate, null);
    assert.ok(annexRecords[1].operationalClosedAt);
    assert.equal(annexRecords[1].effectiveClosedAt, null);
    assert.ok(annexRecords[2].effectiveClosedAt);

    assert.equal(stored.status, "CLOSED");
    assert.equal(stored.effectivenessStatus, "CONFORMING");
    assert.equal(stored.nextFollowupDate, null);
    assert.ok(stored.operationalClosedAt);
    assert.ok(stored.effectiveClosedAt);
    assert.equal(stored.plannedActions.length, 2);
    assert.deepEqual(
      stored.actionFollowups.map((item) => item.sortOrder),
      [0, 1],
    );
    assert.equal(stored.followups.length, 2);

    const relations = stored.qmsRecord.targetRelations.filter(
      (item) => item.relationType === "GENERATES",
    );
    assert.equal(relations.length, 2);
    assert.equal(
      relations.find((item) => item.sourceRecordId === deviationRecord.id)?.isActive,
      false,
    );
    assert.equal(
      relations.find((item) => item.sourceRecordId === complaintRecord.id)?.isActive,
      true,
    );
    assert.equal(
      stored.qmsRecord.sourceRelations.filter((item) =>
        [deviationRecord.id, complaintRecord.id].includes(item.targetRecordId),
      ).length,
      0,
    );

    const nonconformingForm = form({
      followupDate: `${year}-04-01`,
      completedByText: actor,
      description: "Comprobación No conforme sin próximo seguimiento",
      status: "CLOSED",
      effectivenessStatus: "NONCONFORMING",
      effectivenessAssessment: "No conforme R3",
      effectivenessEvidence: "EV-R3-NC",
    });
    const nonconforming = parseCapaFollowupTransition(nonconformingForm, {
      current: {
        status: "CLOSED",
        operationalClosedAt: `${year}-02-01`,
        cancellationReason: null,
        conclusion: "Acción implantada con evidencia R3.",
        effectivenessStatus: "PENDING",
        effectivenessCriteria: null,
        effectivenessAssessment: null,
        effectivenessEvidence: null,
        effectiveClosedAt: null,
      },
      hasExistingExecutionEvidence: true,
    });
    assert.deepEqual(nonconforming.errors, []);
    assert.equal(nonconforming.values.nextFollowupDate, null);
    assert.equal(nonconforming.values.effectivenessStatus, "NONCONFORMING");

    for (const version of versions) {
      const snapshotRecord = capaSnapshotToAnnexRecord(version.snapshot);
      const annexRecord = {
        ...snapshotRecord,
        recordVersionSequenceNumber: version.sequenceNumber,
        recordVersionReason: version.reason,
        versionFollowupDate: capaSnapshotVersionFollowupDate(
          version.snapshot,
          version.sequenceNumber,
        ),
      };
      const buffer = await generateCapaAnnexIII(
        annexRecord as Parameters<typeof generateCapaAnnexIII>[0],
      );
      const xml = getZipEntryText(readZip(buffer), "word/document.xml");
      assert.match(xml, new RegExp(`R3 MARCA V0${version.sequenceNumber}`));
      assert.match(xml, /Seguimiento acción R3 A1/);
      assert.match(xml, new RegExp(escapeRegExp(complaintCode)));
      if (version.sequenceNumber === 0) {
        assert.doesNotMatch(xml, /Cierre operativo R3/);
        assert.doesNotMatch(xml, /Seguimiento acción R3 A2/);
        assert.match(xml, new RegExp(escapeRegExp(devCode)));
        assert.match(xml, /5\/1\/2096/);
      }
      if (version.sequenceNumber === 1) {
        assert.match(xml, /Cierre operativo R3/);
        assert.match(xml, /Seguimiento acción R3 A2/);
        assert.match(xml, new RegExp(escapeRegExp(devCode)));
        assert.match(xml, /1\/2\/2096/);
      }
      if (version.sequenceNumber === 2) {
        assert.match(xml, /Verificación de eficacia R3/);
        assert.match(xml, /Seguimiento acción R3 A2/);
        assert.doesNotMatch(xml, new RegExp(escapeRegExp(devCode)));
        assert.match(xml, /1\/3\/2096/);
      }

      await prisma.generatedDocument.create({
        data: {
          qmsRecordId: capaRecord.id,
          recordVersionId: version.id,
          documentType: DocumentType.CAPA_ANNEX_III,
          templateVersionId: template.id,
          generatedByText: actor,
          metadata: {
            source: "r3-smoke",
            templateVersion: templateCode,
            followupVersion: version.sequenceNumber,
            recordVersion: version.sequenceNumber,
          },
        },
      });
    }

    const generated = await prisma.generatedDocument.findMany({
      where: {
        qmsRecordId: capaRecord.id,
        documentType: DocumentType.CAPA_ANNEX_III,
      },
      orderBy: { generatedAt: "asc" },
    });
    assert.equal(generated.length, 3);
    assert.deepEqual(
      generated.map((item) => item.recordVersionId),
      versions.map((item) => item.id),
    );
    assert.deepEqual(
      generated.map((item) =>
        Number((item.metadata as { recordVersion?: number }).recordVersion),
      ),
      [0, 1, 2],
    );

    assert.equal(validateSignedPdfMetadata("incorrecto.txt", 100), "Solo se admite un archivo PDF.");
    assert.equal(
      validateSignedPdfMetadata("demasiado-grande.pdf", MAX_SIGNED_PDF_SIZE + 1),
      "El PDF supera el límite de 15 MB.",
    );
    assert.equal(hasPdfHeader(new TextEncoder().encode("%PDF-1.7")), true);
    assert.equal(hasPdfHeader(new TextEncoder().encode("NOPE!")), false);

    const badHeader = await storeSignedVersionPdf({
      qmsRecordId: capaRecord.id,
      recordVersionId: versions[0].id,
      file: pdfFile("seguimiento-00-falso.pdf", "R3 bad header", false),
      actor,
      replacementReason: "",
      ownershipError: "foreign version",
      initialReason: (sequence) => `Carga R3 ${sequence}`,
    });
    assert.equal(badHeader.error, "El archivo no tiene una cabecera PDF válida.");

    const signed00 = await storeSignedVersionPdf({
      qmsRecordId: capaRecord.id,
      recordVersionId: versions[0].id,
      file: pdfFile("seguimiento-00.pdf", "R3 signed 00"),
      actor,
      replacementReason: "",
      ownershipError: "foreign version",
      initialReason: (sequence) => `Carga R3 Seguimiento ${sequence}`,
    });
    assert.equal(signed00.error, null);

    const signed01 = await storeSignedVersionPdf({
      qmsRecordId: capaRecord.id,
      recordVersionId: versions[1].id,
      file: pdfFile("seguimiento-01.pdf", "R3 signed 01"),
      actor,
      replacementReason: "",
      ownershipError: "foreign version",
      initialReason: (sequence) => `Carga R3 Seguimiento ${sequence}`,
    });
    assert.equal(signed01.error, null);

    const noAutomaticCopy = await prisma.recordVersionDocument.findUnique({
      where: {
        recordVersionId_kind: {
          recordVersionId: versions[2].id,
          kind: "SIGNED_PDF",
        },
      },
    });
    assert.equal(noAutomaticCopy, null);

    const wrongOwner = await storeSignedVersionPdf({
      qmsRecordId: capaRecord.id,
      recordVersionId: foreignVersion.id,
      file: pdfFile("foreign.pdf", "R3 foreign"),
      actor,
      replacementReason: "",
      ownershipError: "foreign version",
      initialReason: () => "Carga foreign",
    });
    assert.equal(wrongOwner.error, "foreign version");

    const replacementWithoutReason = await storeSignedVersionPdf({
      qmsRecordId: capaRecord.id,
      recordVersionId: versions[1].id,
      file: pdfFile("seguimiento-01-sin-motivo.pdf", "R3 rejected replacement"),
      actor,
      replacementReason: "",
      ownershipError: "foreign version",
      initialReason: (sequence) => `Carga R3 Seguimiento ${sequence}`,
    });
    assert.equal(
      replacementWithoutReason.error,
      "Para sustituir un PDF firmado debe indicarse el motivo.",
    );

    const replacementReason = "Sustitución R3 por documento firmado correcto.";
    const replaced = await storeSignedVersionPdf({
      qmsRecordId: capaRecord.id,
      recordVersionId: versions[1].id,
      file: pdfFile("seguimiento-01-sustituido.pdf", "R3 signed 01 replacement"),
      actor,
      replacementReason,
      ownershipError: "foreign version",
      initialReason: (sequence) => `Carga R3 Seguimiento ${sequence}`,
    });
    assert.equal(replaced.error, null);

    const signedResponse00 = await downloadCapaSignedPdf(
      new Request(`http://r3.local/api/capa/${capa.id}/versions/0/signed-pdf`),
      { params: Promise.resolve({ id: capa.id, sequence: "0" }) },
    );
    assert.equal(signedResponse00.status, 200);
    assert.match(
      new TextDecoder().decode(await signedResponse00.arrayBuffer()),
      /R3 signed 00/,
    );
    assert.match(
      signedResponse00.headers.get("content-disposition") ?? "",
      /seguimiento-00\.pdf/,
    );

    const signedResponse01 = await downloadCapaSignedPdf(
      new Request(`http://r3.local/api/capa/${capa.id}/versions/1/signed-pdf`),
      { params: Promise.resolve({ id: capa.id, sequence: "1" }) },
    );
    assert.equal(signedResponse01.status, 200);
    assert.match(
      new TextDecoder().decode(await signedResponse01.arrayBuffer()),
      /R3 signed 01 replacement/,
    );
    assert.match(
      signedResponse01.headers.get("content-disposition") ?? "",
      /seguimiento-01-sustituido\.pdf/,
    );

    const signedHistory = await prisma.changeHistory.findMany({
      where: {
        qmsRecordId: capaRecord.id,
        fieldPath: "__signed_document__",
      },
      orderBy: { changedAt: "asc" },
    });
    assert.equal(signedHistory.length, 3);
    assert.equal(signedHistory.at(-1)?.reason, replacementReason);

    const signedDocs = await prisma.recordVersionDocument.findMany({
      where: {
        recordVersionId: { in: versions.map((item) => item.id) },
      },
      orderBy: { uploadedAt: "asc" },
    });
    assert.equal(signedDocs.length, 2);
    assert.deepEqual(
      signedDocs.map((item) => item.recordVersionId).sort(),
      [versions[0].id, versions[1].id].sort(),
    );

    console.log(
      "R3 CAPA final regression passed: Draft→Open→S01→S02, frozen snapshots, Annex III per version, action follow-ups, canonical origins and signed PDF lifecycle.",
    );
  } finally {
    const recordIds = [
      deviationRecord.id,
      complaintRecord.id,
      capaRecord.id,
      otherCapaRecord.id,
    ];
    const versionRows = await prisma.qmsRecordVersion.findMany({
      where: { qmsRecordId: { in: recordIds } },
      select: { id: true },
    });
    const versionIds = versionRows.map((item) => item.id);

    await prisma.recordVersionDocument.deleteMany({
      where: { recordVersionId: { in: versionIds } },
    });
    await prisma.generatedDocument.deleteMany({
      where: { qmsRecordId: { in: recordIds } },
    });
    await prisma.changeHistory.deleteMany({
      where: { qmsRecordId: { in: recordIds } },
    });
    await prisma.qmsRelation.deleteMany({
      where: {
        OR: [
          { sourceRecordId: { in: recordIds } },
          { targetRecordId: { in: recordIds } },
        ],
      },
    });
    await prisma.qmsRecordVersion.deleteMany({
      where: { qmsRecordId: { in: recordIds } },
    });
    await prisma.capa.deleteMany({
      where: { qmsRecordId: { in: [capaRecord.id, otherCapaRecord.id] } },
    });
    await prisma.complaint.deleteMany({
      where: { qmsRecordId: complaintRecord.id },
    });
    await prisma.deviation.deleteMany({
      where: { qmsRecordId: deviationRecord.id },
    });
    await prisma.templateVersion.delete({ where: { id: template.id } });
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
  .finally(() => prisma.$disconnect());

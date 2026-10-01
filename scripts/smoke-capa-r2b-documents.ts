import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType, RecordVersionKind } from "@prisma/client";
import { storeSignedVersionPdf } from "../src/lib/qms/signed-version-document";

const prisma = new PrismaClient();
const actor = "CI R2B CAPA";
const stamp = Date.now();

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

async function main() {
  const record = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.CAPA,
      businessCode: `AC/R2B/${stamp}/2098`,
      year: 2098,
    },
  });
  const otherRecord = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.CAPA,
      businessCode: `AC/R2B-OTHER/${stamp}/2098`,
      year: 2098,
    },
  });

  try {
    await prisma.capa.create({
      data: {
        qmsRecordId: record.id,
        actionType: "CORRECTIVE",
        status: "OPEN",
        createdByText: actor,
      },
    });

    const version00 = await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: record.id,
        sequenceNumber: 0,
        kind: RecordVersionKind.INITIAL,
        snapshot: { capa: { status: "OPEN" } },
        createdByText: actor,
      },
    });
    const version01 = await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: record.id,
        sequenceNumber: 1,
        kind: RecordVersionKind.FOLLOWUP,
        snapshot: { capa: { status: "OPEN" } },
        createdByText: actor,
      },
    });
    const foreignVersion = await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: otherRecord.id,
        sequenceNumber: 0,
        kind: RecordVersionKind.INITIAL,
        snapshot: { capa: { status: "OPEN" } },
        createdByText: actor,
      },
    });

    const first = await storeSignedVersionPdf({
      qmsRecordId: record.id,
      recordVersionId: version00.id,
      file: pdfFile("seguimiento-00.pdf", "R2B version 00"),
      actor,
      replacementReason: "",
      ownershipError: "foreign version",
      initialReason: (sequence) => `Carga R2B ${sequence}`,
    });
    assert.equal(first.error, null);
    assert.equal(first.sequenceNumber, 0);

    let docs = await prisma.recordVersionDocument.findMany({
      where: { recordVersionId: { in: [version00.id, version01.id] } },
      orderBy: { fileName: "asc" },
    });
    assert.equal(docs.length, 1);
    assert.equal(docs[0].recordVersionId, version00.id);

    const second = await storeSignedVersionPdf({
      qmsRecordId: record.id,
      recordVersionId: version01.id,
      file: pdfFile("seguimiento-01.pdf", "R2B version 01"),
      actor,
      replacementReason: "",
      ownershipError: "foreign version",
      initialReason: (sequence) => `Carga R2B ${sequence}`,
    });
    assert.equal(second.error, null);
    assert.equal(second.sequenceNumber, 1);

    docs = await prisma.recordVersionDocument.findMany({
      where: { recordVersionId: { in: [version00.id, version01.id] } },
      orderBy: { recordVersionId: "asc" },
    });
    assert.equal(docs.length, 2);
    assert.notEqual(docs[0].recordVersionId, docs[1].recordVersionId);
    assert.notEqual(docs[0].checksum, docs[1].checksum);

    const foreign = await storeSignedVersionPdf({
      qmsRecordId: record.id,
      recordVersionId: foreignVersion.id,
      file: pdfFile("foreign.pdf", "R2B foreign"),
      actor,
      replacementReason: "",
      ownershipError: "foreign version",
      initialReason: () => "Carga R2B foreign",
    });
    assert.equal(foreign.error, "foreign version");

    const rejectedReplacement = await storeSignedVersionPdf({
      qmsRecordId: record.id,
      recordVersionId: version01.id,
      file: pdfFile("seguimiento-01-sin-motivo.pdf", "R2B rejected replacement"),
      actor,
      replacementReason: "",
      ownershipError: "foreign version",
      initialReason: (sequence) => `Carga R2B ${sequence}`,
    });
    assert.equal(
      rejectedReplacement.error,
      "Para sustituir un PDF firmado debe indicarse el motivo.",
    );
    const beforeReplacement = await prisma.recordVersionDocument.findUniqueOrThrow({
      where: {
        recordVersionId_kind: {
          recordVersionId: version01.id,
          kind: "SIGNED_PDF",
        },
      },
    });
    assert.equal(beforeReplacement.fileName, "seguimiento-01.pdf");

    const replaced = await storeSignedVersionPdf({
      qmsRecordId: record.id,
      recordVersionId: version01.id,
      file: pdfFile("seguimiento-01-sustituido.pdf", "R2B version 01 replacement"),
      actor,
      replacementReason: "Corrección del PDF firmado cargado inicialmente.",
      ownershipError: "foreign version",
      initialReason: (sequence) => `Carga R2B ${sequence}`,
    });
    assert.equal(replaced.error, null);

    const version01Docs = await prisma.recordVersionDocument.findMany({
      where: { recordVersionId: version01.id },
    });
    assert.equal(version01Docs.length, 1);
    assert.equal(version01Docs[0].fileName, "seguimiento-01-sustituido.pdf");

    const history = await prisma.changeHistory.findMany({
      where: { qmsRecordId: record.id, fieldPath: "__signed_document__" },
      orderBy: { changedAt: "asc" },
    });
    assert.equal(history.length, 3);
    assert.equal(history.at(-1)?.reason, "Corrección del PDF firmado cargado inicialmente.");

    console.log("R2B CAPA signed-document smoke OK");
  } finally {
    const recordIds = [record.id, otherRecord.id];
    const versions = await prisma.qmsRecordVersion.findMany({
      where: { qmsRecordId: { in: recordIds } },
      select: { id: true },
    });
    await prisma.recordVersionDocument.deleteMany({
      where: { recordVersionId: { in: versions.map((item) => item.id) } },
    });
    await prisma.changeHistory.deleteMany({
      where: { qmsRecordId: { in: recordIds } },
    });
    await prisma.qmsRecordVersion.deleteMany({
      where: { qmsRecordId: { in: recordIds } },
    });
    await prisma.capa.deleteMany({
      where: { qmsRecordId: { in: recordIds } },
    });
    await prisma.qmsRecord.deleteMany({
      where: { id: { in: recordIds } },
    });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

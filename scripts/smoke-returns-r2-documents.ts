import assert from "node:assert/strict";
import {
  PrismaClient,
  QmsRecordType,
  RecordVersionDocumentKind,
  RecordVersionKind,
} from "@prisma/client";
import { storeSignedVersionPdf } from "../src/lib/qms/signed-version-document";

const prisma = new PrismaClient();
const actor = "CI R2 Devoluciones";
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
      recordType: QmsRecordType.RETURN,
      businessCode: `DEV/R2/${stamp}/2097`,
      year: 2097,
    },
  });

  try {
    await prisma.returnRecord.create({
      data: {
        qmsRecordId: record.id,
        returnType: "COMMERCIAL",
        status: "OPEN",
        createdByText: actor,
      },
    });

    const version = await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: record.id,
        sequenceNumber: 0,
        kind: RecordVersionKind.INITIAL,
        snapshot: { returnRecord: { status: "OPEN" } },
        createdByText: actor,
      },
    });

    const annexIII = await storeSignedVersionPdf({
      qmsRecordId: record.id,
      recordVersionId: version.id,
      file: pdfFile("anexo-iii-firmado.pdf", "R2 returns Annex III"),
      actor,
      replacementReason: "",
      ownershipError: "snapshot ajeno",
      initialReason: () => "Carga de PDF firmado · Anexo III",
      kind: RecordVersionDocumentKind.RETURN_ANNEX_III_SIGNED,
      historyFieldPath: "__return_annex_iii_signed__",
    });
    assert.equal(annexIII.error, null);

    const annexV = await storeSignedVersionPdf({
      qmsRecordId: record.id,
      recordVersionId: version.id,
      file: pdfFile("anexo-v-cliente.pdf", "R2 returns Annex V"),
      actor,
      replacementReason: "",
      ownershipError: "snapshot ajeno",
      initialReason: () => "Carga de PDF firmado · Anexo V",
      kind: RecordVersionDocumentKind.RETURN_ANNEX_V_SIGNED,
      historyFieldPath: "__return_annex_v_signed__",
    });
    assert.equal(annexV.error, null);

    let docs = await prisma.recordVersionDocument.findMany({
      where: { recordVersionId: version.id },
      orderBy: { kind: "asc" },
    });
    assert.equal(docs.length, 2);
    assert.deepEqual(
      new Set(docs.map((doc) => doc.kind)),
      new Set([
        RecordVersionDocumentKind.RETURN_ANNEX_III_SIGNED,
        RecordVersionDocumentKind.RETURN_ANNEX_V_SIGNED,
      ]),
    );

    const noReason = await storeSignedVersionPdf({
      qmsRecordId: record.id,
      recordVersionId: version.id,
      file: pdfFile("anexo-v-reemplazo-sin-motivo.pdf", "rejected replacement"),
      actor,
      replacementReason: "",
      ownershipError: "snapshot ajeno",
      initialReason: () => "Carga de PDF firmado · Anexo V",
      kind: RecordVersionDocumentKind.RETURN_ANNEX_V_SIGNED,
      historyFieldPath: "__return_annex_v_signed__",
    });
    assert.equal(
      noReason.error,
      "Para sustituir un PDF firmado debe indicarse el motivo.",
    );

    const replaced = await storeSignedVersionPdf({
      qmsRecordId: record.id,
      recordVersionId: version.id,
      file: pdfFile("anexo-v-cliente-revisado.pdf", "replacement"),
      actor,
      replacementReason: "El cliente remite una copia firmada corregida.",
      ownershipError: "snapshot ajeno",
      initialReason: () => "Carga de PDF firmado · Anexo V",
      kind: RecordVersionDocumentKind.RETURN_ANNEX_V_SIGNED,
      historyFieldPath: "__return_annex_v_signed__",
    });
    assert.equal(replaced.error, null);

    docs = await prisma.recordVersionDocument.findMany({
      where: { recordVersionId: version.id },
    });
    assert.equal(docs.length, 2);
    const storedAnnexV = docs.find(
      (doc) => doc.kind === RecordVersionDocumentKind.RETURN_ANNEX_V_SIGNED,
    );
    assert.equal(storedAnnexV?.fileName, "anexo-v-cliente-revisado.pdf");

    const history = await prisma.changeHistory.findMany({
      where: { qmsRecordId: record.id },
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
      "El cliente remite una copia firmada corregida.",
    );

    console.log(
      "R2 Devoluciones signed-document smoke passed: Anexo III y Anexo V independientes, sustitución controlada e historial.",
    );
  } finally {
    const versions = await prisma.qmsRecordVersion.findMany({
      where: { qmsRecordId: record.id },
      select: { id: true },
    });
    await prisma.recordVersionDocument.deleteMany({
      where: { recordVersionId: { in: versions.map((item) => item.id) } },
    });
    await prisma.changeHistory.deleteMany({
      where: { qmsRecordId: record.id },
    });
    await prisma.qmsRecordVersion.deleteMany({
      where: { qmsRecordId: record.id },
    });
    await prisma.returnRecord.deleteMany({
      where: { qmsRecordId: record.id },
    });
    await prisma.qmsRecord.delete({
      where: { id: record.id },
    });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

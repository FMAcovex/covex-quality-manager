import "server-only";
import { createHash } from "node:crypto";
import { DocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { safeSignedPdfFileName } from "./signed-version-document";
import { validateEvidenceFile } from "./evidence-validation";

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export type RecordEvidenceItem = {
  id: string;
  fileName: string | null;
  mimeType: string | null;
  checksum: string | null;
  generatedAt: Date;
  generatedByText: string | null;
  description: string;
  reference: string | null;
  size: number | null;
};

/**
 * Conserva una evidencia recibida en el expediente (D-096). Solo añade: nunca
 * sustituye ni borra adjuntos anteriores. El historial operativo registra la carga.
 */
export async function storeRecordEvidence(input: {
  qmsRecordId: string;
  file: File;
  description: string;
  reference: string;
  actor: string;
}) {
  const description = input.description.trim();
  const reference = input.reference.trim();
  if (!description) throw new Error("Describe qué evidencia se adjunta.");
  if (description.length > 500 || reference.length > 200) {
    throw new Error("La descripción admite 500 caracteres y la referencia 200.");
  }
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const mimeType = validateEvidenceFile(input.file.name, input.file.type, bytes);
  const fileName = safeSignedPdfFileName(input.file.name);
  const checksum = digest(bytes);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "QmsRecord" WHERE id = ${input.qmsRecordId} FOR UPDATE`);
    const record = await tx.qmsRecord.findUnique({ where: { id: input.qmsRecordId }, select: { isActive: true } });
    if (!record) throw new Error("El expediente no existe.");
    if (!record.isActive) throw new Error("No se adjuntan evidencias a un expediente anulado.");
    const document = await tx.generatedDocument.create({
      data: {
        qmsRecordId: input.qmsRecordId,
        documentType: DocumentType.RECORD_EVIDENCE,
        fileName,
        fileData: bytes,
        mimeType,
        checksum,
        generatedByText: input.actor,
        metadata: { source: "RECEIVED", description, reference: reference || null, size: bytes.length },
      },
    });
    await tx.changeHistory.create({
      data: {
        qmsRecordId: input.qmsRecordId,
        changedByText: input.actor,
        fieldPath: "__evidence__",
        newValue: { documentId: document.id, fileName, size: bytes.length, checksum, description, reference: reference || null },
        reason: `Evidencia adjunta: ${description}`,
        source: "UI",
      },
    });
    return document.id;
  });
}

function metadataText(metadata: Prisma.JsonValue, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : null;
}

export async function listRecordEvidence(qmsRecordId: string): Promise<RecordEvidenceItem[]> {
  const rows = await prisma.generatedDocument.findMany({
    where: { qmsRecordId, documentType: DocumentType.RECORD_EVIDENCE },
    select: { id: true, fileName: true, mimeType: true, checksum: true, generatedAt: true, generatedByText: true, metadata: true },
    orderBy: { generatedAt: "desc" },
  });
  return rows.map(({ metadata, ...row }) => {
    const size = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>).size : null;
    return {
      ...row,
      description: metadataText(metadata, "description") ?? "",
      reference: metadataText(metadata, "reference"),
      size: typeof size === "number" ? size : null,
    };
  });
}

/** Binario de una evidencia del expediente, con el checksum verificado. */
export async function getRecordEvidence(qmsRecordId: string, documentId: string) {
  const document = await prisma.generatedDocument.findFirst({
    where: { id: documentId, qmsRecordId, documentType: DocumentType.RECORD_EVIDENCE },
    select: { id: true, fileData: true, fileName: true, mimeType: true, checksum: true },
  });
  if (!document?.fileData || !document.checksum) return { error: "Evidencia no encontrada.", status: 404 } as const;
  if (digest(document.fileData) !== document.checksum) {
    return { error: "No se ha podido verificar la integridad de la evidencia.", status: 409 } as const;
  }
  return { document: { ...document, fileData: document.fileData, checksum: document.checksum } } as const;
}

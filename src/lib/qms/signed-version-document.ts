import { createHash } from "node:crypto";
import { RecordVersionDocumentKind } from "@prisma/client";
import { prisma } from "@/lib/db";

export const MAX_SIGNED_PDF_SIZE = 15 * 1024 * 1024;

export function signedDocumentActor(formData: FormData) {
  const value = formData.get("actor");
  return typeof value === "string" && value.trim()
    ? value.trim()
    : process.env.DEFAULT_ACTOR_NAME || "Usuario demo";
}

export function signedDocumentReplacementReason(formData: FormData) {
  const value = formData.get("replacementReason");
  return typeof value === "string" ? value.trim() : "";
}

export function validateSignedPdfMetadata(fileName: string, fileSize: number) {
  if (fileSize <= 0) return "Selecciona un PDF firmado.";
  if (fileSize > MAX_SIGNED_PDF_SIZE) return "El PDF supera el límite de 15 MB.";
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension !== "pdf") return "Solo se admite un archivo PDF.";
  return null;
}

export function hasPdfHeader(bytes: Uint8Array) {
  return Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-";
}

export function parseRecordVersionSequence(value: string) {
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

export function safeSignedPdfFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export function validateSignedPdfSelection(
  fileValue: FormDataEntryValue | null,
  missingMessage: string,
): { file: File; error: null } | { file: null; error: string } {
  if (!(fileValue instanceof File) || fileValue.size === 0) {
    return { file: null, error: missingMessage };
  }
  const metadataError = validateSignedPdfMetadata(fileValue.name, fileValue.size);
  if (metadataError) return { file: null, error: metadataError };
  return { file: fileValue, error: null };
}

export async function storeSignedVersionPdf({
  qmsRecordId,
  recordVersionId,
  file,
  actor,
  replacementReason,
  ownershipError,
  initialReason,
  kind = RecordVersionDocumentKind.SIGNED_PDF,
  historyFieldPath = "__signed_document__",
}: {
  qmsRecordId: string;
  recordVersionId: string;
  file: File;
  actor: string;
  replacementReason: string;
  ownershipError: string;
  initialReason: (sequenceNumber: number) => string;
  kind?: RecordVersionDocumentKind;
  historyFieldPath?: string;
}): Promise<{ error: string; sequenceNumber: null } | { error: null; sequenceNumber: number }> {
  const version = await prisma.qmsRecordVersion.findFirst({
    where: { id: recordVersionId, qmsRecordId },
    select: { id: true, sequenceNumber: true },
  });
  if (!version) {
    return { error: ownershipError, sequenceNumber: null };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasPdfHeader(bytes)) {
    return { error: "El archivo no tiene una cabecera PDF válida.", sequenceNumber: null };
  }

  const checksum = createHash("sha256").update(bytes).digest("hex");
  const existingDocument = await prisma.recordVersionDocument.findUnique({
    where: {
      recordVersionId_kind: {
        recordVersionId,
        kind,
      },
    },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      checksum: true,
      uploadedByText: true,
      uploadedAt: true,
    },
  });

  if (existingDocument && !replacementReason) {
    return {
      error: "Para sustituir un PDF firmado debe indicarse el motivo.",
      sequenceNumber: null,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.recordVersionDocument.upsert({
      where: {
        recordVersionId_kind: {
          recordVersionId,
          kind,
        },
      },
      update: {
        fileName: file.name,
        mimeType: "application/pdf",
        fileData: bytes,
        fileSize: file.size,
        checksum,
        uploadedByText: actor,
        uploadedAt: new Date(),
      },
      create: {
        recordVersionId,
        kind,
        fileName: file.name,
        mimeType: "application/pdf",
        fileData: bytes,
        fileSize: file.size,
        checksum,
        uploadedByText: actor,
      },
    });

    await tx.changeHistory.create({
      data: {
        qmsRecordId,
        changedByText: actor,
        fieldPath: historyFieldPath,
        oldValue: existingDocument
          ? {
              recordVersionId,
              sequenceNumber: version.sequenceNumber,
              fileName: existingDocument.fileName,
              fileSize: existingDocument.fileSize,
              checksum: existingDocument.checksum,
              uploadedByText: existingDocument.uploadedByText,
              uploadedAt: existingDocument.uploadedAt.toISOString(),
            }
          : undefined,
        newValue: {
          recordVersionId,
          sequenceNumber: version.sequenceNumber,
          fileName: file.name,
          fileSize: file.size,
          checksum,
        },
        reason: existingDocument
          ? replacementReason
          : initialReason(version.sequenceNumber),
        source: "UI",
      },
    });
  });

  return { error: null, sequenceNumber: version.sequenceNumber };
}

export async function getSignedVersionDocumentBySequence(
  qmsRecordId: string,
  sequenceNumber: number,
) {
  return prisma.qmsRecordVersion.findUnique({
    where: {
      qmsRecordId_sequenceNumber: {
        qmsRecordId,
        sequenceNumber,
      },
    },
    select: {
      sequenceNumber: true,
      documents: {
        where: { kind },
        take: 1,
        select: { fileName: true, fileData: true },
      },
    },
  });
}

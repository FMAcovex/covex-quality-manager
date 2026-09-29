"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export type SignedVersionDocumentState = {
  error: string | null;
  success: string | null;
};

const MAX_PDF_SIZE = 15 * 1024 * 1024;

function actor(formData: FormData) {
  const value = formData.get("actor");
  return typeof value === "string" && value.trim()
    ? value.trim()
    : process.env.DEFAULT_ACTOR_NAME || "Usuario demo";
}

export async function uploadDeviationSignedPdfAction(
  deviationId: string,
  recordVersionId: string,
  _state: SignedVersionDocumentState,
  formData: FormData,
): Promise<SignedVersionDocumentState> {
  const fileValue = formData.get("file");
  if (!(fileValue instanceof File) || fileValue.size === 0) {
    return { error: "Selecciona el PDF firmado de esta versión.", success: null };
  }
  if (fileValue.size > MAX_PDF_SIZE) {
    return { error: "El PDF supera el límite de 15 MB.", success: null };
  }
  const extension = fileValue.name.toLowerCase().split(".").pop();
  if (extension !== "pdf") {
    return { error: "Solo se admite un archivo PDF.", success: null };
  }

  const deviation = await prisma.deviation.findUnique({
    where: { id: deviationId },
    select: { qmsRecordId: true },
  });
  if (!deviation) {
    return { error: "La desviación no existe.", success: null };
  }

  const version = await prisma.qmsRecordVersion.findFirst({
    where: { id: recordVersionId, qmsRecordId: deviation.qmsRecordId },
    select: { id: true, sequenceNumber: true },
  });
  if (!version) {
    return { error: "La versión indicada no pertenece a esta desviación.", success: null };
  }

  const bytes = new Uint8Array(await fileValue.arrayBuffer());
  const header = Buffer.from(bytes.subarray(0, 5)).toString("ascii");
  if (header !== "%PDF-") {
    return { error: "El archivo no tiene una cabecera PDF válida.", success: null };
  }

  const checksum = createHash("sha256").update(bytes).digest("hex");
  await prisma.recordVersionDocument.upsert({
    where: {
      recordVersionId_kind: {
        recordVersionId,
        kind: "SIGNED_PDF",
      },
    },
    update: {
      fileName: fileValue.name,
      mimeType: "application/pdf",
      fileData: bytes,
      fileSize: fileValue.size,
      checksum,
      uploadedByText: actor(formData),
      uploadedAt: new Date(),
    },
    create: {
      recordVersionId,
      kind: "SIGNED_PDF",
      fileName: fileValue.name,
      mimeType: "application/pdf",
      fileData: bytes,
      fileSize: fileValue.size,
      checksum,
      uploadedByText: actor(formData),
    },
  });

  revalidatePath(`/deviations/${deviationId}`);
  return {
    error: null,
    success: `PDF firmado vinculado a V${String(version.sequenceNumber).padStart(2, "0")}.`,
  };
}

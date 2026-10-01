"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  signedDocumentActor,
  signedDocumentReplacementReason,
  storeSignedVersionPdf,
  validateSignedPdfSelection,
} from "@/lib/qms/signed-version-document";
import type { SignedVersionDocumentState } from "@/lib/qms/signed-version-document-types";

export type { SignedVersionDocumentState } from "@/lib/qms/signed-version-document-types";

export async function uploadDeviationSignedPdfAction(
  deviationId: string,
  recordVersionId: string,
  _state: SignedVersionDocumentState,
  formData: FormData,
): Promise<SignedVersionDocumentState> {
  const selected = validateSignedPdfSelection(
    formData.get("file"),
    "Selecciona el PDF firmado de esta versión.",
  );
  if (selected.error) {
    return { error: selected.error, success: null };
  }

  const deviation = await prisma.deviation.findUnique({
    where: { id: deviationId },
    select: { qmsRecordId: true },
  });
  if (!deviation) {
    return { error: "La desviación no existe.", success: null };
  }

  const result = await storeSignedVersionPdf({
    qmsRecordId: deviation.qmsRecordId,
    recordVersionId,
    file: selected.file,
    actor: signedDocumentActor(formData),
    replacementReason: signedDocumentReplacementReason(formData),
    ownershipError: "La versión indicada no pertenece a esta desviación.",
    initialReason: (sequenceNumber) =>
      `Carga de PDF firmado V${String(sequenceNumber).padStart(2, "0")}`,
  });
  if (result.error) {
    return { error: result.error, success: null };
  }

  revalidatePath(`/deviations/${deviationId}`);
  return {
    error: null,
    success: `PDF firmado vinculado a V${String(result.sequenceNumber).padStart(2, "0")}.`,
  };
}

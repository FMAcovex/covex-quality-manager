"use server";

import { authorizedAction } from "@/lib/auth/action-guard";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  signedDocumentActor,
  signedDocumentReplacementReason,
  storeSignedVersionPdf,
  validateSignedPdfSelection,
} from "@/lib/qms/signed-version-document";
import type { SignedVersionDocumentState } from "@/lib/qms/signed-version-document-types";
import { capaSignedPdfUploadError } from "@/modules/capa/signed-document-policy";

async function uploadCapaSignedPdfActionAuthenticatedContent(
  capaId: string,
  recordVersionId: string,
  _state: SignedVersionDocumentState,
  formData: FormData,
): Promise<SignedVersionDocumentState> {
  const capa = await prisma.capa.findUnique({
    where: { id: capaId },
    select: { qmsRecordId: true, status: true },
  });
  if (!capa) {
    return { error: "La CAPA no existe.", success: null };
  }
  const statusError = capaSignedPdfUploadError(capa.status);
  if (statusError) {
    return { error: statusError, success: null };
  }

  const selected = validateSignedPdfSelection(
    formData.get("file"),
    "Selecciona el PDF firmado de este seguimiento.",
  );
  if (!selected.file) {
    return { error: selected.error, success: null };
  }

  const result = await storeSignedVersionPdf({
    qmsRecordId: capa.qmsRecordId,
    recordVersionId,
    file: selected.file,
    actor: signedDocumentActor(formData),
    replacementReason: signedDocumentReplacementReason(formData),
    ownershipError: "El seguimiento indicado no pertenece a esta CAPA.",
    initialReason: (sequenceNumber) =>
      `Carga de PDF firmado · Seguimiento ${String(sequenceNumber).padStart(2, "0")}`,
  });
  if (result.error) {
    return { error: result.error, success: null };
  }

  revalidatePath(`/capa/${capaId}`);
  return {
    error: null,
    success: `PDF firmado vinculado a Seguimiento ${String(result.sequenceNumber).padStart(2, "0")}.`,
  };
}

export async function uploadCapaSignedPdfAction(...args: Parameters<typeof uploadCapaSignedPdfActionAuthenticatedContent>) {
  return authorizedAction("uploadCapaSignedPdfAction", args, authenticated => uploadCapaSignedPdfActionAuthenticatedContent(...authenticated as Parameters<typeof uploadCapaSignedPdfActionAuthenticatedContent>));
}

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

async function uploadChangeControlSignedPdfActionAuthenticatedContent(
  changeControlId: string,
  recordVersionId: string,
  _state: SignedVersionDocumentState,
  formData: FormData,
): Promise<SignedVersionDocumentState> {
  const change = await prisma.changeControl.findUnique({
    where: { id: changeControlId },
    select: { qmsRecordId: true, finalStatus: true },
  });
  if (!change) {
    return { error: "El Control de Cambio no existe.", success: null };
  }
  if (change.finalStatus === "DRAFT") {
    return {
      error: "No se puede cargar un PDF firmado mientras el Control de Cambio está en Borrador.",
      success: null,
    };
  }

  const selected = validateSignedPdfSelection(
    formData.get("file"),
    "Selecciona el PDF firmado de este seguimiento.",
  );
  if (!selected.file) {
    return { error: selected.error, success: null };
  }

  const result = await storeSignedVersionPdf({
    qmsRecordId: change.qmsRecordId,
    recordVersionId,
    file: selected.file,
    actor: signedDocumentActor(formData),
    replacementReason: signedDocumentReplacementReason(formData),
    ownershipError: "El seguimiento indicado no pertenece a este Control de Cambio.",
    initialReason: (sequenceNumber) =>
      `Carga de PDF firmado · Seguimiento ${String(sequenceNumber).padStart(2, "0")}`,
    historyFieldPath: "__change_control_followup_signed_document__",
  });
  if (result.error) {
    return { error: result.error, success: null };
  }

  revalidatePath(`/changes/${changeControlId}`);
  return {
    error: null,
    success: `PDF firmado vinculado a Seguimiento ${String(result.sequenceNumber).padStart(2, "0")}.`,
  };
}

export async function uploadChangeControlSignedPdfAction(...args: Parameters<typeof uploadChangeControlSignedPdfActionAuthenticatedContent>) {
  return authorizedAction("uploadChangeControlSignedPdfAction", args, authenticated => uploadChangeControlSignedPdfActionAuthenticatedContent(...authenticated as Parameters<typeof uploadChangeControlSignedPdfActionAuthenticatedContent>));
}

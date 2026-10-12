"use server";

import { authorizedAction } from "@/lib/auth/action-guard";
import { prisma } from "@/lib/db";
import {
  signedDocumentActor,
  signedDocumentReplacementReason,
  storeSignedVersionPdf,
  validateSignedPdfSelection,
} from "@/lib/qms/signed-version-document";
import type { SignedVersionDocumentState } from "@/lib/qms/signed-version-document-types";

export type { SignedVersionDocumentState } from "@/lib/qms/signed-version-document-types";

async function uploadComplaintSignedPdfActionAuthenticatedContent(
  complaintId: string,
  recordVersionId: string,
  _state: SignedVersionDocumentState,
  formData: FormData,
): Promise<SignedVersionDocumentState> {
  const selected = validateSignedPdfSelection(
    formData.get("file"),
    "Selecciona el PDF firmado de esta versión.",
  );
  if (!selected.file) {
    return { error: selected.error, success: null };
  }

  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    select: { qmsRecordId: true },
  });
  if (!complaint) {
    return { error: "La reclamación no existe.", success: null };
  }

  const result = await storeSignedVersionPdf({
    qmsRecordId: complaint.qmsRecordId,
    recordVersionId,
    file: selected.file,
    actor: signedDocumentActor(formData),
    replacementReason: signedDocumentReplacementReason(formData),
    ownershipError: "La versión indicada no pertenece a esta reclamación.",
    initialReason: (sequenceNumber) =>
      `Carga de PDF firmado V${String(sequenceNumber).padStart(2, "0")}`,
  });
  if (result.error) {
    return { error: result.error, success: null };
  }

  // The complaint version form reloads after success; avoid streaming the
  // revalidated version tree into its own pending upload action.
  return {
    error: null,
    success: `PDF firmado vinculado a V${String(result.sequenceNumber).padStart(2, "0")}.`,
  };
}

export async function uploadComplaintSignedPdfAction(...args: Parameters<typeof uploadComplaintSignedPdfActionAuthenticatedContent>) {
  return authorizedAction("uploadComplaintSignedPdfAction", args, authenticated => uploadComplaintSignedPdfActionAuthenticatedContent(...authenticated as Parameters<typeof uploadComplaintSignedPdfActionAuthenticatedContent>));
}

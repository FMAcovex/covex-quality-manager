"use server";

import { RecordVersionDocumentKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  signedDocumentActor,
  signedDocumentReplacementReason,
  storeSignedVersionPdf,
  validateSignedPdfSelection,
} from "@/lib/qms/signed-version-document";
import type { SignedVersionDocumentState } from "@/lib/qms/signed-version-document-types";

export type ReturnSignedAnnex = "annex-iii" | "annex-v";

const config = {
  "annex-iii": {
    kind: RecordVersionDocumentKind.RETURN_ANNEX_III_SIGNED,
    label: "Anexo III",
    fieldPath: "__return_annex_iii_signed__",
  },
  "annex-v": {
    kind: RecordVersionDocumentKind.RETURN_ANNEX_V_SIGNED,
    label: "Anexo V",
    fieldPath: "__return_annex_v_signed__",
  },
} as const;

export async function uploadReturnSignedPdfAction(
  returnId: string,
  annex: ReturnSignedAnnex,
  _state: SignedVersionDocumentState,
  formData: FormData,
): Promise<SignedVersionDocumentState> {
  const annexConfig = config[annex];
  const selected = validateSignedPdfSelection(
    formData.get("file"),
    `Selecciona el PDF firmado del ${annexConfig.label}.`,
  );
  if (!selected.file) {
    return { error: selected.error, success: null };
  }

  const record = await prisma.returnRecord.findUnique({
    where: { id: returnId },
    select: {
      qmsRecordId: true,
      qmsRecord: {
        select: {
          versions: {
            orderBy: { sequenceNumber: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });
  if (!record) {
    return { error: "La devolución no existe.", success: null };
  }

  const version = record.qmsRecord.versions[0];
  if (!version) {
    return {
      error: "La devolución no tiene snapshot técnico disponible para almacenar el documento.",
      success: null,
    };
  }

  let result;
  try{result = await storeSignedVersionPdf({
    archiveReturnType:annex==="annex-iii"?"RETURN_ANNEX_III":"RETURN_ANNEX_V",
    qmsRecordId: record.qmsRecordId,
    recordVersionId: version.id,
    file: selected.file,
    actor: signedDocumentActor(formData),
    replacementReason: signedDocumentReplacementReason(formData),
    ownershipError: "El snapshot técnico no pertenece a esta devolución.",
    initialReason: () => `Carga de PDF firmado · ${annexConfig.label}`,
    kind: annexConfig.kind,
    historyFieldPath: annexConfig.fieldPath,
  });
  }catch(e){return {error:e instanceof Error?e.message:"No se pudo archivar el PDF.",success:null};}
  if (result.error) {
    return { error: result.error, success: null };
  }

  return {
    error: null,
    success: `PDF firmado del ${annexConfig.label} guardado correctamente.`,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { authorizedAction } from "@/lib/auth/action-guard";
import { prisma } from "@/lib/db";
import { signedDocumentActor, signedDocumentReplacementReason, storeSignedVersionPdf, validateSignedPdfSelection } from "@/lib/qms/signed-version-document";
import type { SignedVersionDocumentState } from "@/lib/qms/signed-version-document-types";
import { ensureInitialVersion, refreshCurrentVersion, snapshotJson } from "@/lib/qms/versioning";
import { oosSignedAnnexes, serializeOosVersion, type OosSignedAnnex } from "./signed-documents";

/** PDF firmado a mano del Anexo III o IV (D-088, OOS-4): original recibido, sin firma electrónica. */
async function uploadOosSignedPdfActionAuthenticatedContent(oosId: string, annex: OosSignedAnnex, _state: SignedVersionDocumentState, formData: FormData): Promise<SignedVersionDocumentState> {
  const config = oosSignedAnnexes[annex];
  if (!config) return { error: "Anexo no válido.", success: null };
  const selected = validateSignedPdfSelection(formData.get("file"), `Selecciona el PDF firmado del ${config.label}.`);
  if (!selected.file) return { error: selected.error, success: null };
  const actor = signedDocumentActor(formData);
  const replacementReason = signedDocumentReplacementReason(formData);
  // Checked before refreshing the snapshot, so a rejected replacement writes nothing.
  const current = await prisma.recordVersionDocument.findFirst({ where: { kind: config.kind, recordVersion: { qmsRecord: { oosRecord: { id: oosId } } } }, select: { id: true } });
  if (current && !replacementReason) return { error: "Para sustituir un PDF firmado debe indicarse el motivo.", success: null };
  try {
    const version = await prisma.$transaction(async (tx) => {
      const found = await tx.oosRecord.findUnique({ where: { id: oosId }, select: { qmsRecordId: true } });
      if (!found) throw new Error("El OOS no existe.");
      await tx.$queryRaw`SELECT id FROM "QmsRecord" WHERE id = ${found.qmsRecordId} FOR UPDATE`;
      const record = await tx.oosRecord.findUniqueOrThrow({ where: { id: oosId }, include: { qmsRecord: { include: { sourceRelations: { include: { targetRecord: true }, orderBy: { createdAt: "asc" } } } } } });
      if (!record.qmsRecord.isActive || record.status === "DRAFT") throw new Error("El OOS debe estar activo y abierto o cerrado para cargar PDF firmados.");
      if (annex === "annex-iv" && record.phaseIDisposition !== "FULL_SCALE") throw new Error("El Anexo IV solo existe cuando la disposición de la Fase I es «Investigación a gran escala».");
      const snapshot = snapshotJson(serializeOosVersion(record));
      const existing = await tx.qmsRecordVersion.findFirst({ where: { qmsRecordId: record.qmsRecordId }, select: { id: true } });
      return existing
        ? refreshCurrentVersion(tx, record.qmsRecordId, snapshot, actor, "Snapshot técnico del OOS al recibir el PDF firmado")
        : ensureInitialVersion(tx, record.qmsRecordId, snapshot, actor, "UI", "Snapshot técnico del OOS al recibir el PDF firmado");
    });
    const result = await storeSignedVersionPdf({
      qmsRecordId: version.qmsRecordId,
      recordVersionId: version.id,
      file: selected.file,
      actor,
      replacementReason,
      ownershipError: "El snapshot técnico no pertenece a este OOS.",
      initialReason: () => `Carga de PDF firmado · ${config.label}`,
      kind: config.kind,
      historyFieldPath: config.fieldPath,
    });
    if (result.error) return { error: result.error, success: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo archivar el PDF.", success: null };
  }
  revalidatePath(`/oos/${oosId}`);
  return { error: null, success: `PDF firmado del ${config.label} guardado correctamente.` };
}

export async function uploadOosSignedPdfAction(...args: Parameters<typeof uploadOosSignedPdfActionAuthenticatedContent>) {
  return authorizedAction("uploadOosSignedPdfAction", args, (authenticated) => uploadOosSignedPdfActionAuthenticatedContent(...(authenticated as Parameters<typeof uploadOosSignedPdfActionAuthenticatedContent>)));
}

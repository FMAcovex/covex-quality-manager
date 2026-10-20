import { createHash, randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DocumentPrincipal, requireDocumentWrite } from "./access";
import { externalReference, kind, originalName, uuid, validateDocumentFile } from "./domain";
import { documentHistoryActions } from "./history";
import { withBytes } from "@/lib/db-binary-omit";

export const metadataSelection = {
  id: true, documentId: true, revisionId: true, originalName: true, kind: true, state: true,
  mimeType: true, sizeBytes: true, sha256: true, storageReference: true, externalReference: true,
  description: true, incorporatedAt: true, incorporatedBy: true, identitySource: true,
  replacesId: true, replacementReason: true, replacement: { select: { id: true } },
} satisfies Prisma.ControlledRevisionDocumentSelect;
export type Incorporation = {
  documentId: string; revisionId: string; kind: string; description?: string;
  file?: { name: string; mime: string; bytes: Uint8Array };
  reference?: { name: string; url: string };
  replacesId?: string; replacementReason?: string;
};
export async function incorporateDocument(input: Incorporation, principal: DocumentPrincipal, db: PrismaClient = prisma) {
  requireDocumentWrite(principal);
  uuid(input.documentId); uuid(input.revisionId);
  const type = kind(input.kind), id = randomUUID();
  if (Boolean(input.file) === Boolean(input.reference)) throw new Error("Indique un archivo o una referencia externa, no ambos.");
  if ((input.description?.length || 0) > 2000) throw new Error("Descripción demasiado larga.");
  const name = originalName(input.file ? input.file.name : input.reference!.name);
  const mime = input.file ? validateDocumentFile(name, input.file.mime, input.file.bytes, type) : null;
  const url = input.reference ? externalReference(input.reference.url) : null;
  const reason = input.replacementReason?.trim() || null;
  if (input.replacesId) { uuid(input.replacesId); if (!reason || reason.length > 2000) throw new Error("Se necesita un motivo de sustitución explícito de hasta 2000 caracteres."); }
  else if (reason) throw new Error("Un motivo de sustitución requiere un documento anterior.");
  return db.$transaction(async tx => {
    // Serialize custody replacements with P2B evidence/activation checks on the same master.
    await tx.$queryRaw`SELECT id FROM "ControlledDocument" WHERE id = ${input.documentId} FOR UPDATE`;
    const revision = await tx.controlledDocumentRevision.findFirst({ where: { id: input.revisionId, documentId: input.documentId }, include: { document: { select: { administrativeStatus: true } } } });
    if (!revision) throw new Error("Revisión no encontrada en este PNT.");
    if (revision.document.administrativeStatus === "ANNULLED") throw new Error("El PNT está anulado: documentación de solo lectura.");
    if (input.replacesId) {
      const previous = await tx.controlledRevisionDocument.findFirst({ where: { id: input.replacesId, revisionId: revision.id, documentId: input.documentId }, select: { kind: true, replacement: { select: { id: true } } } });
      if (!previous || previous.replacement || previous.kind !== type) throw new Error("La sustitución debe corresponder al mismo tipo y revisión, y al último elemento de la cadena.");
    }
    const object = await tx.controlledRevisionDocument.create({ data: {
      id, documentId: input.documentId, revisionId: revision.id, originalName: name, kind: type,
      state: type === "WORKING_WORD" ? "WORKING" : "RECORDED_UNVERIFIED",
      mimeType: mime, sizeBytes: input.file?.bytes.length ?? null,
      sha256: input.file ? createHash("sha256").update(input.file.bytes).digest("hex") : null,
      fileData: input.file ? Buffer.from(input.file.bytes) : null,
      storageReference: `${input.file ? "postgres" : "external"}:${id}`, externalReference: url,
      description: input.description?.trim() || null, incorporatedBy: principal.name, identitySource: principal.source,
      replacesId: input.replacesId || null, replacementReason: reason,
    }, select: metadataSelection });
    await tx.controlledDocumentChange.create({ data: { documentId: input.documentId, revisionId: revision.id,
      action: input.replacesId ? documentHistoryActions.replacement : documentHistoryActions.incorporation,
      oldValue: input.replacesId ? { documentObjectId: input.replacesId } : Prisma.JsonNull,
      newValue: { documentObjectId: id, kind: type, sha256: object.sha256, originalName: name, identitySource: principal.source },
      changedByText: principal.name, reason: reason || "Incorporación sin aprobación ni modificación de estados o snapshots", source: "UI",
    } });
    return object;
  });
}
export async function downloadDocument(documentId: string, revisionId: string, objectId: string, db: PrismaClient = prisma) {
  uuid(documentId); uuid(revisionId); uuid(objectId);
  const object = await db.controlledRevisionDocument.findFirst({ where: { id: objectId, documentId, revisionId }, omit: withBytes });
  if (!object?.fileData) return null;
  if (object.sizeBytes !== object.fileData.length || object.sha256 !== createHash("sha256").update(object.fileData).digest("hex")) throw new Error("La comprobación de integridad ha fallado.");
  return object;
}

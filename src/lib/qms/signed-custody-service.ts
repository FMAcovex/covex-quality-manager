import { Prisma } from "@prisma/client";
import { currentIdentity } from "../auth/context";

/** The RPC observes old slot bytes and authenticated context itself. Neither
 * originals nor legacy uploader/date are constructed from browser metadata. */
export async function retainSignedOriginal(tx: Prisma.TransactionClient, input: {
  recordVersionId: string; kind: string; bytes: Uint8Array; fileName: string;
  actor: string; expectedChecksum: string | null; replacementReason: string;
  documentType?: string;
}) {
  const identity = currentIdentity();
  const actorId = identity && !identity.unitTest ? identity.principal.id : null;
  const [receipt] = await tx.$queryRaw<{ custodyId: string; originalDocumentId: string }[]>(Prisma.sql`
    SELECT custody_id AS "custodyId",original_document_id AS "originalDocumentId"
    FROM covex_b2_retain_signed_original(${actorId}::uuid,${input.actor},${input.recordVersionId},${input.kind},
      ${Buffer.from(input.bytes)}::bytea,${input.fileName},${input.expectedChecksum},${input.replacementReason.trim() || null},${input.documentType ?? null})`);
  if (!receipt) throw new Error("No se ha confirmado la conservación del original documental.");
  return receipt;
}

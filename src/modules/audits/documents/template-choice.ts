import type { DocumentType, Prisma } from "@prisma/client";
import { withBytes } from "@/lib/db-binary-omit";

type Candidate = { id: string; isActive: boolean; effectiveFrom: Date; createdAt: Date };

/**
 * D-134 (R6): plantilla de un documento de auditoría. Un expediente abierto antes de que entre en
 * vigor la plantilla activa sigue con la que estaba vigente al abrirse; los demás, con la activa.
 * Una versión instalada pero no activada (por ejemplo, en prueba) nunca se usa.
 */
export function chooseTemplateInForce<T extends Candidate>(candidates: T[], openedAt: Date | null | undefined): T | null {
  const active = candidates.find((t) => t.isActive) ?? null;
  if (!active || !openedAt || active.effectiveFrom <= openedAt) return active;
  const older = candidates
    .filter((t) => t.effectiveFrom <= openedAt && t.effectiveFrom < active.effectiveFrom)
    .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime() || a.createdAt.getTime() - b.createdAt.getTime());
  return older.at(-1) ?? active;
}

/** La plantilla elegida, con sus bytes; las candidatas se comparan sin leerlos (BE1-A). */
export async function auditTemplateInForce(tx: Prisma.TransactionClient, documentType: DocumentType, openedAt: Date | null | undefined) {
  const candidates = await tx.templateVersion.findMany({
    where: { module: "AUDIT", documentType, checksum: { not: null }, OR: [{ fileData: { not: null } }, { filePath: { not: null } }] },
    orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
    select: { id: true, isActive: true, effectiveFrom: true, createdAt: true },
  });
  const chosen = chooseTemplateInForce(candidates, openedAt);
  return chosen ? tx.templateVersion.findUnique({ where: { id: chosen.id }, omit: withBytes }) : null;
}

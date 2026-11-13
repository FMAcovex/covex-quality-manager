import type { DocumentType, Prisma } from "@prisma/client";
import { withBytes } from "@/lib/db-binary-omit";

type Candidate = { id: string; isActive: boolean; effectiveFrom: Date; effectiveTo: Date | null; createdAt: Date };

/**
 * D-134 (R6): plantilla de un documento de auditoría. Un expediente abierto antes de que entre en
 * vigor la plantilla activa sigue con la que estaba vigente al abrirse; los demás, con la activa.
 * Una versión instalada pero no activada (por ejemplo, en prueba) nunca se usa: de las anteriores solo cuentan
 * las sustituidas, que al activar la siguiente reciben fin de vigencia (`effectiveTo`).
 */
export function chooseTemplateInForce<T extends Candidate>(candidates: T[], openedAt: Date | null | undefined): T | null {
  const active = candidates.find((t) => t.isActive) ?? null;
  if (!active || !openedAt || active.effectiveFrom <= openedAt) return active;
  const older = candidates
    .filter((t) => t.effectiveTo !== null && t.effectiveFrom <= openedAt && t.effectiveFrom < active.effectiveFrom)
    .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime() || a.createdAt.getTime() - b.createdAt.getTime());
  return older.at(-1) ?? active;
}

/**
 * Plantilla instalada (con archivo y huella) que usará el expediente, sin leer su archivo. La ficha la usa para
 * decidir si ofrece el documento (TPL1) sin cargar los bytes en cada visita (D-112).
 */
export async function auditTemplateCandidateInForce(db: Pick<Prisma.TransactionClient, "templateVersion">, documentType: DocumentType, openedAt: Date | null | undefined) {
  const candidates = await db.templateVersion.findMany({
    where: { module: "AUDIT", documentType, checksum: { not: null }, OR: [{ fileData: { not: null } }, { filePath: { not: null } }] },
    orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
    select: { id: true, isActive: true, effectiveFrom: true, effectiveTo: true, createdAt: true },
  });
  return chooseTemplateInForce(candidates, openedAt);
}

/** La plantilla elegida, con sus bytes; las candidatas se comparan sin leerlos (BE1-A). */
export async function auditTemplateInForce(tx: Prisma.TransactionClient, documentType: DocumentType, openedAt: Date | null | undefined) {
  const chosen = await auditTemplateCandidateInForce(tx, documentType, openedAt);
  return chosen ? tx.templateVersion.findUnique({ where: { id: chosen.id }, omit: withBytes }) : null;
}

/** Fecha que decide la plantilla: la de apertura; en expedientes abiertos o cerrados sin ella (históricos), la de alta. */
export function auditTemplateReferenceDate(audit: { status: string; openedAt: Date | null; createdAt: Date }) {
  return audit.openedAt ?? (audit.status === "DRAFT" ? null : audit.createdAt);
}

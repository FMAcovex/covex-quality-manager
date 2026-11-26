import "server-only";
import { prisma } from "@/lib/db";
import { pendingPntReading } from "@/lib/qms/assigned";
import { READABLE_REVISION_STATUSES, effectiveReadingState, readerKey, readingCounts } from "./domain";

/** Lecturas pendientes (efectivas) de un PNT, para el distintivo «En lectura»: la misma regla que «Mis tareas» y la biblioteca. */
export async function pendingReadingCount(documentId: string) {
  return prisma.controlledReadingAssignment.count({ where: { documentId, ...pendingPntReading(undefined) } });
}

/** Pestaña «Lectura»: revisiones que se leen, todas las lecturas con su estado efectivo y el contador por persona. */
export async function getDocumentReadings(documentId: string) {
  const [revisions, rows] = await Promise.all([
    prisma.controlledDocumentRevision.findMany({ where: { documentId }, select: { id: true, revisionCode: true, status: true }, orderBy: { revisionCode: "desc" } }),
    prisma.controlledReadingAssignment.findMany({
      where: { documentId },
      include: { revision: { select: { revisionCode: true, status: true } }, readerUser: { select: { active: true, authorizedAt: true } } },
      orderBy: [{ assignedAt: "desc" }, { id: "asc" }],
    }),
  ]);
  const counts = readingCounts(rows);
  const readings = rows.map(row => ({
    id: row.id, revisionId: row.revisionId, revisionCode: row.revision.revisionCode, readerUserId: row.readerUserId, readerName: row.readerName,
    external: !row.readerUserId, inactive: Boolean(row.readerUserId && !(row.readerUser?.active && row.readerUser.authorizedAt)),
    status: row.status, revisionStatus: row.revision.status, state: effectiveReadingState({ status: row.status, revisionStatus: row.revision.status }),
    dueDate: row.dueDate.toISOString().slice(0, 10), assignedAt: row.assignedAt, assignedByText: row.assignedByText,
    readOn: row.readOn?.toISOString().slice(0, 10) ?? null, confirmedByText: row.confirmedByText, confirmedOnBehalf: row.confirmedOnBehalf,
    withdrawnAt: row.withdrawnAt, withdrawnByText: row.withdrawnByText, withdrawalReason: row.withdrawalReason,
    readCount: counts.get(readerKey(row)) ?? 0,
  }));
  const readable = revisions.filter(revision => (READABLE_REVISION_STATUSES as readonly string[]).includes(revision.status));
  // Lectores anteriores: de otras revisiones y no retirados (los que «Pedir a los lectores anteriores» añadiría).
  // Sin contar a quien ya tiene pendiente esta revisión: el botón solo cuenta a quien añadiría.
  const previousReaders = (revisionId: string) => {
    const pendingHere = new Set(readings.filter(row => row.revisionId === revisionId && row.status === "PENDING").map(row => readerKey(row)));
    return new Set(readings.filter(row => row.revisionId !== revisionId && row.status !== "WITHDRAWN" && !row.inactive).map(row => readerKey(row)).filter(key => !pendingHere.has(key))).size;
  };
  return { readable: readable.map(revision => ({ ...revision, previousReaders: previousReaders(revision.id) })), readings };
}
export type DocumentReading = Awaited<ReturnType<typeof getDocumentReadings>>["readings"][number];

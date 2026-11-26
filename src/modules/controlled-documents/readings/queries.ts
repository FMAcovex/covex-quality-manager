import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pendingPntReading } from "@/lib/qms/assigned";
import { READABLE_REVISION_STATUSES, effectiveReadingState, readerKey, readingCounts } from "./domain";
import type { OverviewFilters } from "./overview";

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
  // Sin contar a quien ya tiene esta revisión pedida o leída: el botón solo cuenta a quien añadiría.
  const previousReaders = (revisionId: string) => {
    const alreadyHere = new Set(readings.filter(row => row.revisionId === revisionId && row.status !== "WITHDRAWN").map(row => readerKey(row)));
    return new Set(readings.filter(row => row.revisionId !== revisionId && row.status !== "WITHDRAWN" && !row.inactive).map(row => readerKey(row)).filter(key => !alreadyHere.has(key))).size;
  };
  return { readable: readable.map(revision => ({ ...revision, previousReaders: previousReaders(revision.id) })), readings };
}
export type DocumentReading = Awaited<ReturnType<typeof getDocumentReadings>>["readings"][number];

/** Tope de filas del panel de pendientes: con más, se pide acotar con los filtros. */
export const OVERVIEW_ROW_LIMIT = 1000;

/** Entrega 2: lecturas pendientes de todos los PNT, con los filtros del panel. */
export async function pendingReadingsOverview(filters: Pick<OverviewFilters, "person" | "q" | "department" | "overdue">, today: string) {
  const base = pendingPntReading(undefined);
  const person = filters.person.startsWith("user:") ? { readerUserId: filters.person.slice(5) }
    : filters.person.startsWith("external:") ? { readerUserId: null, readerName: { equals: filters.person.slice(9), mode: "insensitive" as const } } : {};
  const where: Prisma.ControlledReadingAssignmentWhereInput = {
    ...base, ...person,
    ...(filters.overdue ? { dueDate: { lt: new Date(`${today}T00:00:00Z`) } } : {}),
    document: {
      ...base.document,
      ...(filters.department ? { departmentId: filters.department } : {}),
      ...(filters.q ? { OR: [{ baseCode: { contains: filters.q, mode: "insensitive" } }, { title: { contains: filters.q, mode: "insensitive" } }] } : {}),
    },
  };
  const [rows, total, overdue, readers, documents, people] = await Promise.all([
    prisma.controlledReadingAssignment.findMany({
      where, take: OVERVIEW_ROW_LIMIT, orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      select: { id: true, documentId: true, readerUserId: true, readerName: true, dueDate: true, assignedAt: true, assignedByText: true, document: { select: { baseCode: true, title: true } }, revision: { select: { revisionCode: true } } },
    }),
    prisma.controlledReadingAssignment.count({ where }),
    prisma.controlledReadingAssignment.count({ where: { ...where, dueDate: { lt: new Date(`${today}T00:00:00Z`) } } }),
    // Personas con alguna lectura pendiente (para el filtro), agrupadas en la base de datos.
    prisma.controlledReadingAssignment.groupBy({ by: ["readerUserId", "readerName"], where: base }),
    // Contadores de todo el resultado filtrado, no solo de las filas mostradas.
    prisma.controlledReadingAssignment.groupBy({ by: ["documentId"], where }),
    prisma.controlledReadingAssignment.groupBy({ by: ["readerUserId", "readerName"], where }),
  ]);
  const options = [...new Map(readers.map(row => [readerKey(row), { key: readerKey(row), name: row.readerName, external: !row.readerUserId }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  return {
    total, overdue, people: options, documentCount: documents.length, personCount: new Set(people.map(row => readerKey(row))).size,
    rows: rows.map(row => ({
      id: row.id, documentId: row.documentId, baseCode: row.document.baseCode ?? "Sin código", title: row.document.title ?? "", revisionCode: row.revision.revisionCode,
      readerUserId: row.readerUserId, readerName: row.readerName, dueDate: row.dueDate.toISOString().slice(0, 10), assignedAt: row.assignedAt, assignedByText: row.assignedByText,
    })),
  };
}
export type OverviewReading = Awaited<ReturnType<typeof pendingReadingsOverview>>["rows"][number];

/** Entrega 2: PNT que se pueden elegir en la asignación masiva (no anulados, con revisión vigente o aprobada). */
export async function bulkReadingCandidates() {
  const masters = await prisma.controlledDocument.findMany({
    where: { administrativeStatus: { not: "ANNULLED" }, revisions: { some: { status: { in: [...READABLE_REVISION_STATUSES] } } } },
    select: { id: true, baseCode: true, title: true, departmentId: true, departmentCodeSnapshot: true, revisions: { where: { status: { in: [...READABLE_REVISION_STATUSES] } }, select: { status: true, revisionCode: true } } },
    orderBy: { baseCode: "asc" },
  });
  return masters.map(master => ({
    id: master.id, baseCode: master.baseCode ?? "Sin código", title: master.title ?? "", departmentId: master.departmentId, department: master.departmentCodeSnapshot ?? "",
    inForce: master.revisions.find(r => r.status === "IN_FORCE")?.revisionCode ?? null,
    approved: master.revisions.find(r => r.status === "APPROVED_PENDING_EFFECTIVE")?.revisionCode ?? null,
  }));
}
export type BulkCandidate = Awaited<ReturnType<typeof bulkReadingCandidates>>[number];

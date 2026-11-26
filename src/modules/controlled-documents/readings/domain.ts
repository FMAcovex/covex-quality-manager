import type { ControlledDocumentRevisionStatus, ControlledReadingStatus } from "@prisma/client";
import { z } from "zod";
import { validDate } from "../domain";

/**
 * D-141: lecturas de PNT. Control operativo de quién debe leer cada revisión y quién la tiene pendiente
 * (el PNT impreso pasa de mano en mano). No es formación ni firma: la firma de lectura sigue en el
 * procedimiento. Reglas puras; el guardado está en service.ts.
 */

/** Se piden lecturas de la revisión vigente y de la aprobada pendiente de vigencia. */
export const READABLE_REVISION_STATUSES = ["APPROVED_PENDING_EFFECTIVE", "IN_FORCE"] as const satisfies readonly ControlledDocumentRevisionStatus[];
export const DEFAULT_READING_DAYS = 15;

export function canAssignReadings(status: ControlledDocumentRevisionStatus) {
  return (READABLE_REVISION_STATUSES as readonly string[]).includes(status);
}

/** Plazo: días naturales desde hoy (día de Madrid, «AAAA-MM-DD»). */
export function readingDueDate(today: string, days = DEFAULT_READING_DAYS) {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Una lectura pendiente de una revisión que ya no se lee (sustituida por otra vigente, o anulada) deja
 * de contar como pendiente: «SUPERSEDED». No se reescribe la fila; se deduce del estado de la revisión.
 */
export type EffectiveReadingState = ControlledReadingStatus | "SUPERSEDED";
export function effectiveReadingState(row: { status: ControlledReadingStatus; revisionStatus: ControlledDocumentRevisionStatus }): EffectiveReadingState {
  if (row.status === "PENDING" && !canAssignReadings(row.revisionStatus)) return "SUPERSEDED";
  return row.status;
}

export const normalizeExternalName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
export const externalReaderKey = (name: string) => `external:${normalizeExternalName(name)}`;
export const readerKey = (row: { readerUserId: string | null; readerName: string }) => row.readerUserId ? `user:${row.readerUserId}` : externalReaderKey(row.readerName);

type CountRow = { readerUserId: string | null; readerName: string; status: ControlledReadingStatus };
/** Lecturas confirmadas de cada persona en el PNT, sumando todas sus revisiones y relecturas. */
export function readingCounts(rows: CountRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) if (row.status === "READ") counts.set(readerKey(row), (counts.get(readerKey(row)) ?? 0) + 1);
  return counts;
}

type SummaryRow = CountRow & { revisionStatus: ControlledDocumentRevisionStatus; dueDate: string };
export function readingSummary(rows: SummaryRow[], today: string) {
  const pending = rows.filter(row => effectiveReadingState(row) === "PENDING");
  return {
    pending: pending.length,
    overdue: pending.filter(row => row.dueDate < today).length,
    read: rows.filter(row => row.status === "READ").length,
  };
}

/** Resultado de una acción de lectura. `formRevision` cambia con cada guardado correcto. */
export type ReadingActionState = { error: string | null; message?: string | null; formRevision?: number };
/**
 * Guardado correcto: revisión nueva del formulario. El formulario se vuelve a montar con ella y su
 * identificador de petición también es nuevo, así que repetir los mismos datos (pedir otra vez la
 * lectura a quien se acaba de retirar) es otra petición y no la repetición de la anterior.
 */
export function readingSaved(previous: ReadingActionState, message: string): ReadingActionState {
  return { error: null, message, formRevision: (previous.formRevision ?? 0) + 1 };
}

const field = (fd: FormData, name: string) => { const value = fd.get(name); return typeof value === "string" ? value : ""; };
const unique = <T,>(values: T[]) => [...new Set(values)];
const fail = (result: z.SafeParseReturnType<unknown, unknown>): never => { throw new Error(result.error?.issues[0]?.message ?? "Revisa los datos de la lectura."); };
const id = z.string().uuid("La lectura no es válida.");
const futureDue = (today: string) => z.string().trim().refine(value => validDate(value) && value >= today, "Indica un plazo válido, no anterior a hoy.");

const readerFields = (today: string) => ({
  userIds: z.array(z.string().uuid("Usuario no válido.")).max(500, "Elige como máximo 500 usuarios de una vez."),
  departmentIds: z.array(z.string().min(1).max(100)).max(50, "Elige como máximo 50 departamentos de una vez."),
  externalNames: z.array(z.string().max(200, "El nombre admite como máximo 200 caracteres.")).max(100, "Escribe como máximo 100 personas externas de una vez."),
  dueDate: futureDue(today),
});
const someReader = (value: { userIds: string[]; departmentIds: string[]; externalNames: string[] }) => value.userIds.length + value.departmentIds.length + value.externalNames.length > 0;
const someReaderMessage = "Elige al menos una persona, un departamento o escribe el nombre de una persona externa.";
const addSchema = (today: string) => z.object({ revisionId: z.string().uuid("Elige la revisión que se debe leer."), ...readerFields(today) }).refine(someReader, someReaderMessage);
export type AddReadersInput = z.infer<ReturnType<typeof addSchema>>;

const bulkSchema = (today: string) => z.object({
  documentIds: z.array(z.string().uuid("PNT no válido.")).min(1, "Elige al menos un PNT.").max(BULK_READING_MAX_DOCUMENTS, `Elige como máximo ${BULK_READING_MAX_DOCUMENTS} PNT de una vez.`),
  revisionStatus: z.enum(READABLE_REVISION_STATUSES, { errorMap: () => ({ message: "Elige qué revisión se debe leer: la vigente o la aprobada pendiente de vigencia." }) }),
  ...readerFields(today),
}).refine(someReader, someReaderMessage);
export type BulkAddReadersInput = z.infer<ReturnType<typeof bulkSchema>>;

const strings = (fd: FormData, name: string) => fd.getAll(name).filter((value): value is string => typeof value === "string" && value.trim() !== "").map(value => value.trim());
/** Nombres de personas externas: uno por línea, sin repetir (sin distinguir mayúsculas ni espacios). */
function externalNamesOf(fd: FormData) {
  const seen = new Set<string>();
  return field(fd, "externalNames").split(/\r?\n/).map(name => name.trim().replace(/\s+/g, " ")).filter(name => {
    if (!name || seen.has(normalizeExternalName(name))) return false;
    seen.add(normalizeExternalName(name));
    return true;
  });
}
const readersOf = (fd: FormData) => ({ userIds: unique(strings(fd, "userIds")), departmentIds: unique(strings(fd, "departmentIds")), externalNames: externalNamesOf(fd), dueDate: field(fd, "dueDate") });

/** Añadir lectores: usuarios, departamentos enteros y personas externas (una por línea). */
export function parseAddReadersForm(fd: FormData, today: string): AddReadersInput {
  const result = addSchema(today).safeParse({ revisionId: field(fd, "revisionId"), ...readersOf(fd) });
  return result.success ? result.data : fail(result);
}

/** Máximo de PNT de una asignación masiva. */
export const BULK_READING_MAX_DOCUMENTS = 200;
/** Máximo de lecturas (PNT × personas) de una asignación masiva: se guardan en una sola transacción. */
export const BULK_READING_MAX_ROWS = 2000;
export function assertBulkReadingSize(documents: number, readers: number) {
  const total = documents * readers;
  if (total > BULK_READING_MAX_ROWS) throw new Error(`Son ${total} lecturas (${documents} PNT × ${readers} personas) y el máximo de una vez es ${BULK_READING_MAX_ROWS}: divide la asignación.`);
}
/**
 * PNT elegidos en la asignación masiva, normalizados (cadenas sin espacios, sin vacías y sin repetir). Lo usan
 * el validador y el guard de permisos, para que los dos vean exactamente la misma lista.
 */
export function bulkDocumentIds(fd: FormData) { return unique(strings(fd, "documentIds")); }

/** Asignación masiva: varios PNT, la revisión que se lee de cada uno (vigente por defecto) y los lectores. */
export function parseBulkAddReadersForm(fd: FormData, today: string): BulkAddReadersInput {
  const result = bulkSchema(today).safeParse({ documentIds: bulkDocumentIds(fd), revisionStatus: field(fd, "revisionStatus") || "IN_FORCE", ...readersOf(fd) });
  return result.success ? result.data : fail(result);
}

export function parseConfirmReadingForm(fd: FormData, today: string) {
  const result = z.object({ readingId: id, readOn: z.string().trim().refine(value => validDate(value) && value <= today, "Indica la fecha de lectura; no puede ser futura.") })
    .safeParse({ readingId: field(fd, "readingId"), readOn: field(fd, "readOn") });
  return result.success ? result.data : fail(result);
}

export function parseRereadForm(fd: FormData, today: string) {
  const result = z.object({ readingId: id, dueDate: futureDue(today) }).safeParse({ readingId: field(fd, "readingId"), dueDate: field(fd, "dueDate") });
  return result.success ? result.data : fail(result);
}

export function parseWithdrawReadingForm(fd: FormData) {
  const result = z.object({ readingId: id, reason: z.string().trim().min(1, "Indica el motivo de la retirada.").max(2000) })
    .safeParse({ readingId: field(fd, "readingId"), reason: field(fd, "reason") });
  return result.success ? result.data : fail(result);
}

/** Pedir la lectura de una revisión a los lectores anteriores del PNT, con plazo. */
export function parsePreviousReadersForm(fd: FormData, today: string) {
  const result = z.object({ revisionId: z.string().uuid("Elige la revisión que se debe leer."), dueDate: futureDue(today) })
    .safeParse({ revisionId: field(fd, "revisionId"), dueDate: field(fd, "dueDate") });
  return result.success ? result.data : fail(result);
}

"use server";
import { Prisma } from "@prisma/client";
import { authorizedAction } from "@/lib/auth/action-guard";
import { logServerError } from "@/lib/log/server-log";
import { currentIdentity } from "@/lib/auth/context";
import { administrativeToday } from "@/lib/qms/administrative-date";
import { parseAddReadersForm, parseBulkAddReadersForm, parseConfirmReadingForm, parsePreviousReadersForm, parseRereadForm, parseWithdrawReadingForm, readingSaved, type ReadingActionState } from "./domain";
import { addReaders, addReadersToDocuments, confirmReading, requestPreviousReaders, requestReread, withdrawReading } from "./service";

/** D-141: acciones de la pestaña «Lectura» del PNT. Gestionar lectores exige editar el PNT. */
export type { ReadingActionState };

const actorOf = (fd: FormData) => { const actor = fd.get("actor"); return typeof actor === "string" && actor.trim() ? actor.trim() : "Usuario"; };
// Los errores técnicos (base de datos, captura del audit trail) se registran y no se muestran en crudo.
function message(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientUnknownRequestError || error instanceof Prisma.PrismaClientValidationError || error instanceof Prisma.PrismaClientInitializationError) {
    logServerError("controlled-documents.readings", error, { module: "PNT" });
    return "No se ha podido guardar la lectura. Recarga la ficha y vuelve a intentarlo.";
  }
  return error instanceof Error ? error.message : "No se ha podido guardar la lectura.";
}
// En error se conserva la revisión del formulario: lo escrito no se pierde.
const failed = (state: ReadingActionState, error: unknown): ReadingActionState => ({ error: message(error), formRevision: state.formRevision });
const people = (count: number) => count === 1 ? "1 persona" : `${count} personas`;

async function addReadersActionAuthenticatedContent(documentId: string, state: ReadingActionState, fd: FormData): Promise<ReadingActionState> {
  try {
    const result = await addReaders(documentId, parseAddReadersForm(fd, administrativeToday()), actorOf(fd));
    return readingSaved(state, `Lectura pedida a ${people(result.added)}.${result.skipped ? ` ${people(result.skipped)} ya la tenía${result.skipped === 1 ? "" : "n"} pendiente.` : ""}`);
  } catch (error) { return failed(state, error); }
}

async function requestPreviousReadersActionAuthenticatedContent(documentId: string, state: ReadingActionState, fd: FormData): Promise<ReadingActionState> {
  try {
    const { revisionId: checked, dueDate } = parsePreviousReadersForm(fd, administrativeToday());
    const result = await requestPreviousReaders(documentId, { revisionId: checked, dueDate }, actorOf(fd));
    return readingSaved(state, `Lectura pedida a ${people(result.added)} de los lectores anteriores.`);
  } catch (error) { return failed(state, error); }
}

async function requestRereadActionAuthenticatedContent(documentId: string, state: ReadingActionState, fd: FormData): Promise<ReadingActionState> {
  try {
    await requestReread(documentId, parseRereadForm(fd, administrativeToday()), actorOf(fd));
    return readingSaved(state, "Enviado a relectura.");
  } catch (error) { return failed(state, error); }
}

async function withdrawReadingActionAuthenticatedContent(documentId: string, state: ReadingActionState, fd: FormData): Promise<ReadingActionState> {
  try {
    await withdrawReading(documentId, parseWithdrawReadingForm(fd), actorOf(fd));
    return readingSaved(state, "Lectura retirada.");
  } catch (error) { return failed(state, error); }
}

/**
 * Entrega 2: la misma lectura en varios PNT a la vez. El guard exige editar cada PNT elegido. Los PNT sin la
 * revisión elegida (o anulados) se omiten y se informan.
 */
async function bulkAddReadersActionAuthenticatedContent(state: ReadingActionState, fd: FormData): Promise<ReadingActionState> {
  try {
    const result = await addReadersToDocuments(parseBulkAddReadersForm(fd, administrativeToday()), actorOf(fd));
    const added = result.documents.reduce((sum, row) => sum + row.added, 0);
    const withReadings = result.documents.filter(row => row.added).length;
    const pnts = (count: number) => count === 1 ? "1 PNT" : `${count} PNT`;
    const omitted = result.omitted.length ? ` Omitidos: ${result.omitted.map(row => `${row.baseCode} (${row.reason})`).join(", ")}.` : "";
    const already = result.documents.length > withReadings ? ` ${pnts(result.documents.length - withReadings)} ya tenía${result.documents.length - withReadings === 1 ? "" : "n"} pendientes a todas las personas.` : "";
    return readingSaved(state, `${added === 1 ? "1 lectura pedida" : `${added} lecturas pedidas`} en ${pnts(withReadings)}.${already}${omitted}`);
  } catch (error) { return failed(state, error); }
}

/** Cada persona marca su propia lectura. */
async function confirmOwnReadingActionAuthenticatedContent(documentId: string, state: ReadingActionState, fd: FormData): Promise<ReadingActionState> {
  try {
    await confirmReading(documentId, parseConfirmReadingForm(fd, administrativeToday()), { actor: actorOf(fd), userId: currentIdentity()?.principal.id, onBehalf: false });
    return readingSaved(state, "Lectura registrada.");
  } catch (error) { return failed(state, error); }
}

/** Garantía de Calidad marca la lectura de otra persona (también de las externas). */
async function confirmReadingForOtherActionAuthenticatedContent(documentId: string, state: ReadingActionState, fd: FormData): Promise<ReadingActionState> {
  try {
    await confirmReading(documentId, parseConfirmReadingForm(fd, administrativeToday()), { actor: actorOf(fd), userId: currentIdentity()?.principal.id, onBehalf: true });
    return readingSaved(state, "Lectura registrada.");
  } catch (error) { return failed(state, error); }
}

export async function addReadersAction(...args: Parameters<typeof addReadersActionAuthenticatedContent>) {
  return authorizedAction("addReadersAction", args, authenticated => addReadersActionAuthenticatedContent(...authenticated as Parameters<typeof addReadersActionAuthenticatedContent>));
}
export async function requestPreviousReadersAction(...args: Parameters<typeof requestPreviousReadersActionAuthenticatedContent>) {
  return authorizedAction("requestPreviousReadersAction", args, authenticated => requestPreviousReadersActionAuthenticatedContent(...authenticated as Parameters<typeof requestPreviousReadersActionAuthenticatedContent>));
}
export async function requestRereadAction(...args: Parameters<typeof requestRereadActionAuthenticatedContent>) {
  return authorizedAction("requestRereadAction", args, authenticated => requestRereadActionAuthenticatedContent(...authenticated as Parameters<typeof requestRereadActionAuthenticatedContent>));
}
export async function withdrawReadingAction(...args: Parameters<typeof withdrawReadingActionAuthenticatedContent>) {
  return authorizedAction("withdrawReadingAction", args, authenticated => withdrawReadingActionAuthenticatedContent(...authenticated as Parameters<typeof withdrawReadingActionAuthenticatedContent>));
}
export async function confirmOwnReadingAction(...args: Parameters<typeof confirmOwnReadingActionAuthenticatedContent>) {
  return authorizedAction("confirmOwnReadingAction", args, authenticated => confirmOwnReadingActionAuthenticatedContent(...authenticated as Parameters<typeof confirmOwnReadingActionAuthenticatedContent>));
}
export async function confirmReadingForOtherAction(...args: Parameters<typeof confirmReadingForOtherActionAuthenticatedContent>) {
  return authorizedAction("confirmReadingForOtherAction", args, authenticated => confirmReadingForOtherActionAuthenticatedContent(...authenticated as Parameters<typeof confirmReadingForOtherActionAuthenticatedContent>));
}
export async function bulkAddReadersAction(...args: Parameters<typeof bulkAddReadersActionAuthenticatedContent>) {
  return authorizedAction("bulkAddReadersAction", args, authenticated => bulkAddReadersActionAuthenticatedContent(...authenticated as Parameters<typeof bulkAddReadersActionAuthenticatedContent>));
}

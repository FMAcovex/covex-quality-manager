"use server";
import { authorizedAction } from "@/lib/auth/action-guard";
import { currentIdentity } from "@/lib/auth/context";
import { administrativeToday } from "@/lib/qms/administrative-date";
import { parseAddReadersForm, parseConfirmReadingForm, parsePreviousReadersForm, parseRereadForm, parseWithdrawReadingForm } from "./domain";
import { addReaders, confirmReading, requestPreviousReaders, requestReread, withdrawReading } from "./service";

/** D-141: acciones de la pestaña «Lectura» del PNT. Gestionar lectores exige editar el PNT. */
export type ReadingActionState = { error: string | null; message?: string | null };

const actorOf = (fd: FormData) => { const actor = fd.get("actor"); return typeof actor === "string" && actor.trim() ? actor.trim() : "Usuario"; };
const message = (error: unknown) => error instanceof Error ? error.message : "No se ha podido guardar la lectura.";
const people = (count: number) => count === 1 ? "1 persona" : `${count} personas`;

async function addReadersActionAuthenticatedContent(documentId: string, _state: ReadingActionState, fd: FormData): Promise<ReadingActionState> {
  try {
    const result = await addReaders(documentId, parseAddReadersForm(fd, administrativeToday()), actorOf(fd));
    return { error: null, message: `Lectura pedida a ${people(result.added)}.${result.skipped ? ` ${people(result.skipped)} ya la tenía${result.skipped === 1 ? "" : "n"} pendiente.` : ""}` };
  } catch (error) { return { error: message(error) }; }
}

async function requestPreviousReadersActionAuthenticatedContent(documentId: string, _state: ReadingActionState, fd: FormData): Promise<ReadingActionState> {
  try {
    const { revisionId: checked, dueDate } = parsePreviousReadersForm(fd, administrativeToday());
    const result = await requestPreviousReaders(documentId, { revisionId: checked, dueDate }, actorOf(fd));
    return { error: null, message: `Lectura pedida a ${people(result.added)} de los lectores anteriores.` };
  } catch (error) { return { error: message(error) }; }
}

async function requestRereadActionAuthenticatedContent(documentId: string, _state: ReadingActionState, fd: FormData): Promise<ReadingActionState> {
  try {
    await requestReread(documentId, parseRereadForm(fd, administrativeToday()), actorOf(fd));
    return { error: null, message: "Enviado a relectura." };
  } catch (error) { return { error: message(error) }; }
}

async function withdrawReadingActionAuthenticatedContent(documentId: string, _state: ReadingActionState, fd: FormData): Promise<ReadingActionState> {
  try {
    await withdrawReading(documentId, parseWithdrawReadingForm(fd), actorOf(fd));
    return { error: null, message: "Lectura retirada." };
  } catch (error) { return { error: message(error) }; }
}

/** Cada persona marca su propia lectura. */
async function confirmOwnReadingActionAuthenticatedContent(documentId: string, _state: ReadingActionState, fd: FormData): Promise<ReadingActionState> {
  try {
    await confirmReading(documentId, parseConfirmReadingForm(fd, administrativeToday()), { actor: actorOf(fd), userId: currentIdentity()?.principal.id, onBehalf: false });
    return { error: null, message: "Lectura registrada." };
  } catch (error) { return { error: message(error) }; }
}

/** Garantía de Calidad marca la lectura de otra persona (también de las externas). */
async function confirmReadingForOtherActionAuthenticatedContent(documentId: string, _state: ReadingActionState, fd: FormData): Promise<ReadingActionState> {
  try {
    await confirmReading(documentId, parseConfirmReadingForm(fd, administrativeToday()), { actor: actorOf(fd), userId: currentIdentity()?.principal.id, onBehalf: true });
    return { error: null, message: "Lectura registrada." };
  } catch (error) { return { error: message(error) }; }
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

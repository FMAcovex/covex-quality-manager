"use server";
import { parseMasterForm, parseRevisionForm } from "./domain";
import { saveMaster, saveRevision } from "./service";
import { Prisma } from "@prisma/client";
import { preserveFormState, type PreservedFormState } from "../../lib/forms/preserved-state";
export type SaveState = PreservedFormState & {
    error?: string;
    url?: string;
};
function errorMessage(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return "El código o revisión ya existe, o el PNT ya tiene una revisión vigente/en elaboración.";
    if(error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientValidationError || error instanceof Prisma.PrismaClientInitializationError)
        return "No se ha podido guardar el registro. Recarga la página y comprueba los valores seleccionados.";
    return error instanceof Error ? error.message : "No se ha podido guardar el registro.";
}
export async function masterAction(id: string | null, _state: SaveState, fd: FormData): Promise<SaveState> {
    try {
        const saved = await saveMaster(parseMasterForm(fd), id || undefined);
        return { url: `/controlled-documents/${saved}` };
    }
    catch (error) {
        return preserveFormState(_state, fd, { error: errorMessage(error) });
    }
}
export async function revisionAction(documentId: string, id: string | null, _state: SaveState, fd: FormData): Promise<SaveState> {
    try {
        await saveRevision(documentId, parseRevisionForm(fd), id || undefined);
        return { url: `/controlled-documents/${documentId}?tab=revisions` };
    }
    catch (error) {
        return preserveFormState(_state, fd, { error: errorMessage(error) });
    }
}

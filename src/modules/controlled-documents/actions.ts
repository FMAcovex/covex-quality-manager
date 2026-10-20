"use server";
import { authorizedAction } from "@/lib/auth/action-guard";
import { withReturnTo } from "./navigation";
import { parseMasterForm, parseRevisionForm } from "./domain";
import { saveMaster, saveRevision } from "./service";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { lifecyclePrincipal, requireLifecyclePermission } from "./lifecycle/access";
import { preserveFormState, type PreservedFormState } from "../../lib/forms/preserved-state";
import { logServerError } from "@/lib/log/server-log";
export type SaveState = PreservedFormState & {
    error?: string;
    url?: string;
};
function errorMessage(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return "El código o revisión ya existe, o el PNT ya tiene una revisión vigente/en elaboración.";
    if(error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientValidationError || error instanceof Prisma.PrismaClientInitializationError) {
        logServerError("controlled-documents.save", error, { module: "PNT" });
        return "No se ha podido guardar el registro. Recarga la página y comprueba los valores seleccionados.";
    }
    return error instanceof Error ? error.message : "No se ha podido guardar el registro.";
}
async function masterActionAuthenticatedContent(id: string | null, _state: SaveState, fd: FormData): Promise<SaveState> {
    try {
        const input = parseMasterForm(fd);
        if (input.existingDocument) { const principal = lifecyclePrincipal(await headers()); requireLifecyclePermission(principal, "legacy-register"); input.actor = principal.name; }
        const saved = await saveMaster(input, id || undefined);
        return { url: withReturnTo(`/controlled-documents/${saved}`, fd.get("returnTo")) };
    }
    catch (error) {
        return preserveFormState(_state, fd, { error: errorMessage(error) });
    }
}
async function revisionActionAuthenticatedContent(documentId: string, id: string | null, _state: SaveState, fd: FormData): Promise<SaveState> {
    try {
        const input = parseRevisionForm(fd);
        if (input.existingDocument) { const principal = lifecyclePrincipal(await headers()); requireLifecyclePermission(principal, "legacy-register"); input.actor = principal.name; }
        await saveRevision(documentId, input, id || undefined);
        return { url: withReturnTo(`/controlled-documents/${documentId}?tab=revisions`, fd.get("returnTo")) };
    }
    catch (error) {
        return preserveFormState(_state, fd, { error: errorMessage(error) });
    }
}

export async function masterAction(...args: Parameters<typeof masterActionAuthenticatedContent>) {
  return authorizedAction("masterAction", args, authenticated => masterActionAuthenticatedContent(...authenticated as Parameters<typeof masterActionAuthenticatedContent>));
}

export async function revisionAction(...args: Parameters<typeof revisionActionAuthenticatedContent>) {
  return authorizedAction("revisionAction", args, authenticated => revisionActionAuthenticatedContent(...authenticated as Parameters<typeof revisionActionAuthenticatedContent>));
}

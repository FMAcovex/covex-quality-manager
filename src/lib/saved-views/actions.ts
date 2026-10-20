"use server";

import { revalidatePath } from "next/cache";
import { authorizedAction } from "@/lib/auth/action-guard";
import { currentIdentity } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { normalizeViewQuery, parseListPath, parseViewName, SAVED_VIEWS_PER_LIST_MAX, SavedViewError } from "./domain";
import { logServerError } from "@/lib/log/server-log";

// Preferencias personales (D-084): sin operación de audit trail asociada en
// src/lib/audit/action-boundary.ts y sin captura obligatoria en la tabla.

export type SavedViewActionResult = { ok: true; id?: string } | { ok: false; error: string };

type SaveInput = { listPath: string; name: string; query: string; _covexCsrf?: string };
type DeleteInput = { id: string; _covexCsrf?: string };

function ownerId() {
  const id = currentIdentity()?.principal.id;
  if (!id) throw new SavedViewError("Sesión no disponible.");
  return id;
}

function failure(error: unknown): SavedViewActionResult {
  if (error instanceof SavedViewError) return { ok: false, error: error.message };
  logServerError("saved-views.save", error);
  return { ok: false, error: "No se ha podido guardar la vista." };
}

async function saveListViewActionAuthenticatedContent(input: SaveInput): Promise<SavedViewActionResult> {
  try {
    const userId = ownerId(), listPath = parseListPath(input?.listPath), name = parseViewName(input?.name), query = normalizeViewQuery(input?.query);
    const existing = await prisma.savedListView.findUnique({ where: { userId_listPath_name: { userId, listPath, name } }, select: { id: true } });
    if (!existing && await prisma.savedListView.count({ where: { userId, listPath } }) >= SAVED_VIEWS_PER_LIST_MAX) {
      throw new SavedViewError(`Puedes guardar como máximo ${SAVED_VIEWS_PER_LIST_MAX} vistas por listado.`);
    }
    // Guardar con un nombre existente sustituye sus filtros de forma explícita (la interfaz lo confirma antes).
    const view = await prisma.savedListView.upsert({
      where: { userId_listPath_name: { userId, listPath, name } },
      create: { userId, listPath, name, query },
      update: { query },
      select: { id: true },
    });
    revalidatePath(listPath);
    return { ok: true, id: view.id };
  } catch (error) {
    return failure(error);
  }
}

async function deleteListViewActionAuthenticatedContent(input: DeleteInput): Promise<SavedViewActionResult> {
  try {
    const userId = ownerId();
    const id = typeof input?.id === "string" ? input.id : "";
    const view = id ? await prisma.savedListView.findFirst({ where: { id, userId }, select: { id: true, listPath: true } }) : null;
    if (!view) throw new SavedViewError("La vista ya no existe.");
    await prisma.savedListView.delete({ where: { id: view.id } });
    revalidatePath(view.listPath);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveListViewAction(...args: Parameters<typeof saveListViewActionAuthenticatedContent>) {
  return authorizedAction("saveListViewAction", args, authenticated => saveListViewActionAuthenticatedContent(...authenticated as Parameters<typeof saveListViewActionAuthenticatedContent>));
}

export async function deleteListViewAction(...args: Parameters<typeof deleteListViewActionAuthenticatedContent>) {
  return authorizedAction("deleteListViewAction", args, authenticated => deleteListViewActionAuthenticatedContent(...authenticated as Parameters<typeof deleteListViewActionAuthenticatedContent>));
}

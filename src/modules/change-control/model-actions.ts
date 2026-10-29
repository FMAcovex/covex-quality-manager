"use server";

import { revalidatePath } from "next/cache";
import { authorizedAction } from "@/lib/auth/action-guard";
import { configurationAuditBoundary } from "@/lib/audit/configuration-boundary";
import { ChangeModelError, createChangeModel, parseChangeModelForm, updateChangeModel } from "./models";

export type ChangeModelFormState = { error?: string; saved?: boolean; formRevision?: number };

const reason = (fd: FormData) => { const value = fd.get("reason"); return typeof value === "string" && value.trim() ? value.trim() : null; };

/** Solo los errores de validación del modelo se muestran tal cual; el resto no expone detalles técnicos. */
function validationMessage(error: unknown): string | null {
  for (let current = error, depth = 0; current instanceof Error && depth < 5; current = current.cause, depth++) {
    if (current instanceof ChangeModelError) return current.message;
  }
  return null;
}
const failure = (previous: ChangeModelFormState, error: unknown): ChangeModelFormState => ({ error: validationMessage(error) ?? "No se ha podido guardar el modelo.", formRevision: previous.formRevision });

// El error se recoge fuera del límite de auditoría: así la transacción se revierte entera.
async function saveModel(name: string, args: unknown[], previous: ChangeModelFormState, fd: FormData, save: () => Promise<unknown>): Promise<ChangeModelFormState> {
  try {
    await configurationAuditBoundary(name, args, async () => { await save(); });
  } catch (error) {
    return failure(previous, error);
  }
  revalidatePath("/settings/change-models");
  return { saved: true, formRevision: (previous.formRevision ?? 0) + 1 };
}

async function createChangeModelActionAuthenticatedContent(previous: ChangeModelFormState, fd: FormData): Promise<ChangeModelFormState> {
  let input;
  try { input = parseChangeModelForm(fd); } catch (error) { return failure(previous, error); }
  return saveModel("createChangeModelAction", [fd], previous, fd, () => createChangeModel(input, reason(fd)));
}

async function updateChangeModelActionAuthenticatedContent(id: string, previous: ChangeModelFormState, fd: FormData): Promise<ChangeModelFormState> {
  let input;
  try { input = parseChangeModelForm(fd); } catch (error) { return failure(previous, error); }
  return saveModel("updateChangeModelAction", [id, fd], previous, fd, () => updateChangeModel(id, input, reason(fd)));
}

export async function createChangeModelAction(...args: Parameters<typeof createChangeModelActionAuthenticatedContent>) {
  return authorizedAction("createChangeModelAction", args, authenticated => createChangeModelActionAuthenticatedContent(...authenticated as Parameters<typeof createChangeModelActionAuthenticatedContent>));
}

export async function updateChangeModelAction(...args: Parameters<typeof updateChangeModelActionAuthenticatedContent>) {
  return authorizedAction("updateChangeModelAction", args, authenticated => updateChangeModelActionAuthenticatedContent(...authenticated as Parameters<typeof updateChangeModelActionAuthenticatedContent>));
}

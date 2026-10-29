import { ChangeControlScope, Prisma, type ChangeControlModel, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/db";
import { withDatabaseTransaction } from "../../lib/transaction-context";
import type { ChangeControlFormDefaults } from "./types";
import { MODEL_LIMITS } from "./model-limits";

/**
 * D-122: modelos de Control de cambios. Calidad define casos tipo (p. ej., «Cambio de proveedor»)
 * con los campos de la solicitud que suelen repetirse y las acciones habituales del plan. Al dar de
 * alta un cambio «desde un modelo», el formulario sale prerrellenado y todo se puede cambiar; no
 * se guarda nada hasta que el usuario guarda. Nunca prerrellenan fechas, código, solicitante,
 * decisiones, evaluación, clasificación, implicaciones ni el resultado del Dictamen.
 */
export { MODEL_LIMITS };

const optionalText = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`).transform((value) => value || null);
const modelSchema = z.object({
  name: z.string().trim().min(1, "Indica el nombre del modelo.").max(MODEL_LIMITS.name, `El nombre admite como máximo ${MODEL_LIMITS.name} caracteres.`),
  purpose: optionalText(MODEL_LIMITS.purpose),
  isActive: z.boolean(),
  departmentId: z.string().trim().transform((value) => value || null),
  scope: z.array(z.nativeEnum(ChangeControlScope, { errorMap: () => ({ message: "Alcance no válido." }) })),
  otherScope: optionalText(MODEL_LIMITS.otherScope),
  changeDescription: optionalText(MODEL_LIMITS.text),
  justification: optionalText(MODEL_LIMITS.text),
  providedDocuments: optionalText(MODEL_LIMITS.text),
  tasks: z.array(z.string().max(MODEL_LIMITS.task, `Cada acción admite como máximo ${MODEL_LIMITS.task} caracteres.`)).max(MODEL_LIMITS.tasks, `Como máximo ${MODEL_LIMITS.tasks} acciones.`),
  actor: z.string().trim().min(1, "Indica el responsable del registro.").max(200),
  updatedAt: z.string().optional(),
});
export type ChangeModelInput = z.infer<typeof modelSchema>;

/** Error de validación del modelo; su mensaje se muestra tal cual en el formulario. */
export class ChangeModelError extends Error {
  constructor(message: string) { super(message); this.name = "ChangeModelError"; }
}

const field = (fd: FormData, name: string) => { const value = fd.get(name); return typeof value === "string" ? value : ""; };

/** Una acción por línea; se ignoran las líneas vacías. */
export function parseModelTasks(text: string) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function parseChangeModelForm(fd: FormData): ChangeModelInput {
  const parsed = modelSchema.safeParse({
    name: field(fd, "name"),
    purpose: field(fd, "purpose"),
    isActive: field(fd, "isActive") !== "false",
    departmentId: field(fd, "departmentId"),
    scope: fd.getAll("scope").filter((value): value is string => typeof value === "string"),
    otherScope: field(fd, "otherScope"),
    changeDescription: field(fd, "changeDescription"),
    justification: field(fd, "justification"),
    providedDocuments: field(fd, "providedDocuments"),
    tasks: parseModelTasks(field(fd, "tasks")),
    actor: field(fd, "actor"),
    updatedAt: field(fd, "updatedAt") || undefined,
  });
  if (!parsed.success) throw new ChangeModelError(parsed.error.issues[0]?.message ?? "Revisa el modelo.");
  if (parsed.data.otherScope && !parsed.data.scope.includes("OTHER")) parsed.data.scope.push("OTHER");
  return parsed.data;
}

const data = (v: ChangeModelInput) => ({
  name: v.name, purpose: v.purpose, isActive: v.isActive, departmentId: v.departmentId,
  scope: [...new Set(v.scope)], otherScope: v.otherScope, changeDescription: v.changeDescription,
  justification: v.justification, providedDocuments: v.providedDocuments, tasks: v.tasks,
});
const snapshot = (model: ChangeControlModel) => JSON.parse(JSON.stringify({ ...model, createdAt: undefined, updatedAt: undefined }));

/** Un departamento inactivo solo se admite si el modelo ya lo tenía (no se pierde al editar). */
async function checkDepartment(tx: Prisma.TransactionClient, departmentId: string | null, currentId: string | null = null) {
  if (!departmentId) return;
  const department = await tx.department.findUnique({ where: { id: departmentId }, select: { isActive: true } });
  if (!department) throw new ChangeModelError("El departamento elegido no existe.");
  if (!department.isActive && departmentId !== currentId) throw new ChangeModelError("El departamento elegido no está activo.");
}
/** Los nombres no distinguen mayúsculas; el bloqueo serializa las altas y renombrados concurrentes. */
async function checkName(tx: Prisma.TransactionClient, name: string, exceptId?: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('covex.change_control_model.name'))`;
  const clash = await tx.changeControlModel.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
  if (clash) throw new ChangeModelError("Ya existe un modelo con ese nombre.");
}

// Se compone con la transacción del límite de auditoría de configuración (no abre otra conexión).
export async function createChangeModel(v: ChangeModelInput, reason: string | null, db: PrismaClient = prisma) {
  return withDatabaseTransaction(db, async (tx) => {
    await checkDepartment(tx, v.departmentId);
    await checkName(tx, v.name);
    const created = await tx.changeControlModel.create({ data: { ...data(v), createdByText: v.actor, updatedByText: v.actor } });
    await tx.configurationChange.create({ data: { entityType: "ChangeControlModel", entityKey: created.id, action: "CREATE", newValue: snapshot(created), changedByText: v.actor, reason } });
    return created;
  });
}

export async function updateChangeModel(id: string, v: ChangeModelInput, reason: string | null, db: PrismaClient = prisma) {
  return withDatabaseTransaction(db, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ChangeControlModel" WHERE id = ${id} FOR UPDATE`;
    const current = await tx.changeControlModel.findUnique({ where: { id } });
    if (!current) throw new ChangeModelError("El modelo no existe.");
    if (v.updatedAt && current.updatedAt.toISOString() !== v.updatedAt) throw new ChangeModelError("El modelo ha cambiado. Recarga antes de guardar.");
    await checkDepartment(tx, v.departmentId, current.departmentId);
    await checkName(tx, v.name, id);
    const next = data(v);
    const changed = JSON.stringify(next) !== JSON.stringify({ name: current.name, purpose: current.purpose, isActive: current.isActive, departmentId: current.departmentId, scope: current.scope, otherScope: current.otherScope, changeDescription: current.changeDescription, justification: current.justification, providedDocuments: current.providedDocuments, tasks: current.tasks });
    if (!changed) return current;
    const updated = await tx.changeControlModel.update({ where: { id }, data: { ...next, version: current.version + 1, updatedByText: v.actor } });
    await tx.configurationChange.create({ data: { entityType: "ChangeControlModel", entityKey: updated.id, action: current.isActive === updated.isActive ? "UPDATE" : updated.isActive ? "ACTIVATE" : "DEACTIVATE", oldValue: snapshot(current), newValue: snapshot(updated), changedByText: v.actor, reason } });
    return updated;
  });
}

export function listChangeModels(options: { activeOnly?: boolean } = {}, db: PrismaClient = prisma) {
  return db.changeControlModel.findMany({
    where: options.activeOnly ? { isActive: true } : {},
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { department: { select: { code: true, name: true } } },
  });
}

export const modelTasks = (model: Pick<ChangeControlModel, "tasks">) =>
  Array.isArray(model.tasks) ? model.tasks.filter((task): task is string => typeof task === "string") : [];

/** Valores que el modelo propone en el alta; el resto del formulario queda como siempre. */
export function changeModelDefaults(model: ChangeControlModel): Partial<ChangeControlFormDefaults> {
  return {
    ...(model.departmentId ? { departmentId: model.departmentId } : {}),
    scope: model.scope,
    otherScope: model.otherScope ?? undefined,
    description: model.changeDescription ?? undefined,
    justification: model.justification ?? undefined,
    providedDocuments: model.providedDocuments ?? undefined,
    tasks: modelTasks(model).map((description) => ({ departmentId: model.departmentId ?? "", description, responsible: "", plannedDate: "" })),
  };
}

/** Texto que se añade al historial de alta del Control de cambios. */
export const createdFromModelNote = (model: Pick<ChangeControlModel, "name" | "version">) => `desde el modelo «${model.name}» (versión ${model.version})`;

import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/db";
import { responsibleUsersProblem } from "../../lib/auth/app-users";
import { responsibleUserIdSchema } from "../../lib/qms/responsible-user";
import { canAssignRevision, revisionFunctions } from "./assignment-functions";

/** D-118: validación y guardado de los responsables (las funciones están en assignment-functions). */

const text = z.string().trim().max(200, "El responsable admite como máximo 200 caracteres.");
const day = z.string().trim().refine(v => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "La fecha prevista no es válida.");
const assignee = z.object({ text, userId: responsibleUserIdSchema });
const revisionAssignment = z.object({
  id: z.string().uuid(),
  updatedAt: z.string(),
  preparation: assignee.extend({ date: day }),
  review: assignee.extend({ date: day }),
  approval: assignee.extend({ date: day }),
});
const assignmentsSchema = z.object({
  updatedAt: z.string(),
  actor: z.string().trim().min(1, "Indica el responsable del registro.").max(200),
  periodic: assignee,
  revisions: z.array(revisionAssignment),
});
export type AssignmentsInput = z.infer<typeof assignmentsSchema>;

const field = (fd: FormData, name: string) => { const v = fd.get(name); return typeof v === "string" ? v : ""; };
const assigneeFrom = (fd: FormData, prefix: string) => ({ text: field(fd, `${prefix}Responsible`), userId: field(fd, `${prefix}ResponsibleUserId`) });

export function parseAssignmentsForm(fd: FormData): AssignmentsInput {
  const parsed = assignmentsSchema.safeParse({
    updatedAt: field(fd, "updatedAt"),
    actor: field(fd, "actor"),
    periodic: assigneeFrom(fd, "periodicReview"),
    revisions: fd.getAll("revisionId").filter((id): id is string => typeof id === "string").map(id => ({
      id,
      updatedAt: field(fd, `${id}.updatedAt`),
      ...Object.fromEntries(revisionFunctions.map(f => [f.key, { ...assigneeFrom(fd, `${id}.${f.key}`), date: field(fd, `${id}.${f.key}TargetDate`) }])),
    })),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Revisa los responsables.");
  return parsed.data;
}

const date = (v: string) => v ? new Date(`${v}T00:00:00Z`) : null;
const isoDay = (v: Date | null) => v ? v.toISOString().slice(0, 10) : null;
type Names = Map<string, string>;
/** Al elegir un usuario sin escribir el nombre, se guarda su nombre (como propone el formulario). */
const responsibleText = (value: { text: string; userId: string | null }, names: Names) => value.text || (value.userId ? names.get(value.userId) ?? "" : "") || null;

export async function saveAssignments(documentId: string, v: AssignmentsInput, db: PrismaClient = prisma) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ControlledDocument" WHERE id = ${documentId} FOR UPDATE`;
    const master = await tx.controlledDocument.findUniqueOrThrow({ where: { id: documentId }, include: { revisions: true } });
    if (master.administrativeStatus === "ANNULLED") throw new Error("El maestro anulado no admite cambios.");
    if (master.updatedAt.toISOString() !== v.updatedAt) throw new Error("El registro ha cambiado. Recarga antes de guardar.");
    const revisions = v.revisions.map(input => {
      const current = master.revisions.find(r => r.id === input.id);
      if (!current) throw new Error("La revisión no pertenece a este PNT.");
      if (!canAssignRevision(current.status)) throw new Error(`La revisión ${current.revisionCode} ya no está en elaboración, revisión ni aprobación.`);
      if (current.updatedAt.toISOString() !== input.updatedAt) throw new Error(`La revisión ${current.revisionCode} ha cambiado. Recarga antes de guardar.`);
      return { input, current };
    });
    const previousUsers = [master.periodicReviewResponsibleUserId, ...master.revisions.flatMap(r => [r.preparationResponsibleUserId, r.reviewResponsibleUserId, r.approvalResponsibleUserId])];
    const chosen = [v.periodic.userId, ...v.revisions.flatMap(r => revisionFunctions.map(f => r[f.key].userId))];
    const problem = await responsibleUsersProblem(chosen, previousUsers);
    if (problem) throw new Error(problem);
    const ids = chosen.filter((id): id is string => Boolean(id));
    const names: Names = new Map((ids.length ? await tx.authUser.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } }) : []).map(u => [u.id, u.displayName]));

    const periodic = { periodicReviewResponsible: responsibleText(v.periodic, names), periodicReviewResponsibleUserId: v.periodic.userId };
    const oldPeriodic = { periodicReviewResponsible: master.periodicReviewResponsible, periodicReviewResponsibleUserId: master.periodicReviewResponsibleUserId };
    if (JSON.stringify(periodic) !== JSON.stringify(oldPeriodic)) {
      await tx.controlledDocument.update({ where: { id: documentId }, data: periodic });
      await history(tx, documentId, null, "Responsable de la revisión periódica", v.actor, oldPeriodic, periodic);
    }
    for (const { input, current } of revisions) {
      const next = Object.fromEntries(revisionFunctions.flatMap(f => [
        [`${f.key}Responsible`, responsibleText(input[f.key], names)],
        [`${f.key}ResponsibleUserId`, input[f.key].userId],
        [`${f.key}TargetDate`, input[f.key].date || null],
      ]));
      const old = Object.fromEntries(revisionFunctions.flatMap(f => [
        [`${f.key}Responsible`, current[`${f.key}Responsible`]],
        [`${f.key}ResponsibleUserId`, current[`${f.key}ResponsibleUserId`]],
        [`${f.key}TargetDate`, isoDay(current[`${f.key}TargetDate`])],
      ]));
      if (JSON.stringify(next) === JSON.stringify(old)) continue;
      await tx.controlledDocumentRevision.update({ where: { id: current.id }, data: Object.fromEntries(Object.entries(next).map(([key, value]) => [key, key.endsWith("TargetDate") ? date(value as string | null ?? "") : value])) });
      await history(tx, documentId, current.id, `Responsables de la revisión ${current.revisionCode}`, v.actor, old, next);
    }
    return documentId;
  });
}

async function history(tx: Prisma.TransactionClient, documentId: string, revisionId: string | null, action: string, actor: string, oldValue: unknown, newValue: unknown) {
  await tx.controlledDocumentChange.create({ data: { documentId, revisionId, action, changedByText: actor, reason: "Asignación de responsables (D-118)", oldValue: JSON.parse(JSON.stringify(oldValue)), newValue: JSON.parse(JSON.stringify(newValue)) } });
}

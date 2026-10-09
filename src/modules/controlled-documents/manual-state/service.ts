import { createHash, randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { uuid } from "../documents/domain";
import { documentHistoryActions } from "../documents/history";
import { assertActivationIdentity } from "../lifecycle/domain";
import { requireLifecyclePermission, type LifecyclePrincipal } from "../lifecycle/access";
import { manualStatusSchema, validateManualChange } from "./domain";

const iso = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) || null;
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
const date = (value: string) => new Date(value + "T00:00:00Z");

export async function changeManualRevisionStatus(documentId: string, revisionId: string, raw: unknown, principal: LifecyclePrincipal, db: PrismaClient = prisma) {
  uuid(documentId); uuid(revisionId);
  requireLifecyclePermission(principal, "manage-state");
  const input = manualStatusSchema.parse(raw);
  const requestHash = createHash("sha256").update(JSON.stringify({ documentId, revisionId, actor: principal.name, source: principal.source, input })).digest("hex");
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ControlledDocument" WHERE id = ${documentId} FOR UPDATE`;
    const replay = await tx.controlledRevisionDecision.findUnique({ where: { requestId: input.requestId } });
    if (replay) {
      if (replay.requestHash !== requestHash || replay.revisionId !== revisionId || replay.documentId !== documentId)
        throw new Error("Identificador de solicitud reutilizado con datos distintos.");
      return replay;
    }
    const master = await tx.controlledDocument.findUnique({ where: { id: documentId } });
    const revision = await tx.controlledDocumentRevision.findFirst({ where: { id: revisionId, documentId } });
    if (!master || !revision || master.administrativeStatus === "ANNULLED") throw new Error("El PNT o la revisión no están disponibles.");
    const projection = await tx.controlledRevisionLifecycle.findUnique({ where: { revisionId } });
    if ((projection?.version || 0) !== input.expectedVersion || revision.updatedAt.toISOString() !== input.expectedUpdatedAt)
      throw new Error("El estado ha cambiado. Recargue la ficha antes de guardar.");
    const today = new Date().toISOString().slice(0, 10);
    validateManualChange(revision.status, input, today);
    if (master.administrativeStatus !== "ACTIVE" && input.targetStatus !== "DRAFT")
      throw new Error("Complete primero el registro maestro del PNT.");
    if (["APPROVED_PENDING_EFFECTIVE", "IN_FORCE"].includes(input.targetStatus)) {
      if (!master.baseCode || !master.title || !master.departmentId) throw new Error("Complete código, título y departamento del maestro.");
      assertActivationIdentity(master, revision);
    }
    const prior = await tx.controlledDocumentRevision.findFirst({ where: { documentId, status: "IN_FORCE" } });
    if (input.targetStatus === "IN_FORCE" && (prior?.id || null) !== (input.previousRevisionId ?? null))
      throw new Error("Ha cambiado la revisión vigente anterior. Recargue y confirme el cambio.");
    const lifecycle = await tx.controlledRevisionLifecycle.upsert({ where: { revisionId },
      create: { revisionId, documentId, legacyOrigin: !!revision.consolidatedAt,
        effectiveFrom: revision.effectiveFrom, reviewDueAt: revision.reviewDueAt, obsoletedAt: revision.obsoletedAt },
      update: {},
    });
    const start = input.targetStatus === "IN_FORCE" ? date(input.effectiveFrom!) : null;
    const due = input.targetStatus === "IN_FORCE" ? (input.reviewDueAt ? date(input.reviewDueAt) : null) : null;
    if (start && lifecycle.approvalAt && start < lifecycle.approvalAt)
      throw new Error("La vigencia no puede ser anterior a la fecha de aprobación ya registrada.");
    if (start && prior?.id !== revisionId && prior) {
      const oldLifecycle = await tx.controlledRevisionLifecycle.upsert({ where: { revisionId: prior.id },
        create: { documentId, revisionId: prior.id, legacyOrigin: true,
          effectiveFrom: prior.effectiveFrom, reviewDueAt: prior.reviewDueAt, obsoletedAt: prior.obsoletedAt },
        update: {},
      });
      const oldStart = iso(oldLifecycle.effectiveFrom) || iso(prior.effectiveFrom);
      if (oldStart && input.effectiveFrom! < oldStart) throw new Error("La nueva vigencia no puede comenzar antes que la revisión vigente anterior.");
      await tx.controlledDocumentRevision.update({ where: { id: prior.id }, data: { status: "OBSOLETE" } });
      await tx.controlledRevisionLifecycle.update({ where: { revisionId: prior.id }, data: { version: { increment: 1 }, obsoletedAt: start } });
      await tx.controlledDocumentChange.create({ data: {
        documentId, revisionId: prior.id, action: documentHistoryActions.manual,
        changedByText: principal.name, reason: "Sustituida por revisión " + revision.revisionCode + ". " + input.reason,
        oldValue: json({ status: prior.status, revisionCode: prior.revisionCode }),
        newValue: json({ status: "OBSOLETE", revisionCode: prior.revisionCode, obsoletedAt: iso(start), successorRevisionId: revisionId, mode: "MANUAL" }),
      } });
    }
    const currentEffective = input.targetStatus === "OBSOLETE" ? (lifecycle.effectiveFrom || revision.effectiveFrom) : start;
    const obsoleteAt = input.targetStatus === "OBSOLETE" ? date(today) : null;
    if (obsoleteAt && currentEffective && obsoleteAt < currentEffective)
      throw new Error("La obsolescencia no puede preceder a la vigencia.");
    const nextProjection = await tx.controlledRevisionLifecycle.update({ where: { revisionId },
      data: { version: { increment: 1 }, effectiveFrom: currentEffective, reviewDueAt: due, obsoletedAt: obsoleteAt } });
    const updated = await tx.controlledDocumentRevision.update({ where: { id: revisionId },
      data: { status: input.targetStatus,
        ...(["APPROVED_PENDING_EFFECTIVE", "IN_FORCE", "OBSOLETE"].includes(input.targetStatus) ? { consolidatedAt: revision.consolidatedAt || new Date() } : {}),
      } });
    const decision = await tx.controlledRevisionDecision.create({ data: {
      id: randomUUID(), documentId, revisionId, sequence: nextProjection.version,
      requestId: input.requestId, requestHash, operation: "MANUAL_STATUS",
      actor: principal.name, identitySource: principal.source, reason: input.reason,
      oldState: revision.status, newState: updated.status,
      details: json({ ...input, mode: "MANUAL_RECORD", electronicApproval: false }),
      before: json({ revision: { id: revision.id, status: revision.status, updatedAt: revision.updatedAt }, lifecycle }),
      after: json({ revision: { id: updated.id, status: updated.status, updatedAt: updated.updatedAt }, lifecycle: nextProjection }),
    } });
    await tx.controlledDocumentChange.create({ data: {
      documentId, revisionId, action: documentHistoryActions.manual, changedByText: principal.name,
      reason: input.reason,
      oldValue: json({ status: revision.status, revisionCode: revision.revisionCode }),
      newValue: json({ status: updated.status, revisionCode: revision.revisionCode,
        mode: "MANUAL", decisionId: decision.id, effectiveFrom: iso(nextProjection.effectiveFrom), reviewDueAt: iso(nextProjection.reviewDueAt) }),
    } });
    return decision;
  }, { timeout: 30_000 });
}

import { indexMetadata } from "./import/domain";
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/db";
import { MasterInput, RevisionInput, validateDepartmentForBaseCode, validateExistingRevision, validateRevisionDates } from "./domain";
const nullable = (v: string) => v || null;
const date = (v: string) => v ? new Date(`${v}T00:00:00Z`) : null;
const snapshot = (m: {
    baseCode: string | null;
    title: string | null;
    departmentCodeSnapshot: string | null;
    departmentNameSnapshot: string | null;
}) => ({ baseCodeSnapshot: m.baseCode, titleSnapshot: m.title, departmentCodeSnapshot: m.departmentCodeSnapshot, departmentNameSnapshot: m.departmentNameSnapshot });
async function history(tx: Prisma.TransactionClient, documentId: string, revisionId: string | null, action: string, actor: string, reason: string, oldValue: unknown, newValue: unknown) {
    await tx.controlledDocumentChange.create({ data: { documentId, revisionId, action, changedByText: actor, reason: reason || "Alta de borrador", oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : Prisma.JsonNull, newValue: JSON.parse(JSON.stringify(newValue)) } });
}
async function revisionData(tx: Prisma.TransactionClient, m: Awaited<ReturnType<typeof tx.controlledDocument.findUniqueOrThrow>>, v: RevisionInput | MasterInput, id?: string) {
    validateRevisionDates(v);
    if (v.existingDocument)
        validateExistingRevision(v);
    else if (v.obsoletedAt)
        throw new Error("Un borrador en elaboración no tiene fecha de obsolescencia.");
    if (v.previousRevisionId) {
        const previous = await tx.controlledDocumentRevision.findUnique({ where: { id: v.previousRevisionId } });
        if (!previous || previous.documentId !== m.id || previous.id === id || previous.revisionCode >= v.revisionCode)
            throw new Error("La revisión anterior debe pertenecer al mismo PNT y ser menor.");
    }
    return { ...snapshot(m), revisionCode: v.revisionCode, revisionReason: nullable(v.revisionReason), status: v.existingDocument ? v.existingStatus : "DRAFT" as const, effectiveFrom: date(v.effectiveFrom), reviewDueAt: date(v.reviewDueAt), obsoletedAt: date(v.obsoletedAt), previousRevisionId: nullable(v.previousRevisionId), sourceReference: nullable(v.sourceReference), verificationStatus: v.existingDocument ? "VERIFIED" as const : "UNVERIFIED" as const, verifiedByText: v.existingDocument ? v.actor : null, verifiedAt: v.existingDocument ? new Date() : null, consolidatedAt: v.existingDocument ? new Date() : null };
}
export async function saveMaster(v: MasterInput, id?: string, db: PrismaClient = prisma) {
    return db.$transaction(async (tx) => {
        if (id)
            await tx.$queryRaw `SELECT id FROM "ControlledDocument" WHERE id = ${id} FOR UPDATE`;
        const old = id ? await tx.controlledDocument.findUniqueOrThrow({ where: { id }, include: { revisions: true } }) : null;
        if (old?.administrativeStatus === "ANNULLED")
            throw new Error("El maestro anulado no admite cambios.");
        if (old && old.updatedAt.toISOString() !== v.updatedAt)
            throw new Error("El registro ha cambiado. Recarga antes de guardar.");
        if (old && indexMetadata(old.sourceMetadata) && old.baseCode !== v.baseCode)
            throw new Error("El código de un maestro importado es permanente.");
        if (old?.administrativeStatus === "ACTIVE" && old.baseCode !== v.baseCode)
            throw new Error("El código de un maestro registrado es permanente.");
        if (old?.revisions.some(r => r.consolidatedAt) && old.baseCode !== v.baseCode)
            throw new Error("El código con revisiones consolidadas es permanente.");
        const department = v.departmentId ? await tx.department.findUnique({ where: { id: v.departmentId } }) : null;
        if (v.departmentId && !department)
            throw new Error("El departamento no existe.");
        if (department && !department.isActive && old?.departmentId !== department.id && !(!old && v.existingDocument && v.verified && v.sourceReference))
            throw new Error("Un departamento inactivo requiere documentación histórica verificada.");
        const same = !!old && old.departmentId === (department?.id || null);
        const departmentCode = same ? old!.departmentCodeSnapshot : department?.code;
        if (v.baseCode && departmentCode)
            validateDepartmentForBaseCode(v.baseCode, departmentCode);
        const active = v.operation === "REGISTER" || old?.administrativeStatus === "ACTIVE";
        if (active && (!v.baseCode || !v.title || !department))
            throw new Error("El registro requiere código, título y departamento.");
        if (v.existingDocument && (!active || !v.revisionCode))
            throw new Error("Indica la revisión documental explícita y registra el maestro completo.");
        const data = { baseCode: nullable(v.baseCode), title: nullable(v.title), departmentId: department?.id || null, departmentCodeSnapshot: same ? old!.departmentCodeSnapshot : department?.code || null, departmentNameSnapshot: same ? old!.departmentNameSnapshot : department?.name || null, observations: nullable(v.observations), administrativeStatus: active ? "ACTIVE" as const : "DRAFT" as const };
        const m = old ? await tx.controlledDocument.update({ where: { id }, data }) : await tx.controlledDocument.create({ data: { ...data, createdByText: v.actor } });
        await history(tx, m.id, null, old ? "Cambio del maestro" : "Alta del maestro", v.actor, v.changeReason, old ? { baseCode: old.baseCode, title: old.title, departmentCodeSnapshot: old.departmentCodeSnapshot, departmentNameSnapshot: old.departmentNameSnapshot, observations: old.observations, administrativeStatus: old.administrativeStatus } : null, data);
        if (!old && v.revisionCode) {
            const r = await tx.controlledDocumentRevision.create({ data: { ...await revisionData(tx, m, v), documentId: m.id, registeredByText: v.actor } });
            await history(tx, m.id, r.id, "Registro de revisión", v.actor, v.changeReason, null, r);
        }
        return m.id;
    });
}
export async function saveRevision(documentId: string, v: RevisionInput, id?: string, db: PrismaClient = prisma) {
    return db.$transaction(async (tx) => {
        await tx.$queryRaw `SELECT id FROM "ControlledDocument" WHERE id = ${documentId} FOR UPDATE`;
        const m = await tx.controlledDocument.findUniqueOrThrow({ where: { id: documentId } });
        if (m.administrativeStatus !== "ACTIVE")
            throw new Error("Registra primero el maestro activo.");
        const old = id ? await tx.controlledDocumentRevision.findUniqueOrThrow({ where: { id } }) : null;
        if (old && (old.documentId !== documentId || old.consolidatedAt || old.status !== "DRAFT"))
            throw new Error("La revisión consolidada no admite edición.");
        if (old && old.updatedAt.toISOString() !== v.updatedAt)
            throw new Error("La revisión ha cambiado. Recarga antes de guardar.");
        const data = await revisionData(tx, m, v, id);
        const r = old ? await tx.controlledDocumentRevision.update({ where: { id }, data }) : await tx.controlledDocumentRevision.create({ data: { ...data, documentId, registeredByText: v.actor } });
        await tx.controlledDocument.update({ where: { id: documentId }, data: { updatedAt: new Date() } });
        await history(tx, documentId, r.id, old ? "Cambio de revisión en elaboración" : "Registro de revisión", v.actor, v.changeReason, old, r);
        return r.id;
    });
}

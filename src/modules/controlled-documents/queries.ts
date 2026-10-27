import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/db";
import { administrativeLabels, revisionLabels, validRevisionCode, validDate, iso } from "./domain";
export type Filters = {
    q?: string;
    department?: string;
    state?: string;
    revision?: string;
    revisionState?: string;
    validity?: string;
    effectiveFromStart?: string;
    effectiveFromEnd?: string;
    reviewDueStart?: string;
    reviewDueEnd?: string;
    assigned?: string;
    page?: string;
};
const dateRanges = [
    { start: "effectiveFromStart", end: "effectiveFromEnd", field: "effectiveFrom", label: "vigencia" },
    { start: "reviewDueStart", end: "reviewDueEnd", field: "reviewDueAt", label: "próxima revisión" },
] as const;

export function dateFilterErrors(f: Filters): string[] {
    const errors: string[] = [];
    for (const range of dateRanges) {
        const start = f[range.start], end = f[range.end];
        if (start && !validDate(start)) errors.push(`Fecha «desde» de ${range.label} no válida.`);
        if (end && !validDate(end)) errors.push(`Fecha «hasta» de ${range.label} no válida.`);
        if (start && end && validDate(start) && validDate(end) && start > end)
            errors.push(`En ${range.label}, «desde» no puede ser posterior a «hasta».`);
    }
    return errors;
}

export function listRevisionWhere(f: Filters): Prisma.ControlledDocumentRevisionWhereInput {
    // No matches for invalid/inverted dates; never silently ignore a restrictive filter.
    if (dateFilterErrors(f).length) return { id: { in: [] } };
    const r: Prisma.ControlledDocumentRevisionWhereInput = {};
    const conditions: Prisma.ControlledDocumentRevisionWhereInput[] = [];
    if (typeof f.revision === "string" && f.revision && validRevisionCode(f.revision))
        r.revisionCode = f.revision;
    if (typeof f.revisionState === "string" && f.revisionState && Object.hasOwn(revisionLabels, f.revisionState))
        r.status = f.revisionState as keyof typeof revisionLabels;
    const today = new Date(`${iso(new Date())}T00:00:00Z`);
    if (f.validity === "current" || f.validity === "due") {
        // A "Vigente" plazo filter must not silently override a selected state.
        conditions.push({ status: "IN_FORCE" });
        const dateField = f.validity === "current" ? "effectiveFrom" : "reviewDueAt";
        conditions.push({ OR: [
            { lifecycle: { is: { [dateField]: { lte: today } } } },
            { lifecycle: { is: null }, [dateField]: { lte: today } },
        ] });
    }
    if (f.validity === "missing")
        conditions.push({ OR: [
            { lifecycle: { is: { OR: [{ effectiveFrom: null }, { reviewDueAt: null }] } } },
            { lifecycle: { is: null }, OR: [{ effectiveFrom: null }, { reviewDueAt: null }] },
        ] });
    for (const range of dateRanges) {
        const start = f[range.start], end = f[range.end];
        if (!start && !end) continue;
        // The upper bound is exclusive of midnight the following day, so "hasta" includes the whole date.
        const bounds: Prisma.DateTimeFilter = {};
        if (start) bounds.gte = new Date(`${start}T00:00:00Z`);
        if (end) bounds.lt = new Date(Date.parse(`${end}T00:00:00Z`) + 86400000);
        const field = range.field;
        conditions.push({ OR: [
            { lifecycle: { is: { [field]: bounds } } },
            { lifecycle: { is: null }, [field]: bounds },
        ] });
    }
    if (conditions.length) r.AND = conditions;
    return r;
}
export function listWhere(f: Filters): Prisma.ControlledDocumentWhereInput {
    const AND: Prisma.ControlledDocumentWhereInput[] = [];
    if (typeof f.q === "string" && f.q.trim()) {
        const q = f.q.trim().slice(0, 500);
        AND.push({ OR: [{ baseCode: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }, { departmentNameSnapshot: { contains: q, mode: "insensitive" } }, { revisions: { some: { sourceReference: { contains: q, mode: "insensitive" } } } }] });
    }
    if (typeof f.department === "string" && f.department)
        AND.push({ departmentId: f.department });
    if (typeof f.state === "string" && f.state && Object.hasOwn(administrativeLabels, f.state))
        AND.push({ administrativeStatus: f.state as keyof typeof administrativeLabels });
    const r = listRevisionWhere(f);
    if (Object.keys(r).length)
        AND.push({ revisions: { some: r } });
    return { AND };
}
export async function listDocuments(f: Filters, db: PrismaClient = prisma) {
    const where = listWhere(f);
    const revisionWhere = listRevisionWhere(f);
    const count = await db.controlledDocument.count({ where });
    const pages = Math.max(1, Math.ceil(count / 25));
    const page = Math.min(pages, Math.max(1, Number.parseInt(f.page || "1", 10) || 1));
    const rows = await db.controlledDocument.findMany({ where, skip: (page - 1) * 25, take: 25, orderBy: [{ baseCode: "asc" }, { id: "asc" }], include: { revisions: { ...(Object.keys(revisionWhere).length ? { where: revisionWhere } : {}), orderBy: { revisionCode: "desc" }, select: { id: true, revisionCode: true, status: true, effectiveFrom: true, reviewDueAt: true, sourceMetadata: true, verificationStatus: true, lifecycle: { select: { effectiveFrom: true, reviewDueAt: true } } } } } });
    return { rows, count, page, pages };
}

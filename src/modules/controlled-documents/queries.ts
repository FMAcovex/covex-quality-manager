import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/db";
import { administrativeLabels, revisionLabels, validRevisionCode, iso } from "./domain";
export type Filters = {
    q?: string;
    department?: string;
    state?: string;
    revision?: string;
    revisionState?: string;
    validity?: string;
    page?: string;
};
export function listRevisionWhere(f: Filters): Prisma.ControlledDocumentRevisionWhereInput {
    const r: Prisma.ControlledDocumentRevisionWhereInput = {};
    if (typeof f.revision === "string" && f.revision && validRevisionCode(f.revision))
        r.revisionCode = f.revision;
    if (typeof f.revisionState === "string" && f.revisionState && Object.hasOwn(revisionLabels, f.revisionState))
        r.status = f.revisionState as keyof typeof revisionLabels;
    const today = new Date(`${iso(new Date())}T00:00:00Z`);
    if (f.validity === "current" || f.validity === "due") {
        // Preserve the selected documentary state; contradictory combinations match nothing.
        r.AND = [{ status: "IN_FORCE" }];
        const dateField = f.validity === "current" ? "effectiveFrom" : "reviewDueAt";
        r.OR = [{ lifecycle: { is: { [dateField]: { lte: today } } } },
            { lifecycle: { is: null }, [dateField]: { lte: today } }];
    }
    if (f.validity === "missing")
        r.OR = [{ lifecycle: { is: { OR: [{ effectiveFrom: null }, { reviewDueAt: null }] } } },
            { lifecycle: { is: null }, OR: [{ effectiveFrom: null }, { reviewDueAt: null }] }];
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

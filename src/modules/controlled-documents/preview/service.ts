import { importDb as prisma } from "../import/database";
import { parseIndex } from "./analysis";
import { reconcileIndex, type ExistingDepartment, type ExistingDocument } from "./reconciliation";
export type PreviewReader = {
    departments: () => Promise<ExistingDepartment[]>;
    documents: (codes: string[]) => Promise<ExistingDocument[]>;
};
export const databaseReader: PreviewReader = {
    departments: () => prisma.department.findMany({ select: { id: true, code: true, isActive: true } }),
    documents: codes => prisma.controlledDocument.findMany({ where: { baseCode: { in: codes } }, select: { id: true, baseCode: true, title: true, departmentId: true, departmentCodeSnapshot: true, administrativeStatus: true, documentType: true, revisions: { select: { id: true, revisionCode: true, titleSnapshot: true, departmentCodeSnapshot: true, effectiveFrom: true, reviewDueAt: true, verificationStatus: true, status: true, consolidatedAt: true, sourceMetadata: true } } } })
};
export async function previewIndex(buffer: Buffer, fileName: string, reader: PreviewReader = databaseReader, asOf?: string) {
    const report = parseIndex(buffer, fileName, asOf);
    const codes = [...new Set(report.rows.filter(r => r.classification === "PNT").map(r => r.identityKey!))];
    const [departments, documents] = await Promise.all([reader.departments(), (async () => {
            const result: ExistingDocument[] = [];
            for (let i = 0; i < codes.length; i += 500)
                result.push(...await reader.documents(codes.slice(i, i + 500)));
            return result;
        })()]);
    return reconcileIndex(report, departments, documents);
}

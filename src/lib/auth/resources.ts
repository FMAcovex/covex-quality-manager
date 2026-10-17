import { prisma } from "../db";
import { AccessError, type AccessModule } from "./context";
import type { ResourceScope } from "./policy";

const models = { DEVIATION: "deviation", CAPA: "capa", CHANGE_CONTROL: "changeControl", COMPLAINT: "complaint", RETURN: "returnRecord", AUDIT: "audit", OOS: "oosRecord", PNT: "controlledDocument" } as const;
type Delegate = { findUnique(args: object): Promise<Record<string, unknown> | null> };
export async function resourceScope(accessModule: AccessModule, id?: string | null, kind = "RECORD", client = prisma): Promise<ResourceScope> {
  if (!id) return {};
  if (kind === "AUDIT_PLAN") {
    const plan = await client.auditAnnualPlan.findUnique({ where: { id }, select: { id: true } });
    return plan ? { id: plan.id } : {};
  }
  if (accessModule === "SYSTEM") return {};
  const row = await (client as unknown as Record<string, Delegate>)[models[accessModule]].findUnique({ where: { id }, select: accessModule === "PNT" ? { id: true, departmentId: true } : accessModule === "AUDIT" ? { qmsRecordId: true, codingDepartmentId: true, departments: { where: { isActive: true }, select: { departmentId: true } } } : { qmsRecordId: true, departmentId: true } });
  if (!row) return {};
  const departments = accessModule === "AUDIT" ? [...(row.codingDepartmentId ? [String(row.codingDepartmentId)] : []), ...(row.departments as { departmentId: string }[]).map(d => d.departmentId)] : row.departmentId ? [String(row.departmentId)] : [];
  return { id: String(accessModule === "PNT" ? row.id : row.qmsRecordId), departmentIds: [...new Set(departments)] };
}
export async function qmsScope(id: string, client = prisma) {
  const row = await client.qmsRecord.findUnique({ where: { id }, select: { recordType: true } });
  if (!row) throw new AccessError(403);
  const accessModule = row.recordType as AccessModule;
  const entity = await (client as unknown as Record<string, Delegate>)[models[accessModule as keyof typeof models]].findUnique({ where: { qmsRecordId: id }, select: { id: true } });
  if (!entity) throw new AccessError(403); return { module: accessModule, scope: await resourceScope(accessModule, String(entity.id), "RECORD", client) };
}
export async function reviewScope(input: Record<string, unknown>) {
  if (input.reviewThreadId) {
    const thread = await prisma.reviewThread.findUnique({ where: { id: String(input.reviewThreadId) }, select: { qmsRecordId: true } });
    if (!thread || (input.qmsRecordId && input.qmsRecordId !== thread.qmsRecordId)) throw new AccessError(403);
    return qmsScope(thread.qmsRecordId);
  }
  return qmsScope(String(input.qmsRecordId ?? ""));
}

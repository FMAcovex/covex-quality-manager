import "server-only";
import { prisma } from "@/lib/db";
import { pendingAuditAction, pendingChangeTask, pendingComplaintCapaPlan, pendingDeviationCapaPlan } from "@/lib/qms/assigned";
import { classifyDue, utcDay, type DashboardFilters, type DashboardModule } from "./domain";

export type AssignedItem = {
  key: string;
  module: DashboardModule;
  code: string;
  label: string;
  detail: string;
  dueDate: Date | null;
  state: "OVERDUE" | "UPCOMING" | "PENDING";
  href: string;
};

const code = (value: string | null | undefined) => value ?? "Sin código";
const short = (value: string | null | undefined) => {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 120 ? text.slice(0, 117) + "…" : text;
};

/** Orden: vencidas y próximas por fecha; después las que no tienen fecha. */
export function sortAssigned(items: AssignedItem[]) {
  return [...items].sort((a, b) =>
    (a.dueDate ? 0 : 1) - (b.dueDate ? 0 : 1) ||
    (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0) ||
    a.code.localeCompare(b.code, "es") || a.key.localeCompare(b.key));
}

/**
 * Acciones pendientes asignadas al usuario (D-102), con los filtros de año, departamento y
 * módulo del panel. Misma definición de pendiente que el filtro de los listados.
 */
export async function getAssignedItems(userId: string | null | undefined, filters: Pick<DashboardFilters, "year" | "department" | "module" | "asOf">) {
  if (!userId) return [];
  const today = utcDay(filters.asOf);
  const qms = { isActive: true, ...(filters.year ? { year: filters.year } : {}) };
  const dep = filters.department ? { departmentId: filters.department } : {};
  const wants = (module: DashboardModule) => filters.module === "ALL" || filters.module === module;
  const item = (input: Omit<AssignedItem, "state" | "dueDate"> & { dueDate: Date | null }): AssignedItem => {
    const dueDate = input.dueDate ? utcDay(input.dueDate) : null;
    return { ...input, dueDate, state: (dueDate && classifyDue(dueDate, today)) || "PENDING" };
  };
  const recordRef = { select: { id: true, qmsRecord: { select: { businessCode: true } } } } as const;

  const [deviationPlans, capaActions, decisions, followups, tasks, complaintPlans, derived, auditActions] = await Promise.all([
    wants("DEVIATION") ? prisma.deviationCapaPlan.findMany({
      where: { ...pendingDeviationCapaPlan(userId), deviation: { status: { not: "CLOSED" }, qmsRecord: qms, ...dep } },
      select: { id: true, description: true, plannedExecutionDate: true, deviation: recordRef },
    }) : [],
    wants("CAPA") ? prisma.capaPlannedAction.findMany({
      where: { responsibleUserId: userId, capa: { status: { in: ["DRAFT", "OPEN"] }, qmsRecord: qms, ...dep } },
      select: { id: true, description: true, plannedExecutionDate: true, capa: recordRef },
    }) : [],
    wants("CHANGE_CONTROL") ? prisma.changeControl.findMany({
      where: { requestDecisionResponsibleUserId: userId, requestDecision: "PENDING", finalStatus: { not: "CLOSED" }, qmsRecord: qms, ...dep },
      select: { id: true, description: true, qmsRecord: { select: { businessCode: true } } },
    }) : [],
    wants("CHANGE_CONTROL") ? prisma.changeControl.findMany({
      where: { followupResponsibleUserId: userId, dictamenResult: "APPROVED", finalStatus: { not: "CLOSED" }, qmsRecord: qms, ...dep },
      select: {
        id: true, description: true, qmsRecord: { select: { businessCode: true } },
        followups: { orderBy: [{ sequenceNumber: "desc" }], take: 1, select: { nextFollowupDate: true } },
      },
    }) : [],
    wants("CHANGE_CONTROL") ? prisma.changeControlTask.findMany({
      where: { ...pendingChangeTask(userId), changeControl: { finalStatus: { not: "CLOSED" }, qmsRecord: qms, ...dep } },
      select: { id: true, description: true, plannedDate: true, changeControl: recordRef },
    }) : [],
    wants("COMPLAINT") ? prisma.complaintCapaPlan.findMany({
      where: { ...pendingComplaintCapaPlan(userId), complaint: { status: { not: "CLOSED" }, qmsRecord: qms, ...dep } },
      select: { id: true, description: true, plannedExecutionDate: true, complaint: recordRef },
    }) : [],
    wants("COMPLAINT") ? prisma.complaintDerivedAction.findMany({
      where: { responsibleUserId: userId, complaint: { status: { not: "CLOSED" }, qmsRecord: qms, ...dep } },
      select: { id: true, actionType: true, description: true, plannedExecutionDate: true, complaint: recordRef },
    }) : [],
    wants("AUDIT") ? prisma.auditFindingAction.findMany({
      where: {
        ...pendingAuditAction(userId),
        finding: { isActive: true, audit: { qmsRecord: qms, ...(filters.department ? { departments: { some: { departmentId: filters.department, isActive: true } } } : {}) } },
      },
      select: { id: true, description: true, targetDate: true, finding: { select: { reference: true, audit: recordRef } } },
    }) : [],
  ]);

  return sortAssigned([
    ...deviationPlans.map((row) => item({ key: "DEV-CAPA-" + row.id, module: "DEVIATION", code: code(row.deviation.qmsRecord.businessCode), label: "CAPA propuesta sin crear", detail: short(row.description), dueDate: row.plannedExecutionDate, href: "/deviations/" + row.deviation.id + "?tab=deviation#desviacion-acciones" })),
    ...capaActions.map((row) => item({ key: "CAPA-A-" + row.id, module: "CAPA", code: code(row.capa.qmsRecord.businessCode), label: "Acción propuesta", detail: short(row.description), dueDate: row.plannedExecutionDate, href: "/capa/" + row.capa.id })),
    ...decisions.map((row) => item({ key: "CC-DEC-" + row.id, module: "CHANGE_CONTROL", code: code(row.qmsRecord.businessCode), label: "Decisión de la solicitud pendiente", detail: short(row.description), dueDate: null, href: "/changes/" + row.id })),
    ...followups.map((row) => item({ key: "CC-SEG-" + row.id, module: "CHANGE_CONTROL", code: code(row.qmsRecord.businessCode), label: "Seguimiento del cambio", detail: short(row.description), dueDate: row.followups[0]?.nextFollowupDate ?? null, href: "/changes/" + row.id + "?tab=followups" })),
    ...tasks.map((row) => item({ key: "CC-T-" + row.id, module: "CHANGE_CONTROL", code: code(row.changeControl.qmsRecord.businessCode), label: "Acción del plan", detail: short(row.description), dueDate: row.plannedDate, href: "/changes/" + row.changeControl.id })),
    ...complaintPlans.map((row) => item({ key: "REC-CAPA-" + row.id, module: "COMPLAINT", code: code(row.complaint.qmsRecord.businessCode), label: "CAPA propuesta sin crear", detail: short(row.description), dueDate: row.plannedExecutionDate, href: "/complaints/" + row.complaint.id })),
    ...derived.map((row) => item({ key: "REC-D-" + row.id, module: "COMPLAINT", code: code(row.complaint.qmsRecord.businessCode), label: row.actionType === "RETURN" ? "Devolución propuesta" : "Acción derivada", detail: short(row.description), dueDate: row.plannedExecutionDate, href: "/complaints/" + row.complaint.id })),
    ...auditActions.map((row) => item({ key: "AUD-A-" + row.id, module: "AUDIT", code: code(row.finding.audit.qmsRecord.businessCode), label: "Acción del hallazgo " + row.finding.reference, detail: short(row.description), dueDate: row.targetDate, href: "/audits/" + row.finding.audit.id + "?tab=findings#audit-action-" + row.id })),
  ]);
}

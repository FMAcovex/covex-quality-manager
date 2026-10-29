import "server-only";
import { prisma } from "@/lib/db";
import { pendingAuditAction, pendingChangeTask, pendingComplaintCapaPlan, pendingDeviationCapaPlan, pendingPntPeriodicReview, pendingPntRevision } from "@/lib/qms/assigned";
import { currentRevisionFunction } from "@/modules/controlled-documents/assignment-functions";
import { operationalDates } from "@/modules/controlled-documents/listing";
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
 * módulo del panel. Misma definición de pendiente que el filtro de los listados. Los PNT no
 * tienen año: solo se filtran por departamento.
 */
export async function getAssignedItems(userId: string | null | undefined, filters: Pick<DashboardFilters, "year" | "department" | "module" | "asOf">) {
  if (!userId) return [];
  return collectActionItems(userId, filters);
}

/**
 * Calendario (D-120): las mismas acciones pendientes que «Mis tareas», de cualquier responsable
 * (con usuario vinculado, solo con nombre escrito o sin responsable) y con fecha prevista en [from, to). No incluye
 * lo que no tiene fecha ni lo que el calendario toma de las reglas del panel (seguimientos y
 * revisión de PNT vigentes).
 */
export async function getDatedActionItems(filters: Pick<DashboardFilters, "department" | "module" | "asOf">, range: { from: Date; to: Date }) {
  return (await collectActionItems(undefined, { ...filters, year: null }, range)).filter(item => item.dueDate && item.dueDate >= range.from && item.dueDate < range.to);
}

type ActionFilters = Pick<DashboardFilters, "year" | "department" | "module" | "asOf">;

// Sin usuario, Prisma ignora `responsibleUserId: undefined`: mismas reglas de pendiente para todos.
async function collectActionItems(userId: string | undefined, filters: ActionFilters, range?: { from: Date; to: Date }) {
  const today = utcDay(filters.asOf);
  const qms = { isActive: true, ...(filters.year ? { year: filters.year } : {}) };
  const dep = filters.department ? { departmentId: filters.department } : {};
  const wants = (module: DashboardModule) => filters.module === "ALL" || filters.module === module;
  const item = (input: Omit<AssignedItem, "state" | "dueDate"> & { dueDate: Date | null }): AssignedItem => {
    const dueDate = input.dueDate ? utcDay(input.dueDate) : null;
    return { ...input, dueDate, state: (dueDate && classifyDue(dueDate, today)) || "PENDING" };
  };
  const recordRef = { select: { id: true, qmsRecord: { select: { businessCode: true } } } } as const;

  const pntDoc = { administrativeStatus: { not: "ANNULLED" as const }, ...dep };
  const all = !userId;
  const within = range ? { gte: range.from, lt: range.to } : undefined;

  const [deviationPlans, capaActions, decisions, followups, tasks, complaintPlans, derived, auditActions, pntRevisions, pntPeriodic] = await Promise.all([
    wants("DEVIATION") ? prisma.deviationCapaPlan.findMany({
      where: { ...pendingDeviationCapaPlan(userId), plannedExecutionDate: within, deviation: { status: { not: "CLOSED" }, qmsRecord: qms, ...dep } },
      select: { id: true, description: true, plannedExecutionDate: true, deviation: recordRef },
    }) : [],
    wants("CAPA") ? prisma.capaPlannedAction.findMany({
      where: { responsibleUserId: userId, plannedExecutionDate: within, capa: { status: { in: ["DRAFT", "OPEN"] }, qmsRecord: qms, ...dep } },
      select: { id: true, description: true, plannedExecutionDate: true, capa: recordRef },
    }) : [],
    wants("CHANGE_CONTROL") && !all ? prisma.changeControl.findMany({
      where: { requestDecisionResponsibleUserId: userId, requestDecision: "PENDING", finalStatus: { not: "CLOSED" }, qmsRecord: qms, ...dep },
      select: { id: true, description: true, qmsRecord: { select: { businessCode: true } } },
    }) : [],
    wants("CHANGE_CONTROL") && !all ? prisma.changeControl.findMany({
      where: { followupResponsibleUserId: userId, dictamenResult: "APPROVED", finalStatus: { not: "CLOSED" }, qmsRecord: qms, ...dep },
      select: {
        id: true, description: true, qmsRecord: { select: { businessCode: true } },
        followups: { orderBy: [{ sequenceNumber: "desc" }], take: 1, select: { nextFollowupDate: true } },
      },
    }) : [],
    wants("CHANGE_CONTROL") ? prisma.changeControlTask.findMany({
      where: { ...pendingChangeTask(userId), plannedDate: within, changeControl: { finalStatus: { not: "CLOSED" }, qmsRecord: qms, ...dep } },
      select: { id: true, description: true, plannedDate: true, changeControl: recordRef },
    }) : [],
    wants("COMPLAINT") ? prisma.complaintCapaPlan.findMany({
      where: { ...pendingComplaintCapaPlan(userId), plannedExecutionDate: within, complaint: { status: { not: "CLOSED" }, qmsRecord: qms, ...dep } },
      select: { id: true, description: true, plannedExecutionDate: true, complaint: recordRef },
    }) : [],
    wants("COMPLAINT") ? prisma.complaintDerivedAction.findMany({
      where: { responsibleUserId: userId, plannedExecutionDate: within, complaint: { status: { not: "CLOSED" }, qmsRecord: qms, ...dep } },
      select: { id: true, actionType: true, description: true, plannedExecutionDate: true, complaint: recordRef },
    }) : [],
    wants("AUDIT") ? prisma.auditFindingAction.findMany({
      where: {
        ...pendingAuditAction(userId),
        targetDate: within,
        finding: { isActive: true, audit: { qmsRecord: qms, ...(filters.department ? { departments: { some: { departmentId: filters.department, isActive: true } } } : {}) } },
      },
      select: { id: true, description: true, targetDate: true, finding: { select: { reference: true, audit: recordRef } } },
    }) : [],
    wants("PNT") ? prisma.controlledDocumentRevision.findMany({
      where: { ...pendingPntRevision(userId), document: pntDoc, ...(within ? { AND: [{ OR: [{ preparationTargetDate: within }, { reviewTargetDate: within }, { approvalTargetDate: within }] }] } : {}) },
      select: {
        id: true, revisionCode: true, status: true, titleSnapshot: true, baseCodeSnapshot: true,
        preparationTargetDate: true, reviewTargetDate: true, approvalTargetDate: true,
        document: { select: { id: true, baseCode: true, title: true } },
      },
    }) : [],
    wants("PNT") && !all ? prisma.controlledDocument.findMany({
      where: { ...pntDoc, ...pendingPntPeriodicReview(userId ?? "", today) },
      select: {
        id: true, baseCode: true, title: true,
        revisions: {
          where: { status: "IN_FORCE" }, orderBy: [{ revisionCode: "desc" }, { id: "desc" }], take: 1,
          select: { revisionCode: true, effectiveFrom: true, reviewDueAt: true, lifecycle: { select: { effectiveFrom: true, reviewDueAt: true } } },
        },
      },
    }) : [],
  ]);
  const pntItems: AssignedItem[] = [];
  for (const row of pntRevisions) {
    const fn = currentRevisionFunction(row.status);
    if (!fn) continue;
    pntItems.push(item({ key: "PNT-" + fn.key + "-" + row.id, module: "PNT", code: code(row.baseCodeSnapshot ?? row.document.baseCode) + "/" + row.revisionCode, label: fn.task + " la revisión " + row.revisionCode, detail: short(row.titleSnapshot ?? row.document.title), dueDate: row[`${fn.key}TargetDate`], href: "/controlled-documents/" + row.document.id + "?tab=revisions" }));
  }
  for (const doc of pntPeriodic) {
    const revision = doc.revisions[0];
    const due = revision && operationalDates(revision).reviewDueAt;
    if (!due) continue;
    const dueDate = new Date(due + "T00:00:00.000Z");
    if (!classifyDue(dueDate, today)) continue;
    pntItems.push(item({ key: "PNT-P-" + doc.id, module: "PNT", code: code(doc.baseCode), label: "Revisión periódica (vigente " + revision.revisionCode + ")", detail: short(doc.title), dueDate, href: "/controlled-documents/" + doc.id }));
  }

  return sortAssigned([
    ...deviationPlans.map((row) => item({ key: "DEV-CAPA-" + row.id, module: "DEVIATION", code: code(row.deviation.qmsRecord.businessCode), label: "CAPA propuesta sin crear", detail: short(row.description), dueDate: row.plannedExecutionDate, href: "/deviations/" + row.deviation.id + "?tab=deviation#desviacion-acciones" })),
    ...capaActions.map((row) => item({ key: "CAPA-A-" + row.id, module: "CAPA", code: code(row.capa.qmsRecord.businessCode), label: "Acción propuesta", detail: short(row.description), dueDate: row.plannedExecutionDate, href: "/capa/" + row.capa.id })),
    ...decisions.map((row) => item({ key: "CC-DEC-" + row.id, module: "CHANGE_CONTROL", code: code(row.qmsRecord.businessCode), label: "Decisión de la solicitud pendiente", detail: short(row.description), dueDate: null, href: "/changes/" + row.id })),
    ...followups.map((row) => item({ key: "CC-SEG-" + row.id, module: "CHANGE_CONTROL", code: code(row.qmsRecord.businessCode), label: "Seguimiento del cambio", detail: short(row.description), dueDate: row.followups[0]?.nextFollowupDate ?? null, href: "/changes/" + row.id + "?tab=followups" })),
    ...tasks.map((row) => item({ key: "CC-T-" + row.id, module: "CHANGE_CONTROL", code: code(row.changeControl.qmsRecord.businessCode), label: "Acción del plan", detail: short(row.description), dueDate: row.plannedDate, href: "/changes/" + row.changeControl.id })),
    ...complaintPlans.map((row) => item({ key: "REC-CAPA-" + row.id, module: "COMPLAINT", code: code(row.complaint.qmsRecord.businessCode), label: "CAPA propuesta sin crear", detail: short(row.description), dueDate: row.plannedExecutionDate, href: "/complaints/" + row.complaint.id })),
    ...derived.map((row) => item({ key: "REC-D-" + row.id, module: "COMPLAINT", code: code(row.complaint.qmsRecord.businessCode), label: row.actionType === "RETURN" ? "Devolución propuesta" : "Acción derivada", detail: short(row.description), dueDate: row.plannedExecutionDate, href: "/complaints/" + row.complaint.id })),
    ...pntItems,
    ...auditActions.map((row) => item({ key: "AUD-A-" + row.id, module: "AUDIT", code: code(row.finding.audit.qmsRecord.businessCode), label: "Acción del hallazgo " + row.finding.reference, detail: short(row.description), dueDate: row.targetDate, href: "/audits/" + row.finding.audit.id + "?tab=findings#audit-action-" + row.id })),
  ]);
}

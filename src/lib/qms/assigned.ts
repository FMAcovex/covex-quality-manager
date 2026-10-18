import type { Prisma } from "@prisma/client";

/**
 * «Asignadas a mí» (D-102): expedientes con algo pendiente cuyo responsable vinculado (D-101) es
 * el usuario de la sesión. Lo mismo para el panel y para los listados.
 *
 * Qué cuenta como pendiente:
 * - Desviación no cerrada con una CAPA propuesta a su cargo aún sin crear (Propuesta).
 * - CAPA en borrador o abierta con una acción propuesta a su cargo.
 * - Control de cambios no cerrado: decisión de la solicitud pendiente a su cargo, seguimiento a su
 *   cargo con el Dictamen aprobado o una acción del plan a su cargo sin completar ni marcar No aplica.
 * - Reclamación no cerrada con una CAPA propuesta sin crear o una acción derivada a su cargo.
 * - Auditoría con una acción de hallazgo activa a su cargo abierta, en curso o pendiente de verificar.
 * Las acciones inmediatas de una desviación ya están ejecutadas y no cuentan.
 */
export const ASSIGNED_TO_ME = "me";
export const assignedFilterOptions = [{ value: ASSIGNED_TO_ME, label: "Asignadas a mí" }];
export const isAssignedToMe = (value: string | undefined | null) => value === ASSIGNED_TO_ME;

export const pendingAuditActionStatuses = ["OPEN", "IN_PROGRESS", "PENDING_VERIFICATION"] as const;
const doneTaskStates: Prisma.ChangeControlTaskStateWhereInput = { status: { in: ["COMPLETED", "NOT_APPLICABLE"] } };

export const pendingDeviationCapaPlan = (userId: string) => ({ responsibleUserId: userId, proposalStatus: "PROPOSED" }) satisfies Prisma.DeviationCapaPlanWhereInput;
export const pendingComplaintCapaPlan = (userId: string) => ({ responsibleUserId: userId, proposalStatus: "PROPOSED" }) satisfies Prisma.ComplaintCapaPlanWhereInput;
export const pendingChangeTask = (userId: string) => ({ responsibleUserId: userId, states: { none: doneTaskStates } }) satisfies Prisma.ChangeControlTaskWhereInput;
export const pendingAuditAction = (userId: string) => ({ responsibleUserId: userId, isActive: true, status: { in: [...pendingAuditActionStatuses] }, finding: { isActive: true } }) satisfies Prisma.AuditFindingActionWhereInput;

export const assignedWhere = {
  deviation: (userId: string): Prisma.DeviationWhereInput => ({
    status: { not: "CLOSED" },
    capaPlans: { some: pendingDeviationCapaPlan(userId) },
  }),
  capa: (userId: string): Prisma.CapaWhereInput => ({
    status: { in: ["DRAFT", "OPEN"] },
    plannedActions: { some: { responsibleUserId: userId } },
  }),
  changeControl: (userId: string): Prisma.ChangeControlWhereInput => ({
    finalStatus: { not: "CLOSED" },
    OR: [
      { requestDecision: "PENDING", requestDecisionResponsibleUserId: userId },
      { dictamenResult: "APPROVED", followupResponsibleUserId: userId },
      { tasks: { some: pendingChangeTask(userId) } },
    ],
  }),
  complaint: (userId: string): Prisma.ComplaintWhereInput => ({
    status: { not: "CLOSED" },
    OR: [
      { capaPlans: { some: pendingComplaintCapaPlan(userId) } },
      { derivedActions: { some: { responsibleUserId: userId } } },
    ],
  }),
  audit: (userId: string): Prisma.AuditWhereInput => ({
    findings: { some: { isActive: true, actions: { some: { responsibleUserId: userId, isActive: true, status: { in: [...pendingAuditActionStatuses] } } } } },
  }),
};

/**
 * Filtro del listado: sin usuario en sesión no hay nada asignado, así que no devuelve ningún
 * expediente en lugar de ignorar el filtro.
 */
export function assignedListWhere<T>(value: string | undefined | null, userId: string | null | undefined, build: (userId: string) => T): T | { id: { in: [] } } | null {
  if (!isAssignedToMe(value)) return null;
  return userId ? build(userId) : { id: { in: [] } };
}

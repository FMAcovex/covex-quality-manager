import type { ControlledDocumentRevisionStatus, Prisma } from "@prisma/client";
import { revisionFunctions } from "@/modules/controlled-documents/assignment-functions";

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
 * - PNT no anulado (D-118): revisión en la fase de la función que tiene a su cargo (Elabora en
 *   borrador, Revisa en revisión, Aprueba pendiente de aprobación), o revisión periódica a su cargo
 *   con la revisión vigente vencida o que vence en 30 días y sin otra revisión ya en curso.
 * Las acciones inmediatas de una desviación ya están ejecutadas y no cuentan.
 */
export const ASSIGNED_TO_ME = "me";
export const assignedFilterOptions = [{ value: ASSIGNED_TO_ME, label: "Asignadas a mí" }];
export const isAssignedToMe = (value: string | undefined | null) => value === ASSIGNED_TO_ME;

export const pendingAuditActionStatuses = ["OPEN", "IN_PROGRESS", "PENDING_VERIFICATION"] as const;
const doneTaskStates: Prisma.ChangeControlTaskStateWhereInput = { status: { in: ["COMPLETED", "NOT_APPLICABLE"] } };

// Con `userId` sin definir, Prisma no filtra por responsable: es la misma regla para todos (calendario, D-120).
export const pendingDeviationCapaPlan = (userId: string | undefined) => ({ responsibleUserId: userId, proposalStatus: "PROPOSED" }) satisfies Prisma.DeviationCapaPlanWhereInput;
export const pendingComplaintCapaPlan = (userId: string | undefined) => ({ responsibleUserId: userId, proposalStatus: "PROPOSED" }) satisfies Prisma.ComplaintCapaPlanWhereInput;
export const pendingChangeTask = (userId: string | undefined) => ({ responsibleUserId: userId, states: { none: doneTaskStates } }) satisfies Prisma.ChangeControlTaskWhereInput;
export const pendingAuditAction = (userId: string | undefined) => ({ responsibleUserId: userId, isActive: true, status: { in: [...pendingAuditActionStatuses] }, finding: { isActive: true } }) satisfies Prisma.AuditFindingActionWhereInput;

/** Revisiones que bloquean la tarea de revisión periódica: ya hay una nueva revisión en marcha. */
export const pntRevisionInProgressStatuses: ControlledDocumentRevisionStatus[] = ["DRAFT", "IN_REVIEW", "PENDING_APPROVAL", "APPROVED_PENDING_EFFECTIVE"];
export const pntPeriodicHorizonDays = 30;
const DAY = 86_400_000;

export const pendingPntRevision = (userId: string | undefined) => ({
  OR: revisionFunctions.map(f => ({ status: f.status, [`${f.key}ResponsibleUserId`]: userId })),
}) satisfies Prisma.ControlledDocumentRevisionWhereInput;

/** Revisión vigente cuya revisión prevista efectiva (la del ciclo de vida si existe) cae antes del límite. */
const inForceDueBefore = (limit: Date): Prisma.ControlledDocumentRevisionWhereInput => ({
  status: "IN_FORCE",
  OR: [{ lifecycle: { is: { reviewDueAt: { lt: limit } } } }, { lifecycle: { is: null }, reviewDueAt: { lt: limit } }],
});

/** `today` es el día UTC de referencia; el límite incluye el día 30 (como el panel). */
export const pendingPntPeriodicReview = (userId: string, today: Date) => ({
  periodicReviewResponsibleUserId: userId,
  revisions: {
    some: inForceDueBefore(new Date(today.getTime() + (pntPeriodicHorizonDays + 1) * DAY)),
    none: { status: { in: pntRevisionInProgressStatuses } },
  },
}) satisfies Prisma.ControlledDocumentWhereInput;

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
  pnt: (userId: string, today: Date): Prisma.ControlledDocumentWhereInput => ({
    administrativeStatus: { not: "ANNULLED" },
    OR: [
      { revisions: { some: pendingPntRevision(userId) } },
      pendingPntPeriodicReview(userId, today),
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

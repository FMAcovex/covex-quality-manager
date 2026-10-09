import { z } from "zod";
import type { ControlledDocumentRevisionStatus as State } from "@prisma/client";
import type { LifecyclePermission } from "./access";
import { documentHistoryActions } from "../documents/history";
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Fecha inválida.");
export const commandSchema = z.object({
  requestId: z.string().uuid(), expectedVersion: z.number().int().nonnegative(),
  operation: z.enum(["VERIFY", "REGISTER_EXTERNAL", "CONTRAST_EXTERNAL", "SUBMIT", "PLAN", "ACTIVATE", "RETIRE", "ANNUL", "RECTIFY"]),
  reason: z.string().trim().min(1).max(4000), notes: z.string().trim().min(1).max(8000),
  evidenceIds: z.array(z.string().uuid()).min(1).max(20).refine(v => new Set(v).size === v.length),
  result: z.enum(["FAVORABLE", "DISCREPANCY", "ACCEPTED", "INSUFFICIENT", "REJECTED"]).optional(),
  discrepancies: z.string().trim().max(8000).optional(), referenceBasis: z.string().trim().max(4000).optional(),
  function: z.enum(["PREPARATION", "REVIEW", "APPROVAL"]).optional(), externalPerson: z.string().trim().min(1).max(200).optional(),
  responsibility: z.string().trim().min(1).max(1000).optional(), authorityBasis: z.string().trim().min(1).max(4000).optional(),
  accreditedDate: date.optional(), registrationId: z.string().uuid().optional(), rectifiesId: z.string().uuid().optional(),
  effectiveFrom: date.optional(), reviewDueAt: date.optional(), finalDocumentId: z.string().uuid().optional(),
  previousRevisionId: z.string().uuid().nullable().optional(), separationConfirmed: z.boolean().optional(),
}).strict();
export type LifecycleCommand = z.infer<typeof commandSchema>;
export const permissions: Record<LifecycleCommand["operation"], LifecyclePermission> = {
  VERIFY: "verify", REGISTER_EXTERNAL: "record-approval", CONTRAST_EXTERNAL: "accept-approval", SUBMIT: "verify",
  PLAN: "accept-approval", ACTIVATE: "activate", RETIRE: "retire", ANNUL: "retire", RECTIFY: "correct",
};
export const lifecycleHistoryActions = { decision: documentHistoryActions.lifecycle } as const;
export function assertTransition(operation: LifecycleCommand["operation"], state: State, role?: string) {
  const allowed: Record<LifecycleCommand["operation"], State[]> = {
    VERIFY: ["IMPORTED_PENDING", "DRAFT", "IN_REVIEW"], REGISTER_EXTERNAL: role === "APPROVAL" ? ["PENDING_APPROVAL"] : ["IN_REVIEW"],
    CONTRAST_EXTERNAL: ["IN_REVIEW", "PENDING_APPROVAL"], SUBMIT: ["IN_REVIEW"], PLAN: ["PENDING_APPROVAL"],
    ACTIVATE: ["APPROVED_PENDING_EFFECTIVE"], RETIRE: ["IN_FORCE"], ANNUL: ["IMPORTED_PENDING", "DRAFT", "IN_REVIEW", "PENDING_APPROVAL", "APPROVED_PENDING_EFFECTIVE", "IN_FORCE"],
    RECTIFY: ["IMPORTED_PENDING", "DRAFT", "IN_REVIEW", "PENDING_APPROVAL", "APPROVED_PENDING_EFFECTIVE", "OBSOLETE", "ANNULLED"],
  };
  if (!allowed[operation].includes(state)) throw new Error("Transición no permitida; no se pueden eludir los requisitos documentales.");
}
export function normalizedPerson(name: string) { return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
export function plannedDates(approval: string, effective: string | undefined, due: string | undefined, today: string) {
  if (!effective || !due || approval > today || effective < approval || due <= effective) throw new Error("Fechas de aprobación, vigencia y revisión incoherentes.");
  const maximum = new Date(`${effective}T00:00:00Z`); maximum.setUTCFullYear(maximum.getUTCFullYear() + 5);
  if (due > maximum.toISOString().slice(0, 10)) throw new Error("La revisión prevista supera cinco años de vigencia (GC-00/001/03).");
}

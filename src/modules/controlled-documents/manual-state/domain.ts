import { z } from "zod";
import type { ControlledDocumentRevisionStatus } from "@prisma/client";

export const manualStates = ["DRAFT", "IN_REVIEW", "APPROVED_PENDING_EFFECTIVE", "IN_FORCE", "OBSOLETE"] as const;
export type ManualState = typeof manualStates[number];
export const manualStateLabels: Record<ManualState, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  APPROVED_PENDING_EFFECTIVE: "Aprobado",
  IN_FORCE: "Vigente",
  OBSOLETE: "Obsoleto",
};
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value =>
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
  "Fecha no válida.");
export const manualStatusSchema = z.object({
  requestId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  targetStatus: z.enum(manualStates),
  reason: z.string().trim().min(1, "Indica el motivo del cambio.").max(4000),
  effectiveFrom: isoDate.optional(),
  reviewDueAt: isoDate.optional(),
  previousRevisionId: z.string().uuid().nullable().optional(),
}).strict();
export type ManualStatusInput = z.infer<typeof manualStatusSchema>;
export function validateManualChange(current: ControlledDocumentRevisionStatus, input: ManualStatusInput, today: string) {
  if (current === "ANNULLED" || current === "OBSOLETE")
    throw new Error("Las revisiones anuladas u obsoletas son históricas. Registre una nueva revisión.");
  if (current === input.targetStatus) throw new Error("Seleccione un estado diferente del actual.");
  if (current === "IN_FORCE" && input.targetStatus !== "OBSOLETE")
    throw new Error("Una revisión vigente solo puede pasar a obsoleta; para cambiarla, cree otra revisión.");
  if (input.targetStatus === "IN_FORCE") {
    if (!input.effectiveFrom) throw new Error("Indique la fecha real de entrada en vigor.");
    if (input.effectiveFrom > today) throw new Error("Una fecha futura no puede registrarse como vigente.");
    if (input.reviewDueAt && input.reviewDueAt < input.effectiveFrom)
      throw new Error("La revisión prevista no puede ser anterior a la fecha de vigencia.");
  }
}

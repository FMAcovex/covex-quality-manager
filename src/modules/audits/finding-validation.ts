import { z } from "zod";
import { responsibleUserIdSchema } from "@/lib/qms/responsible-user";
const text = z.string().trim().max(20000).default("");
export const dateInput = z.string().refine(v => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v), "Fecha no válida.").default("");
const status = z.enum(["OPEN", "IN_PROGRESS", "PENDING_VERIFICATION", "CLOSED", "NOT_APPLICABLE"]);
const control = { actor: z.string().trim().min(1, "Indica quién registra el cambio.").max(200), changeReason: text, expectedUpdatedAt: z.string().optional() };
const treatmentFields = { closedAt: dateInput, evidence: text, evidenceReference: text, verificationComment: text };
function closureCheck(v: { status: string; closedAt: string; evidence: string; evidenceReference: string; verificationComment: string }, ctx: z.RefinementCtx) {
  if (v.status === "CLOSED") {
    if (!v.closedAt) ctx.addIssue({ code: "custom", path: ["closedAt"], message: "El cierre requiere fecha." });
    if (!v.evidence && !v.evidenceReference && !v.verificationComment) ctx.addIssue({ code: "custom", path: ["evidence"], message: "El cierre requiere evidencia, referencia o comentario de verificación." });
  }
}
export const findingInputSchema = z.object({
  ...control, findingType: z.enum(["FINDING", "RECOMMENDATION", "CLIENT_OBSERVATION", "AUTHORITY_OBSERVATION"]), criticality: z.enum(["CRITICAL", "MAJOR", "MINOR", "NA"]).default("NA"), description: z.string().trim().min(1, "Describe el hallazgo.").max(20000), criterionReference: text, objectiveEvidence: text, treatment: text, treatmentStatus: status.default("OPEN"), ...treatmentFields, sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
}).superRefine((v, ctx) => {
  closureCheck({ ...v, status: v.treatmentStatus }, ctx);
  if ((v.treatmentStatus === "CLOSED" || v.treatmentStatus === "NOT_APPLICABLE") && !v.treatment) ctx.addIssue({ code: "custom", path: ["treatment"], message: "Indica el tratamiento o justificación." });
});
export const findingActionInputSchema = z.object({ ...control, description: z.string().trim().min(1, "Describe la acción.").max(20000), responsible: text, responsibleUserId: z.string().default("").pipe(responsibleUserIdSchema), targetDate: dateInput, status: status.default("OPEN"), verificationResult: z.enum(["PENDING", "CONFORMING", "NONCONFORMING", "NA"]).optional(), verifiedAt: dateInput.optional(), verifiedBy: text.optional(), ...treatmentFields, sortOrder: z.coerce.number().int().min(0).max(100000).default(0) }).superRefine(closureCheck);
export const followupInputSchema = z.object({ ...control, findingId: z.union([z.string().uuid(), z.literal("")]).default(""), followupDate: dateInput.refine(Boolean, "Indica la fecha de seguimiento."), completedByText: z.string().trim().min(1, "Indica el responsable.").max(200), description: z.string().trim().min(1, "Describe el seguimiento.").max(20000), nextReviewDate: dateInput, evidenceReference: text });
export const retirementInputSchema = z.object({ actor: control.actor, reason: z.string().trim().min(1, "El motivo de retirada es obligatorio.").max(20000) });

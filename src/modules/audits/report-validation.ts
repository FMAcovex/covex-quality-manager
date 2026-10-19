import { z } from "zod";
import { dateInput } from "./finding-validation";
const text = z.string().trim().max(20000).default("");
export const reportTextFields = ["conclusion", "programme", "previousAuditBackground", "supplierType", "auditedContact", "planIntroduction", "activityDuration", "reportDistribution", "preparedBy", "preparedPosition", "reviewedBy", "reviewedPosition", "receivedBy", "receivedPosition", "closureEvidence", "supplierAssessment"] as const;
// D-110 (R5C1): las fechas del CAPA plan las fija «Establecer CAPA plan», no el formulario del informe.
export const reportDateFields = ["reportDate", "reportSentAt", "supplierResponseReceivedAt", "responseSentAt"] as const;
export const reportInputSchema = z.object({
  ...Object.fromEntries(reportTextFields.map(k => [k, text])) as Record<typeof reportTextFields[number], typeof text>,
  ...Object.fromEntries(reportDateFields.map(k => [k, dateInput])) as Record<typeof reportDateFields[number], typeof dateInput>,
  responseRequired: z.boolean().default(false),
  // D-110 (R5D): en cliente e inspección el panel guarda también las observaciones internas.
  internalObservations: text,
  actor: z.string().trim().min(1, "Indica el responsable.").max(200),
  expectedUpdatedAt: z.string().optional(),
});
export const issueReportSchema = z.object({ actor: z.string().trim().min(1).max(200), reason: text });
export const closeAuditSchema = z.object({
  actor: z.string().trim().min(1, "Indica el responsable QA.").max(200),
  closedAt: dateInput.refine(Boolean, "Indica la fecha de cierre."),
  supplierException: z.boolean().default(false),
  reason: text, verifyAtNextAudit: z.boolean().default(false),
});

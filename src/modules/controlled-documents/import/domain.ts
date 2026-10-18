import { createHash } from "node:crypto";
import { z } from "zod";
import { validDate, validRevisionCode, validBaseCode } from "../domain";
import type { PreviewRow } from "../preview/types";
export const RETENTION_DAYS = 30;
export const MAX_PENDING_BATCHES = 100;
export const MAX_BATCH_BYTES = 16 * 1024 * 1024;
export const actorSchema = z.string().trim().min(1, "Indica el responsable.").max(200);
export const resolutionSchema = z.object({
    title: z.string().trim().min(1).max(500),
    revisionCode: z.string().refine(v => !v || validRevisionCode(v)),
    effectiveFrom: z.string().refine(validDate), reviewDueAt: z.string().refine(validDate),
    declaredState: z.enum(["IN_FORCE", "ANNULLED", "IN_PREPARATION", "UNDETERMINED"]),
    departmentId: z.string().uuid(), reviewed: z.literal(true),
    reason: z.string().trim().min(1).max(2000)
}).refine(v => !v.effectiveFrom || !v.reviewDueAt || v.reviewDueAt >= v.effectiveFrom, "Fechas contradictorias.");
export type Resolution = z.infer<typeof resolutionSchema>;
export const decisionSchema = z.object({ sourceKey: z.string().regex(/^[a-f0-9]{64}$/), decision: z.enum(["INCLUDE", "EXCLUDED", "PENDING"]), scope: z.enum(["ROW", "GROUP"]).default("ROW"), actor: actorSchema, reason: z.string().trim().min(1).max(2000), resolution: resolutionSchema.optional(), version: z.number().int().nonnegative() });
export type DecisionInput = z.infer<typeof decisionSchema>;
export const bulkDecisionSchema = z.object({ actor: actorSchema, reason: z.string().trim().min(1, "Indica el motivo.").max(2000), version: z.number().int().nonnegative() });
export const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function validateCandidate(row: PreviewRow, resolution: Resolution) {
    if (row.classification !== "PNT" || row.source.sheet === "GC-00" || !row.normalized.baseCode || !validBaseCode(row.normalized.baseCode))
        throw new Error("La fila no es un candidato PNT válido.");
    if ((row.normalized.baseCode.startsWith("GC-00/") || row.normalized.departmentCode === "GC-00") && row.source.sheet !== "GC-00(")
        throw new Error("Para GC-00 solo se admite la hoja GC-00(.");
    return resolutionSchema.parse(resolution);
}
export function indexMetadata(value: unknown): { batchId: string; declaredState: keyof typeof importStates; sheet: string; row: number } | null {
    if (!value || typeof value !== "object" || !("indexImport" in value)) return null;
    const m = (value as { indexImport: unknown }).indexImport;
    if (!m || typeof m !== "object") return null;
    const v = m as Record<string, unknown>;
    if (typeof v.batchId !== "string" || typeof v.declaredState !== "string" || !Object.hasOwn(importStates, v.declaredState) || typeof v.sheet !== "string" || typeof v.row !== "number") return null;
    return v as ReturnType<typeof indexMetadata>;
}
export const importStates = { IN_FORCE: "Vigente según índice", ANNULLED: "Anulado según índice", IN_PREPARATION: "En elaboración según índice", UNDETERMINED: "Sin determinar según índice" };

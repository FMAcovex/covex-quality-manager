import { createHash } from "node:crypto";
import { z } from "zod";

// Strict client-facing pilot data. Actor, origin, policy and timestamps are never inputs.
export const pilotCommandSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
  changes: z.array(z.object({
    qmsRecordId: z.string().uuid(),
    value: z.number().int().min(0).max(2147483647),
    expectedRevision: z.number().int().nonnegative().optional(),
  }).strict()).min(1).max(4),
}).strict().superRefine((command, ctx) => {
  if (new Set(command.changes.map(c => c.qmsRecordId)).size !== command.changes.length) ctx.addIssue({ code: "custom", message: "Duplicate pilot root" });
});
export type PilotCommand = z.infer<typeof pilotCommandSchema>;
export function commandDigest(command: PilotCommand) {
  return createHash("sha256").update(JSON.stringify({ policy: "SYNTHETIC_PILOT_V1", reason: command.reason, changes: [...command.changes].sort((a,b) => a.qmsRecordId.localeCompare(b.qmsRecordId)) })).digest("hex");
}
export class AuditEngineError extends Error {
  constructor(public readonly code: "CONTEXT" | "PROTECTION" | "CONFLICT" | "WRITE_FAILED", options?: ErrorOptions) {
    super("No se ha confirmado la operación de auditoría.", options); this.name = "AuditEngineError";
  }
}

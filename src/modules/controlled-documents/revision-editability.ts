type Decision = { id: string; operation: string; oldState: string; newState: string; result: string | null; details: unknown };
type Revision = { status: string; consolidatedAt: Date | null; lifecycle?: { legacyOrigin: boolean; approvalAt: Date | null } | null; decisions: Decision[] };
const protectedStates = new Set(["APPROVED_PENDING_EFFECTIVE", "IN_FORCE", "OBSOLETE", "ANNULLED"]);
export function canEditRevision(revision: Revision): boolean {
  if (revision.status !== "DRAFT" || revision.consolidatedAt || revision.lifecycle?.legacyOrigin || revision.lifecycle?.approvalAt) return false;
  const approvals = new Set(revision.decisions.filter(d => d.operation === "REGISTER_EXTERNAL" && (d.details as { function?: string } | null)?.function === "APPROVAL").map(d => d.id));
  return !revision.decisions.some(d => protectedStates.has(d.oldState) || protectedStates.has(d.newState)
    || d.operation === "CONTRAST_EXTERNAL" && d.result === "ACCEPTED" && approvals.has((d.details as { registrationId?: string } | null)?.registrationId || ""));
}

export type ScopedAuditFollowup = { findingId: string | null; nextReviewDate: Date | null };
export function pendingAuditReviewDate(
  followups: ScopedAuditFollowup[],
  activeFindingIds: ReadonlySet<string>,
): Date | null {
  // Input is ordered newest first, exactly as provided by the DB query.
  const seen = new Set<string>();
  let earliest: Date | null = null;
  for (const row of followups) {
    if (row.findingId && !activeFindingIds.has(row.findingId)) continue;
    const scope = row.findingId ?? "general";
    if (seen.has(scope)) continue;
    seen.add(scope); // A newer blank intentionally clears the date in its own scope.
    if (row.nextReviewDate && (!earliest || row.nextReviewDate < earliest)) earliest = row.nextReviewDate;
  }
  return earliest;
}

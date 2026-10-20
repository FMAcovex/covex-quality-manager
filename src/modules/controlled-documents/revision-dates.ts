type Dates = { effectiveFrom: Date | null; reviewDueAt: Date | null };

/** Fechas vigentes de una revisión: las de su ciclo de vida si lo tiene (aunque estén vacías); si no, las propias. */
export function revisionDates(revision: Dates & { lifecycle: Dates | null }): Dates {
  const source = revision.lifecycle ?? revision;
  return { effectiveFrom: source.effectiveFrom, reviewDueAt: source.reviewDueAt };
}

import { reviewTabHref } from "@/lib/qms/review/ui-model";
import { reviewFilterOptions, type ActiveReviewCounts } from "@/lib/qms/review/list-domain";

export function ReviewListFilter({ value }: { value?: string }) {
  return <label className="filter-placeholder"><span>Revisión</span>
    <select name="review" defaultValue={value ?? ""}>
      {reviewFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}

export function ReviewListIndicator({ counts, basePath, returnTo }: { counts: ActiveReviewCounts; basePath: string; returnTo?: string }) {
  if (!counts.pending && !counts.accepted) return <span className="muted-note">—</span>;
  const href = reviewTabHref(basePath, "review", true) + (returnTo ? "&" + new URLSearchParams({ returnTo }) : "");
  return <a className="review-list-indicator" href={href} aria-label="Abrir revisión del expediente">
    {counts.pending ? <span className="badge review-pending">{counts.pending} {counts.pending === 1 ? "pendiente" : "pendientes"}</span> : null}
    {counts.accepted ? <span className="badge review-accepted">{counts.accepted} {counts.accepted === 1 ? "aceptado" : "aceptados"}</span> : null}
  </a>;
}

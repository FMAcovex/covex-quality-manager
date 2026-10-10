import type { revisionLabels } from "../domain";
import { documentStateLabel } from "../presentation";
export function DocumentStateBadge({ status }: { status: keyof typeof revisionLabels }) {
  return <span className={`badge pnt-state pnt-state--${status.toLowerCase().replaceAll("_", "-")}`}>{documentStateLabel(status)}</span>;
}

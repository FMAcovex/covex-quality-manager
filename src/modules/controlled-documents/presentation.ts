import { revisionLabels } from "./domain";
import { manualStateLabels } from "./manual-state/domain";
import { indexMetadata } from "./import/domain";
export function documentStateLabel(status: keyof typeof revisionLabels): string {
  return manualStateLabels[status as keyof typeof manualStateLabels] || revisionLabels[status];
}
export function revisionProvenance(revision: { sourceMetadata: unknown; consolidatedAt: Date | null; verificationStatus: string }): string {
  if (revision.consolidatedAt) return "Revisión consolidada: contenido de solo lectura.";
  if (indexMetadata(revision.sourceMetadata)) return revision.verificationStatus === "VERIFIED"
    ? "Revisión importada: contraste documental registrado; sin consolidar."
    : "Revisión importada pendiente de contraste documental; el índice no acredita aprobación.";
  return "Revisión creada manualmente; sin consolidar. Su estado no acredita una firma electrónica.";
}

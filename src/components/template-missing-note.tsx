import Link from "next/link";
import { PermissionGate } from "@/components/permissions";

/**
 * TPL1: en lugar de ofrecer un anexo que fallaría, la ficha explica que falta instalar su plantilla oficial. Solo la
 * ve quien podría descargarlo; a los demás no se les ofrecía nada.
 */
export function TemplateMissingNote({ annex }: { annex: string }) {
  return <PermissionGate permission="DOWNLOAD"><span className="muted-note" data-testid="template-missing">{annex}: plantilla oficial no instalada. <Link href="/settings/versions">Revisar plantillas</Link></span></PermissionGate>;
}

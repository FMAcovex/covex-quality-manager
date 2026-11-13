import Link from "next/link";

/** TPL1: en lugar de ofrecer un anexo que fallaría, la ficha explica que falta instalar su plantilla oficial. */
export function TemplateMissingNote({ annex }: { annex: string }) {
  return <span className="muted-note" data-testid="template-missing">{annex}: plantilla oficial no instalada. <Link href="/settings/versions">Revisar plantillas</Link></span>;
}

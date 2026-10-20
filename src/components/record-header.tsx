import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Cabecera común de los expedientes (D-111, V1). Mismo marcado y clases que antes; las acciones van
 * siempre en el mismo orden: «Anular» separado a la izquierda y la acción principal la última.
 */
export function RecordHeader({ back, title, chips, subtitle, annul, actions }: {
  back: { href: string; label: string };
  title: ReactNode;
  chips?: ReactNode;
  subtitle?: ReactNode;
  annul?: ReactNode;
  actions?: ReactNode;
}) {
  return <div className="record-header">
    <div>
      <p className="eyebrow"><Link href={back.href}>← {back.label}</Link></p>
      <div className="record-title-line"><h1>{title}</h1>{chips}</div>
      {subtitle ? <p className="muted-note">{subtitle}</p> : null}
    </div>
    <div className="record-actions">
      {annul ? <span className="record-actions-annul">{annul}</span> : null}
      {actions}
    </div>
  </div>;
}

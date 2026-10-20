import type { ReactNode } from "react";
import type { DueTone } from "@/lib/qms/key-facts";
import { EmptyValue } from "./empty-value";

/** `anchorId`/`marker`: ancla y marca de revisión cuando el dato solo se muestra en la franja (D-117, H-05). */
export type KeyFact = { label: string; value: ReactNode; tone?: DueTone; badgeClass?: string; anchorId?: string; marker?: ReactNode };

const flags = { overdue: "Vencido", upcoming: "Próximo" } as const;
const isEmpty = (value: ReactNode) => value === null || value === undefined || value === "" || value === "—";

/** Franja de datos clave del expediente: estado y fechas de un vistazo. En su pestaña, cada dato se muestra una sola vez (D-117). */
export function RecordKeyFacts({ facts }: { facts: KeyFact[] }) {
  return <section className="card record-key-facts" aria-label="Datos clave del expediente">
    <dl>{facts.map(fact => <div key={fact.label} id={fact.anchorId} className={"key-fact" + (fact.tone ? ` is-${fact.tone}` : "") + (fact.anchorId ? " review-target" : "")}>
      <dt>{fact.marker ? <><span>{fact.label}</span>{fact.marker}</> : fact.label}</dt>
      <dd>{isEmpty(fact.value) ? <EmptyValue/> : fact.badgeClass ? <span className={`badge ${fact.badgeClass}`}>{fact.value}</span> : fact.value}{fact.tone ? <small className="key-fact-flag">{flags[fact.tone]}</small> : null}</dd>
    </div>)}</dl>
  </section>;
}

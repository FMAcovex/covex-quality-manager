import type { ReactNode } from "react";
import type { DueTone } from "@/lib/qms/key-facts";
import { EmptyValue } from "./empty-value";

export type KeyFact = { label: string; value: ReactNode; tone?: DueTone; badgeClass?: string };

const flags = { overdue: "Vencido", upcoming: "Próximo" } as const;
const isEmpty = (value: ReactNode) => value === null || value === undefined || value === "" || value === "—";

/** Franja de datos clave del expediente: estado y fechas de un vistazo. Repite datos que siguen en su sitio. */
export function RecordKeyFacts({ facts }: { facts: KeyFact[] }) {
  return <section className="card record-key-facts" aria-label="Datos clave del expediente">
    <dl>{facts.map(fact => <div key={fact.label} className={"key-fact" + (fact.tone ? ` is-${fact.tone}` : "")}>
      <dt>{fact.label}</dt>
      <dd>{isEmpty(fact.value) ? <EmptyValue/> : fact.badgeClass ? <span className={`badge ${fact.badgeClass}`}>{fact.value}</span> : fact.value}{fact.tone ? <small className="key-fact-flag">{flags[fact.tone]}</small> : null}</dd>
    </div>)}</dl>
  </section>;
}

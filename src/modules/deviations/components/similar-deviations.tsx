import Link from "next/link";
import type { SimilarDeviation } from "@/modules/deviations/recurrence-queries";

const formatDate = (value: string | null) => (value ? value.split("-").reverse().join("/") : "sin fecha");

/** Desviaciones parecidas de los 12 meses anteriores (D-095). Solo informa; no decide la recurrencia. */
export function SimilarDeviations({ items }: { items: SimilarDeviation[] }) {
  return (
    <div className="similar-deviations">
      <strong>Desviaciones parecidas en los 12 meses anteriores</strong>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <Link className="summary-link" href={`/deviations/${item.id}`} target="_blank">{item.code}</Link>
              <span> · {formatDate(item.issueDate)} · {item.reasons.join(", ")}</span>
            </li>
          ))}
        </ul>
      ) : <p>Ninguna con el mismo lote, producto o material, ni con la misma área y procedencia.</p>}
      <small className="muted-note">Ayuda para valorar la recurrencia: la decisión sigue siendo de quien investiga.</small>
    </div>
  );
}

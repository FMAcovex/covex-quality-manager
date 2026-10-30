import { PermissionGate } from "@/components/permissions";

export type FigureView = { id: string; number: number; description: string };

const previewHref = (qmsRecordId: string, id: string) => `/api/qms/${qmsRecordId}/evidence/${id}?preview=1`;

/** D-125: miniaturas numeradas de las figuras de un apartado; cada una abre la imagen en una pestaña nueva. */
export function FigureThumbs({ qmsRecordId, figures }: { qmsRecordId: string; figures: readonly FigureView[] }) {
  if (!figures.length) return null;
  const captions = <ul className="figure-captions">{figures.map((figure) => <li key={figure.id}>Figura {figure.number}. {figure.description}</li>)}</ul>;
  return (
    <PermissionGate permission="DOWNLOAD" fallback={captions}>
      <ul className="figure-thumbs" aria-label="Figuras del apartado">
        {figures.map((figure) => (
          <li key={figure.id}>
            <a href={previewHref(qmsRecordId, figure.id)} target="_blank" rel="noopener noreferrer" aria-label={`Figura ${figure.number}: ${figure.description} (se abre en una pestaña nueva)`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- imagen servida por la ruta de evidencias con su permiso */}
              <img src={previewHref(qmsRecordId, figure.id)} alt="" loading="lazy" />
            </a>
            <span><strong>Figura {figure.number}.</strong> {figure.description}</span>
          </li>
        ))}
      </ul>
    </PermissionGate>
  );
}

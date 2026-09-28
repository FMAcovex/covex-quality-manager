import type { DocumentType } from "@prisma/client";

type TemplateAsset = {
  id: string;
  documentType: DocumentType;
  versionCode: string;
  fileName: string | null;
  filePath: string | null;
  fileSize: number | null;
  checksum: string | null;
};

export function DocumentTemplateActions({
  templates,
  documentType,
  title,
  generateHref,
  generateLabel,
}: {
  templates: TemplateAsset[];
  documentType: DocumentType;
  title: string;
  generateHref?: string;
  generateLabel?: string;
}) {
  const template = templates.find((item) => item.documentType === documentType);
  const available = Boolean(template?.fileName || template?.filePath);

  return (
    <section className="document-template-block">
      <div>
        <h3>{title}</h3>
        <p className="muted-note">
          {template
            ? `Plantilla v${template.versionCode}${available ? " cargada y controlada" : " pendiente de cargar"}`
            : "No hay versión de plantilla configurada."}
        </p>
      </div>
      <div className="document-actions">
        {template && available ? (
          <a className="button" href={`/api/settings/templates/${template.id}/download`}>
            Descargar plantilla oficial
          </a>
        ) : (
          <span className="badge warning">Plantilla oficial pendiente</span>
        )}
        {generateHref ? (
          <a className="button primary" href={generateHref}>
            {generateLabel ?? "Generar documento cumplimentado"}
          </a>
        ) : null}
      </div>
    </section>
  );
}

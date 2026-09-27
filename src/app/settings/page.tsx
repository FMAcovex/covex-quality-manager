import Link from "next/link";
import { getConfigurationOverview } from "@/modules/configuration/queries";

export const dynamic = "force-dynamic";

function yes(value: boolean) {
  return value ? "Sí" : "No";
}

function originLabel(kind: string, officialAnnexField: boolean) {
  if (kind === "STRUCTURAL") return "Estructural";
  if (kind === "DERIVED") return "Derivado";
  if (kind === "OPERATIONAL") return "Operativo";
  return officialAnnexField ? "Anexo versionado" : "Versionado";
}

function FieldTable({
  rows,
}: {
  rows: Array<{
    id: string;
    label: string;
    sectionLabel: string;
    kind: string;
    listAvailable: boolean;
    filterable: boolean;
    simpleExport: boolean;
    officialAnnexField: boolean;
  }>;
}) {
  return (
    <div className="table-scroll">
      <table className="records-table compact-table settings-table">
        <thead>
          <tr>
            <th>Campo</th>
            <th>Sección</th>
            <th>Origen</th>
            <th>Listado</th>
            <th>Filtrable</th>
            <th>Listado simple</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.label}</td>
              <td>{row.sectionLabel}</td>
              <td>{originLabel(row.kind, row.officialAnnexField)}</td>
              <td>{yes(row.listAvailable)}</td>
              <td>{yes(row.filterable)}</td>
              <td>{yes(row.simpleExport)}</td>
            </tr>
          ))}
          {!rows.length ? (
            <tr><td colSpan={6}>Sin configuración de campos cargada.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export default async function SettingsPage() {
  const config = await getConfigurationOverview();

  return (
    <section className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administración funcional</p>
          <h1>Configuración</h1>
          <p>Versiones de formulario, columnas operativas y plantillas documentales.</p>
        </div>
        <span className="badge warning">Consulta en V1</span>
      </div>

      <div className="analytics-note">
        <strong>Regla:</strong> ningún usuario añade campos a un expediente individual.
        Los campos pertenecen a una versión de formulario y son comunes a todos los
        expedientes creados con esa versión.
      </div>

      <div className="settings-grid">
        <article className="card settings-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Desviaciones</p>
              <h2>Formulario GC-00/023</h2>
            </div>
            <span className="module-state ready">
              {config.deviation.form?.versionCode ?? "Sin versión"}
            </span>
          </div>
          <p className="muted-note">
            Plantilla Anexo III: {config.deviation.template?.versionCode ?? "No configurada"}.
            Los expedientes anteriores conservan la versión con la que fueron creados.
          </p>
          <div className="settings-actions">
            <button className="button" disabled>+ Nueva versión</button>
            <button className="button" disabled>Gestionar plantilla</button>
          </div>
        </article>

        <article className="card settings-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">CAPA</p>
              <h2>Formulario GC-00/030</h2>
            </div>
            <span className="module-state ready">
              {config.capa.form?.versionCode ?? "Sin versión"}
            </span>
          </div>
          <p className="muted-note">
            Plantilla Anexo III: {config.capa.template?.versionCode ?? "No configurada"}.
            La estructura del formulario se versiona junto con su plantilla aplicable.
          </p>
          <div className="settings-actions">
            <button className="button" disabled>+ Nueva versión</button>
            <button className="button" disabled>Gestionar plantilla</button>
          </div>
        </article>
      </div>

      <section className="card">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Desviaciones</p>
            <h2>Campos y columnas de seguimiento</h2>
          </div>
          <Link className="button" href="/deviations">Ver listado</Link>
        </div>
        <FieldTable rows={config.deviation.form?.fieldConfigs ?? []} />
        <p className="muted-note">
          La vista de seguimiento puede contener más columnas que el Anexo III impreso.
          No se añaden “Último seguimiento” ni “Próximo seguimiento” a Desviaciones.
        </p>
      </section>

      <section className="card">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">CAPA</p>
            <h2>Campos y columnas de seguimiento</h2>
          </div>
          <Link className="button" href="/capa">Ver listado</Link>
        </div>
        <FieldTable rows={config.capa.form?.fieldConfigs ?? []} />
        <p className="muted-note">
          El listado operativo conserva columnas de seguimiento que no tienen por qué
          imprimirse todas en el Anexo III.
        </p>
      </section>

      <section className="review-note">
        <div>
          <p className="eyebrow">Cambios de estructura</p>
          <h2>Cómo se aplicarán</h2>
        </div>
        <p>
          Cambiar una vista no modifica el formulario. Cambiar el formulario exige una nueva
          versión. Cambiar una regla de negocio o un KPI requiere una actualización técnica probada.
        </p>
      </section>
    </section>
  );
}

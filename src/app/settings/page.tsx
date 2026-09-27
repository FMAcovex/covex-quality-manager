import Link from "next/link";

const deviationFields = [
  ["Código", "Identificación", "Sistema", "Sí", "Sí", "Sí"],
  ["Departamento", "Identificación", "Anexo", "Sí", "Sí", "Sí"],
  ["Material / proceso afectado", "Identificación", "Anexo", "Sí", "Sí", "Sí"],
  ["Procedencia", "Identificación", "Anexo", "Sí", "Sí", "Sí"],
  ["Descripción", "Evento", "Anexo", "Sí", "No", "Sí"],
  ["Clasificación", "Evaluación", "Anexo", "Sí", "Sí", "Sí"],
  ["Causa raíz", "Investigación", "Anexo", "Sí", "No", "Sí"],
  ["Fecha apertura", "Identificación", "Anexo", "Sí", "Sí", "Sí"],
  ["Fecha cierre", "Cierre", "Anexo", "Sí", "Sí", "Sí"],
  ["Estado", "Gestión", "Sistema", "Sí", "Sí", "Sí"],
  ["Medidas adoptadas", "Acciones", "Derivado", "Sí", "Sí", "Sí"],
  ["Código CAPA", "Relaciones", "Derivado", "Sí", "Sí", "Sí"],
  ["Observaciones", "Seguimiento", "Operativo", "Sí", "No", "Sí"],
];

const capaFields = [
  ["Tipo CAPA", "Identificación", "Anexo", "Sí", "Sí", "Sí"],
  ["Código", "Identificación", "Sistema", "Sí", "Sí", "Sí"],
  ["Departamento", "Identificación", "Anexo", "Sí", "Sí", "Sí"],
  ["Origen", "Identificación", "Anexo", "Sí", "Sí", "Sí"],
  ["Código de origen", "Identificación", "Anexo", "Sí", "Sí", "Sí"],
  ["Descripción CAPA", "Acción", "Anexo", "Sí", "No", "Sí"],
  ["Fecha apertura", "Identificación", "Anexo", "Sí", "Sí", "Sí"],
  ["Fecha prevista", "Acción", "Anexo", "Sí", "Sí", "Sí"],
  ["Estado", "Gestión", "Sistema", "Sí", "Sí", "Sí"],
  ["Cierre operativo", "Cierre", "Anexo", "Sí", "Sí", "Sí"],
  ["Eficacia", "Eficacia", "Anexo", "Sí", "Sí", "Sí"],
  ["Último seguimiento", "Seguimiento", "Derivado", "Sí", "No", "Sí"],
  ["Próximo seguimiento", "Seguimiento", "Anexo/seguimiento", "Sí", "Sí", "Sí"],
  ["Cierre efectivo", "Eficacia", "Anexo", "Sí", "Sí", "Sí"],
  ["Observaciones", "Seguimiento", "Operativo", "Sí", "No", "Sí"],
];

function FieldTable({ rows }: { rows: string[][] }) {
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
            <tr key={row[0]}>
              {row.map((value, index) => <td key={index}>{value}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <section className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administración funcional</p>
          <h1>Configuración</h1>
          <p>Versiones de formulario, columnas operativas y plantillas documentales.</p>
        </div>
        <span className="badge warning">Prototipo · cambios bloqueados en V1</span>
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
            <span className="module-state ready">v06 activa</span>
          </div>
          <p className="muted-note">
            Una revisión futura se crea como borrador, se configura y se activa con fecha de vigencia.
            Los expedientes anteriores conservan su versión.
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
            <span className="module-state ready">v05 activa</span>
          </div>
          <p className="muted-note">
            La plantilla del Anexo III y la definición de campos se versionan conjuntamente.
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
        <FieldTable rows={deviationFields} />
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
        <FieldTable rows={capaFields} />
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

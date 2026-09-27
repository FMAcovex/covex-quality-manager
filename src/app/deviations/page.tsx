const columns = [
  "Código",
  "Departamento",
  "Material / Proceso",
  "Procedencia",
  "Descripción",
  "Clasificación",
  "Causa raíz",
  "Apertura",
  "Cierre",
  "Estado",
  "En plazo",
  "Medidas adoptadas",
  "Descripción CAPA",
  "Documento",
  "Observaciones",
];

export default function DeviationsPage() {
  return (
    <section className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Sistema de Calidad</p>
          <h1>Desviaciones</h1>
          <p>Base técnica del módulo. La funcionalidad completa se implementará en el Hito 2.</p>
        </div>
        <div className="heading-actions">
          <button type="button" className="button primary" disabled>+ Nueva desviación</button>
          <button type="button" className="button" disabled>Exportar</button>
        </div>
      </div>

      <div className="tabs">
        <span className="tab active">Expedientes</span>
        <span className="tab muted">Indicadores · Hito 5</span>
      </div>

      <div className="filter-panel">
        {["Año","Departamento","Estado","Clasificación","Procedencia","Medidas","CAPA","En plazo"].map(
          (filter) => (
            <label key={filter} className="filter-placeholder">
              <span>{filter}</span>
              <select disabled aria-label={filter}><option>Todos</option></select>
            </label>
          ),
        )}
        <button type="button" className="button filter-more" disabled>Más filtros</button>
      </div>

      <div className="search-placeholder">
        <span>⌕</span>
        <input
          disabled
          aria-label="Buscar desviaciones"
          placeholder="Buscar por código, descripción, material/proceso, causa raíz, CAPA, observaciones…"
        />
      </div>

      <div className="status-strip">
        <div><strong>—</strong><span>Desviaciones</span></div>
        <div><strong>—</strong><span>Abiertas</span></div>
        <div><strong>—</strong><span>Fuera de plazo</span></div>
        <div><strong>—</strong><span>Pendientes de seguimiento</span></div>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={columns.length} className="empty-state">
                  <strong>Núcleo técnico preparado.</strong>
                  <span>Los expedientes reales y datos históricos no se cargan en el Hito 1.</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default function Loading() {
  return (
    <section className="workspace loading-state" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <div>
        <strong>Cargando información…</strong>
        <p>Consultando los datos del Sistema de Calidad.</p>
      </div>
    </section>
  );
}

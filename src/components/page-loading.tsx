/**
 * Contenido de espera en la primera carga de una página (D-104). Va en un `<Suspense>` fijo del
 * layout: al cambiar de apartado React mantiene la página anterior durante la transición y solo
 * se ve la barra de progreso, sin el mínimo de ~300 ms de la antigua `loading.tsx`.
 */
export function PageLoading() {
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

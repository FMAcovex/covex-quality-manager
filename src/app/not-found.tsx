import Link from "next/link";

export default function NotFound() {
  return (
    <section className="workspace system-state">
      <div className="system-state-card">
        <p className="eyebrow">Recurso no encontrado</p>
        <h1>La página o expediente no existe</h1>
        <p>
          Comprueba el enlace o vuelve al módulo correspondiente. No se ha realizado
          ningún cambio en los datos.
        </p>
        <Link className="button primary" href="/">
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}

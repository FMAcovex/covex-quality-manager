"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error", error);
  }, [error]);

  return (
    <section className="workspace system-state">
      <div className="system-state-card">
        <p className="eyebrow">Incidencia de aplicación</p>
        <h1>No se ha podido completar la operación</h1>
        <p>
          No se muestran detalles técnicos ni datos internos. Puedes reintentar la
          operación o volver al inicio.
        </p>
        {error.digest ? (
          <p className="system-reference">
            Referencia técnica: <code>{error.digest}</code>
          </p>
        ) : null}
        <div className="heading-actions">
          <button className="button primary" type="button" onClick={() => reset()}>
            Reintentar
          </button>
          <Link className="button" href="/">
            Volver al inicio
          </Link>
        </div>
      </div>
    </section>
  );
}

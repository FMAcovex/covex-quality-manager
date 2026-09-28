"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body>
        <main style={{ maxWidth: 720, margin: "80px auto", padding: 24, fontFamily: "Arial, sans-serif" }}>
          <h1>Error de aplicación</h1>
          <p>
            No se ha podido cargar la aplicación. No se muestran detalles técnicos
            para evitar exponer información interna.
          </p>
          <button type="button" onClick={() => reset()}>
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}

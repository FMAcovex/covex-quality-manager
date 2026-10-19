function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function templateUnavailableResponse(message?: string) {
  const safeMessage = message ? escapeHtml(message) : "";
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Plantilla no disponible · COVEX</title>
<style>
body{margin:0;font-family:Arial,sans-serif;background:#f5f7fb;color:#14213d}
main{max-width:720px;margin:64px auto;padding:0 20px}
.card{background:#fff;border:1px solid #dfe5ee;border-radius:12px;padding:28px;box-shadow:0 8px 24px rgba(20,33,61,.06)}
h1{font-size:22px;margin:0 0 12px}p{line-height:1.55}
.note{background:#f7f9fc;border-radius:8px;padding:12px 14px;color:#4b5870;margin:18px 0}
a{display:inline-block;padding:9px 14px;border-radius:7px;background:#1264d8;color:#fff;text-decoration:none;margin-right:8px}
a.secondary{background:#eef3fb;color:#174a8b}
</style>
</head>
<body><main><div class="card">
<h1>Plantilla oficial no disponible</h1>
<p>Este documento no puede generarse todavía porque la plantilla controlada necesaria no está instalada correctamente en este entorno.</p>
${safeMessage ? `<div class="note">${safeMessage}</div>` : ""}
<p>Ve a <strong>Administración → Versiones y plantillas</strong> para comprobar qué archivo falta. En el entorno de prueba también puedes instalar el bundle controlado de plantillas.</p>
<a href="/settings/versions">Revisar plantillas</a>
<a class="secondary" href="javascript:history.back()">Volver</a>
</div></main></body></html>`;
  return new Response(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** Página legible cuando un documento no puede generarse o descargarse (en lugar de JSON). */
export function documentUnavailableResponse(message: string, status = 409) {
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Documento no disponible · COVEX</title>
<style>
body{margin:0;font-family:Arial,sans-serif;background:#f5f7fb;color:#14213d}
main{max-width:720px;margin:64px auto;padding:0 20px}
.card{background:#fff;border:1px solid #dfe5ee;border-radius:12px;padding:28px;box-shadow:0 8px 24px rgba(20,33,61,.06)}
h1{font-size:22px;margin:0 0 12px}p{line-height:1.55}
.note{background:#f7f9fc;border-radius:8px;padding:12px 14px;color:#4b5870;margin:18px 0}
a{display:inline-block;padding:9px 14px;border-radius:7px;background:#1264d8;color:#fff;text-decoration:none}
</style>
</head>
<body><main><div class="card">
<h1>Documento no disponible</h1>
<div class="note">${escapeHtml(message)}</div>
<a href="javascript:history.back()">Volver</a>
</div></main></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

# PNT — Correcciones de revisión final

Una rama y una PR, sin merge ni squash. Base actualizada `417e3a3a` (los cambios posteriores a `ee76865b` corresponden a Auditorías/CI y se preservan). El módulo no se considera cerrado.

| Incidencia | Corrección |
|---|---|
| F-01 | Borrador devuelto desde En revisión editable si nunca fue aprobado/consolidado. Misma condición en servicio, ficha y URL directa. Históricos y aprobaciones previas bloqueados. |
| F-02 | Consulta completa del listado, incluida página, conservada por returnTo local en pestañas, edición, alta y guardados de contenido, estado y documentos. Cambiar filtros reinicia página. |
| V-01 | Badge y etiquetas documentales compartidos en Listado, Información y Revisiones; estado administrativo independiente. |
| V-02 | Procedencia manual/importada/consolidada por metadatos reales y consolidación; un ciclo documental no implica importación. |
| Excel | Verificación traducida usando etiquetas existentes, sin alterar enums internos ni selección completa/orden del XLSX. |
| Última revisión | Ayuda explícita: mayor número, puede ser borrador; no necesariamente vigente. Selección intacta. |

Se conservan documentos, bytes, asociaciones, decisiones/evidencias y cambios anteriores. La edición añade historial e incrementa versión de concurrencia; una verificación anterior no acredita contenido modificado y exige nuevo contraste. Sin schema, migraciones ni cambios funcionales en Desviaciones/CAPA/Auditorías.

## Regresión

24 pruebas unitarias nuevas. `pnt-final:smoke` verifica Borrador → En revisión → Borrador → edición, conservación exacta de archivo/evidencias/decisiones/histórico previo, versión y guardado obsoleto, contraste del contenido actual, bloqueo de aprobadas (incluido retorno a Borrador), vigentes y obsoletas.

`pnt-final:ui:smoke` crea 31 coincidencias sintéticas para comprobar página 2, filtros/vista/orden, cuatro pestañas, edición/guardado de maestro y revisión devuelta, estados, URL directa protegida, nueva revisión, asociación y descarga SHA-256 del PDF histórico, ownership 404, exportación completa con etiquetas españolas, colores iguales y 1440/768/390 sin errores JavaScript. CI publica capturas.

Antes de la pausa: suite de 470 unitarios, Prisma/lint/build, smoke de base PostgreSQL WASM y recorrido Chromium completos. El entorno se reinició antes de publicar y se reconstruyeron las correcciones; la CI sobre el commit de esta PR es la evidencia definitiva de los archivos publicados y repite migraciones, smokes en PostgreSQL 16 convencional, navegador y quality. Consultar enlace y estado final en la PR. No constituye cierre del módulo ni validación GMP.

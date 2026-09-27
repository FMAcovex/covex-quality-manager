# Estado actual

Fecha: 2026-09-27.

## Hitos completados
- Hito 0 — Especificación y arquitectura.
- Hito 1 — Núcleo técnico y base de datos.
- Hito 2 — Desviaciones completas.
- Hito 3 — Documentos y exportaciones.

## Hito 4 — Importación histórica 2025–2026
Estado: **EN DESARROLLO** en `feature/hito-04-historical-import`.

### Fuente confirmada
- `000 LISTADO GENERAL DESVIACIONES.xlsx` de la carpeta `05 DESVIACIONES`.
- Hoja 2025: 53 expedientes.
- Hoja 2026: 34 expedientes.
- Total esperado en la fuente revisada: 87 expedientes.
- Los esquemas 2025 y 2026 son diferentes y se mapean por separado.

### Implementado en la rama
- lector XLSX OOXML reutilizando el motor ZIP propio;
- mapeos explícitos 2025 y 2026;
- catálogo histórico de departamentos recuperado del propio libro;
- extracción conservadora de códigos AC/AP;
- `dry-run` por defecto;
- detección de duplicados en fuente y base de datos;
- clasificación de incidencias de calidad del dato;
- importación real con confirmación explícita;
- trazabilidad mediante lote y fila de importación;
- snapshot original de cada fila;
- historial con origen `IMPORT`;
- almacenamiento del SHA-256 del libro fuente;
- informes JSON fuera de Git;
- pruebas unitarias de lector y mapeo.

### Regla de calidad histórica
El listado general no equivale al Anexo III. Los registros importados quedan como `REVIEW_REQUIRED` salvo bloqueo por datos esenciales, que pasa a `INCOMPLETE`. No se inventan campos ausentes.

### Pendiente antes del merge
- ejecutar CI;
- smoke test PostgreSQL de dry-run + apply + reejecución para comprobar idempotencia;
- ejecutar dry-run contra la copia real del libro y revisar el informe;
- actualizar este estado con los resultados reales.

## Próximo paso
Completar y validar Hito 4 antes de iniciar indicadores.

# Estado actual

Fecha: 2026-09-27.

## Hitos completados
- Hito 0 — Especificación y arquitectura.
- Hito 1 — Núcleo técnico y base de datos.
- Hito 2 — Desviaciones completas.
- Hito 3 — Documentos y exportaciones.
- Hito 4 — Importación histórica 2025–2026.

## Hito 4 — Importación histórica 2025–2026
Estado: **COMPLETADO Y VALIDADO**.

### Implementado
- lector XLSX OOXML reutilizando el motor ZIP propio;
- mapeos explícitos y separados para 2025 y 2026;
- catálogo histórico de departamentos recuperado del propio libro;
- extracción conservadora de códigos AC/AP;
- dry-run por defecto;
- detección de duplicados dentro de la fuente y contra PostgreSQL;
- clasificación de incidencias de calidad del dato;
- importación real solo con confirmación explícita;
- trazabilidad mediante lote y fila de importación;
- snapshot original de cada fila;
- historial con origen `IMPORT`;
- SHA-256 del libro fuente;
- informes JSON fuera de Git;
- prueba de idempotencia dry-run -> apply -> dry-run;
- corrección y test del caso OOXML de celdas vacías auto-cerradas.

### Dry-run sobre la copia real revisada
Fuente: `000 LISTADO GENERAL DESVIACIONES.xlsx`.
SHA-256: `c11558835752558d1e3858a5eb11a1ce829c42410e19067aa109bbe76527af02`.

Resultado de lectura:
- 87 expedientes;
- 53 de 2025;
- 34 de 2026;
- 0 códigos duplicados dentro de las hojas 2025/2026;
- 2 registros 2026 sin recurrencia informada;
- 2 registros 2026 sin afectación a producto terminado informada;
- 2 registros 2026 sin medidas adoptadas informadas;
- 2 expedientes GC-12 cuyo nombre de departamento no figura en el catálogo embebido del libro;
- el listado 2026 no contiene un campo equivalente al control de cierre en plazo de 2025 ni estado de documento firmado.

Todos los históricos se marcan como `REVIEW_REQUIRED` porque el listado general no equivale al Anexo III completo. Los campos ausentes permanecen ausentes; no se infieren.

### Seguridad de la importación
La ejecución sin `--apply` no escribe expedientes.
La importación real requiere además `--confirm APPLY_2025_2026`.
Una segunda lectura después de aplicar el mismo fichero detecta los registros existentes como duplicados y no los vuelve a crear.

### Validación final
- PostgreSQL 16 real;
- `prisma db push`, seed y smoke test base;
- smoke test de importación histórica e idempotencia;
- Prisma validate/generate;
- lint;
- tests;
- build Next.js de producción;
- dry-run independiente contra la copia real del libro.

## Fuera de alcance todavía
- enriquecimiento histórico leyendo cada Anexo III individual;
- KPI;
- expediente CAPA completo;
- Entra;
- SharePoint automático;
- alertas.

## Próximo paso
Hito 5 — Indicadores: KPI desde PostgreSQL, comparativa anual, tendencias de 5 años y filtros alineados con el dashboard GMP.

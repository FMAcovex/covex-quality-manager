# Estado actual

Fecha: 2026-09-27.

## Hitos completados

### Hito 0 — Especificación y arquitectura
Completado e integrado.

### Hito 1 — Núcleo técnico y base de datos
Completado y validado por CI.

### Hito 2 — Desviaciones completas
Estado: **COMPLETADO Y VALIDADO**.

Implementado:
- listado operativo conectado a PostgreSQL;
- filtros horizontales y buscador;
- contadores operativos;
- alta de desviación por bloques;
- edición de expedientes abiertos y cerrados;
- acciones inmediatas 1:N;
- separación de descripción, investigación, causa raíz, impacto, CAPA y cierre;
- CAPA propuestas 1:N;
- expediente a pantalla completa;
- pestañas Resumen, Investigación, Acciones, Seguimientos, Documentos e Historial;
- seguimientos cronológicos con próxima fecha y evidencia;
- historial interno de modificaciones;
- observaciones internas;
- control de calidad/completitud del dato;
- preservación del snapshot histórico de departamento;
- campo de plazo `NOT_EVALUATED` hasta disponer de reglas vigentes configuradas;
- PostgreSQL local mediante Docker Compose;
- pruebas unitarias de validación de apertura/cierre/CAPA.

Validación final:
- PostgreSQL 16 real en CI;
- `prisma db push`;
- seed;
- smoke test de persistencia de desviación, acción inmediata, CAPA propuesta, seguimiento y relación N:N;
- Prisma validate/generate;
- lint;
- 10 tests;
- build Next.js.

## Fuera de alcance todavía
- generación Anexo III;
- generación Anexo V;
- listado simple descargable;
- importación histórica 2025/2026;
- KPI;
- expediente CAPA completo;
- Entra;
- SharePoint automático;
- alertas.

## Próximo paso
Hito 3 — Documentos y exportaciones: Anexo III DOCX, Anexo V XLSX anual completo y listado simple.

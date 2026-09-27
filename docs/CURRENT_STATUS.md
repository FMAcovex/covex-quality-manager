# Estado actual

Fecha: 2026-09-27.

## Hitos completados
- Hito 0 — Especificación y arquitectura.
- Hito 1 — Núcleo técnico y base de datos.
- Hito 2 — Desviaciones completas.
- Hito 3 — Documentos y exportaciones.

## Hito 3 — Documentos y exportaciones
Estado: **COMPLETADO Y VALIDADO**.

Implementado:
- generación de Anexo III DOCX individual desde el expediente;
- mapeo a la estructura A–M del Anexo III v06;
- casillas Word/control de contenido, acciones inmediatas y CAPA repetibles;
- zonas de firma preservadas;
- generación de Anexo V XLSX anual desde la plantilla v06;
- hoja detallada y TABLA OFICIAL cumplimentadas desde los mismos registros;
- tabla anual extendida hasta la capacidad controlada de la plantilla (61 registros);
- error explícito si se supera esa capacidad, sin truncar registros;
- listado simple XLSX con las columnas operativas y filtros activos;
- listado simple anual;
- menú Exportar en la pantalla de Desviaciones;
- registro de generaciones de Anexo III;
- plantillas versionadas lógicamente y verificadas por SHA-256;
- error explícito si el expediente solicita una revisión de plantilla no instalada;
- saneado de autores, rutas SharePoint y metadatos heredados en los documentos generados;
- motor OOXML propio basado en ZIP/XML, sin requerir Microsoft Office en servidor;
- instalación local de plantillas mediante `pnpm templates:install`;
- pruebas unitarias del motor ZIP/XML, listado simple, controles Word, metadatos y extensión de filas del Anexo V;
- revisión visual independiente con datos ficticios sobre las plantillas oficiales v06.

### Plantillas auditadas
- Anexo III Informe Desviaciones 06.docx.
- Anexo V Listado de Desviaciones 06.xlsx.

Los binarios controlados se instalan localmente y no se versionan en GitHub. El instalador solo acepta las copias auditadas mediante SHA-256.

### Nota histórica
La revisión documental aplicable a los expedientes de 2025 debe verificarse durante el Hito 4 antes de considerar una exportación histórica como Anexo V oficial. No se asignará silenciosamente una versión actual a históricos sin verificarla.

### Validación final
- PostgreSQL 16 real;
- `prisma db push`, seed y smoke test;
- Prisma validate/generate;
- lint;
- 9 ficheros de test / 15 tests superados;
- build Next.js de producción superado;
- revisión visual independiente del Anexo III y Anexo V generados con datos ficticios.

## Fuera de alcance todavía
- importación histórica 2025/2026;
- KPI;
- expediente CAPA completo;
- Entra;
- SharePoint automático;
- alertas.

## Próximo paso
Hito 4 — Importación histórica 2025–2026: dry-run, validación, duplicados, calidad del dato y trazabilidad de importación.

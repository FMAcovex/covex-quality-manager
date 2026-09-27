# Estado actual

Fecha: 2026-09-27.

## Hitos completados
- Hito 0 — Especificación y arquitectura.
- Hito 1 — Núcleo técnico y base de datos.
- Hito 2 — Desviaciones completas.

## Hito 3 — Documentos y exportaciones
Estado: **EN DESARROLLO** en `feature/hito-03-documents`.

Implementado en la rama:
- motor OOXML sin dependencias externas de Office;
- uso de las plantillas oficiales auditadas v06 con control SHA-256;
- Anexo III DOCX individual desde el expediente;
- filas repetibles para acciones inmediatas y CAPA;
- preservación de las zonas de firma del Anexo III;
- Anexo V XLSX anual con hoja detallada y TABLA OFICIAL;
- capacidad controlada del Anexo V v06: 61 registros;
- listado simple XLSX respetando filtros;
- listado simple anual;
- registro de generación del Anexo III;
- instalación local de plantillas mediante `pnpm templates:install`;
- controles de exportación en la interfaz.

Pendiente antes del cierre:
- CI completo;
- corrección de incidencias detectadas por CI;
- prueba de generación sobre las plantillas reales;
- render y revisión visual del DOCX/XLSX de prueba.

## Fuera de alcance todavía
- importación histórica 2025/2026;
- KPI;
- módulo CAPA completo;
- Entra;
- SharePoint automático;
- alertas.

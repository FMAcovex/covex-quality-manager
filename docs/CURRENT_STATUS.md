# Estado actual

Fecha: 2026-09-27.

## Hito 0
Completado e integrado en `main`.

## Hito 1 — Núcleo técnico y base de datos
Estado: **COMPLETADO Y VALIDADO POR CI**.

### Implementado
- scaffold Next.js + TypeScript + React;
- pnpm y configuración de calidad;
- Prisma + PostgreSQL;
- modelos QmsRecord/QmsRelation;
- catálogo Department con snapshot histórico en Deviation;
- FormVersion/TemplateVersion;
- ChangeHistory y GeneratedDocument;
- Deviation + acciones inmediatas + seguimientos + plan CAPA;
- relaciones N:N con normalización en utilidad de dominio;
- shell visual inicial;
- ruta `/deviations` sin funcionalidad falsa;
- endpoint `/api/health`;
- seeds estructurales/ficticios;
- pruebas unitarias de identidad y relaciones;
- GitHub Actions para validate/generate/lint/test/build.

### Validación
CI del Hito 1: **verde**.
Se han validado instalación de dependencias, Prisma, lint, tests y build antes del squash merge.

## Fuera de alcance todavía
- formulario completo de Desviaciones;
- CRUD real desde la UI;
- importación 2025/2026;
- Anexo III/V;
- KPI;
- CAPA UI;
- Entra;
- SharePoint;
- alertas.

## Próximo paso
Hito 2 — Desviaciones completas: listado, filtros, buscador, alta, edición, expediente, acciones inmediatas, investigación, impacto, CAPA propuestas, seguimientos e historial.

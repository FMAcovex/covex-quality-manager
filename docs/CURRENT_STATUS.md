# Estado actual

Fecha: 2026-09-27.

## Hito 0
Completado e integrado en `main`.

## Hito 1 — Núcleo técnico y base de datos
Estado: **EN DESARROLLO** en `feature/hito-01-core`.

### Implementado en la rama
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
- seeds ficticios/estructurales;
- pruebas unitarias del núcleo de relaciones;
- GitHub Actions para validate/generate/lint/test/build.

### Validación
El workflow base de CI ya está integrado en `main`. La validación definitiva del Hito 1 debe pasar por CI del PR. El entorno de esta sesión no dispone de acceso al registro npm, por lo que no se considera validado hasta obtener CI verde.

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
Abrir PR del Hito 1, corregir cualquier incidencia detectada por CI y fusionar únicamente con comprobaciones verdes.

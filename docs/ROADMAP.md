# Roadmap

## Hito 0 — Especificación y GitHub
Objetivo:
- repositorio privado;
- AGENTS;
- especificación;
- decisiones;
- modelo de datos;
- workflows;
- UI;
- documentos;
- fuentes GMP;
- roadmap;
- tarea inicial de Codex.

Criterio de salida:
- documentación coherente y versionada en main.

## Hito 1 — Núcleo técnico y base de datos
- Next.js + TypeScript/React.
- PostgreSQL.
- Prisma.
- layout base.
- QmsRecord/QmsRelation.
- versiones.
- historial.
- documentos generados.
- catálogos mínimos.
- seeds ficticios.
- test/lint/build.

## Hito 2 — Desviaciones completas
- listado principal;
- filtros;
- buscador;
- alta;
- edición;
- pantalla completa;
- acciones inmediatas;
- investigación;
- impacto;
- CAPA propuestas;
- seguimientos;
- historial;
- observaciones;
- estados básicos.

## Hito 3 — Documentos y exportaciones
- Anexo III DOCX.
- Anexo V XLSX completo.
- listado simple.
- listado anual.
- versionado de plantillas.
- validación automática/visual de outputs.

## Hito 4 — Migración 2025-2026
- importador;
- dry-run;
- validación;
- duplicados;
- calidad del dato;
- informe de migración.

## Hito 5 — Indicadores
- KPI desde BD;
- comparativa anual;
- tendencias 5 años;
- filtros;
- diseño alineado con dashboard GMP.

## Hito 6 — CAPA
- módulo completo;
- listados/filtros;
- expediente;
- seguimiento;
- eficacia;
- cierre;
- relaciones N:N;
- indicadores CAPA.

### Punto de control
Después del Hito 6 evaluar calidad, facilidad de uso y arquitectura antes de ampliar.

## Hito 7 — Controles de cambios
Implementar lógica específica reutilizando plataforma común.

## Hito 8 — Reclamaciones y Devoluciones
Implementar ambos módulos como entidades independientes con relaciones QMS.

## Hito 9 — Administración y evolución
- catálogos;
- versiones;
- plantillas;
- parámetros;
- preparación de alertas.

## Hito 10 — Endurecimiento y demo
- tests;
- UX;
- rendimiento;
- seguridad básica;
- errores;
- backup/export;
- documentación;
- demo con datos ficticios.

## Hito 11 — Producción / IT
Solo cuando la aplicación esté demostrada:
- Azure o hosting corporativo;
- PostgreSQL corporativo;
- Entra ID;
- roles;
- integración SharePoint opcional;
- evaluación de validación y controles GMP.

## Flujo Git

Por hito:
1. rama `feature/hito-XX-...`;
2. implementación;
3. lint/test/build;
4. actualización CURRENT_STATUS;
5. PR;
6. revisión;
7. squash merge.


## Hito 6.1 — Versionado transversal de expedientes y seguimientos
- snapshots funcionales de expediente;
- V00 inicial;
- reaperturas de Desviaciones V01+;
- seguimientos CAPA V01+;
- cierre operativo y eficacia conservados por versión;
- descarga de anexos históricos por versión;
- vínculo de documentos generados con la versión;
- baseline explícito para históricos no reconstruibles;
- base reutilizable para seguimientos de Controles de cambios.

Criterio de salida:
- Desviaciones y CAPA usan el mecanismo común sin alterar su codificación de negocio;
- una edición ordinaria no crea una versión funcional;
- una reapertura de Desviación y un nuevo seguimiento CAPA sí la crean;
- snapshots previos permanecen inmutables.


### Hito 7 — Controles de cambios
Estado de implementación:
- solicitud y dictamen GC-00/003/03;
- plan de ejecución 1:N;
- seguimiento documental 00/01/02…;
- versionado funcional V00 inicial + V01/V02… por seguimiento;
- ejecución, eficacia y cierre separados;
- cierre justificado sin ejecución;
- Anexos III, IV y V;
- Anexo VII y listado simple;
- indicadores y tendencia 5 años;
- importación histórica 2025–2026 con dry-run e idempotencia;
- plantillas controladas por checksum;
- pruebas PostgreSQL e integración CI.

Criterio de salida:
- flujo completo ejecutable desde UI;
- seguimientos históricos no se sobrescriben;
- documentos regenerables desde el estado persistido;
- listado anual y operativo descargables;
- indicadores calculados desde PostgreSQL;
- importador no inventa información histórica.

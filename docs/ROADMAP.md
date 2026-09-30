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


### Criterio de salida Hito 7
- módulo de Controles de Cambios operativo;
- Solicitud + Dictamen + Seguimientos en un único expediente;
- tareas dinámicas por departamento;
- baseline aprobado protegido;
- seguimientos 00+ y nuevas tareas estructuradas;
- ejecución/eficacia/cierre separados;
- Anexos III/IV/V y VII generables;
- listado simple e indicadores;
- relaciones e historial;
- smoke test y CI completos.


### Criterio de salida Hito 8
- Reclamaciones y Devoluciones operativas;
- patrón UX coherente con Desviaciones;
- investigación/CAPA/eficacia en Reclamaciones;
- productos 1:N y checklist técnico en Devoluciones;
- relaciones QMS;
- anexos oficiales y listados simples;
- indicadores y tendencia de 5 años;
- plantillas controladas por SHA-256;
- smoke test PostgreSQL y CI completos.


### Criterio de salida Hito 9
- administración separada de la operación diaria;
- departamentos y catálogos auxiliares con activación/vigencia;
- historial operativo de cambios administrativos;
- clonación DRAFT y activación controlada de versiones de formulario;
- formularios activos bloqueados frente a edición administrativa;
- carga y versionado de plantillas DOCX/XLSX con SHA-256;
- recuperación de plantillas almacenadas en PostgreSQL;
- parámetros no estructurales administrables;
- reglas configurables de vencimiento;
- bandeja transversal de próximos/vencidos;
- envío automático de alertas expresamente desactivado;
- smoke test PostgreSQL y CI completos.


### Criterio de salida Hito 10
- errores globales y estados de carga seguros;
- health check que verifique conectividad real con PostgreSQL sin exponer detalles internos;
- cabeceras HTTP de seguridad y bloqueo de indexación;
- exportación lógica completa de la base con SHA-256 y verificación estructural;
- backups excluidos de Git y documentados como artefactos sensibles;
- dataset ficticio idempotente y protegido por `ALLOW_DEMO_DATA`;
- demo transversal de los cinco módulos con relaciones QMS;
- smoke test específico de endurecimiento incluido en CI;
- documentación local/demo y límites de la V1 actualizados;
- autenticación, roles corporativos y política de backup de producción permanecen en Hito 11.


## Fase previa a Auditorías — Revisión fina de módulos existentes
Antes de iniciar el módulo de Auditorías se realizará una revisión individual de los módulos ya implantados, centrada en maquetación del expediente, experiencia de uso y seguimiento operativo.

Orden de trabajo:
1. CAPA.
2. Controles de Cambios.
3. Reclamaciones.
4. Desviaciones.
5. Regresión transversal final de los cuatro módulos.
6. Inicio del módulo Auditorías.

### R1 — CAPA
- revisar maquetación completa del expediente;
- revisar especialmente la pestaña y tarjetas de seguimientos;
- alinear código CAPA, acciones propuestas, responsables y fechas;
- comprobar enlaces entre propuestas, acciones, seguimientos y versiones;
- revisar presentación de eficacia, cierre operativo y cierre efectivo;
- revisar Anexo III y representación de todos los orígenes vinculados cuando se defina el detalle;
- mantener intactas las reglas de negocio ya validadas salvo necesidad justificada.

### R2 — Controles de Cambios
- revisar maquetación de Solicitud, Dictamen, plan de ejecución y seguimientos;
- mejorar lectura de tareas, responsables, departamentos, fechas y estados;
- revisar presentación de versiones/seguimientos 00+;
- comprobar separación visual entre ejecución, eficacia y cierre;
- revisar navegación y documentos asociados.

### R3 — Reclamaciones
- revisar maquetación del expediente y orden visual de Partes I/II;
- revisar investigación, acciones derivadas, CAPA, respuesta y cierre;
- mejorar presentación de seguimientos y eficacia;
- revisar navegación hacia CAPA y Devoluciones;
- comprobar coherencia visual con el resto del QMS sin perder particularidades del módulo.

### R4 — Desviaciones
- revisión final de maquetación del expediente ya alineado con el Anexo III;
- revisar especialmente seguimientos, versiones y navegación CAPA;
- ajustar presentación de investigación, causa raíz, impacto, acciones y cierre;
- conservar como referencia funcional del patrón transversal ya validado.

### R5 — Regresión previa a Auditorías
- smoke/CI de los cuatro módulos;
- prueba manual de navegación y maquetación;
- comprobar Borrador, apertura, edición/nueva versión, seguimientos, relaciones y documentos;
- confirmar ausencia de regresiones en Devoluciones y resto de funcionalidad transversal.

Criterio de salida:
- los cuatro módulos quedan funcional y visualmente revisados;
- los seguimientos tienen una presentación consistente y clara;
- no quedan mejoras conocidas de maquetación bloqueantes para V1;
- CI verde y prueba manual satisfactoria;
- solo entonces comienza Auditorías.

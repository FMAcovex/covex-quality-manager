# COVEX Quality Manager — baseline y backlog V1

**Fecha de corte:** 2026-10-10. **Repositorio:** FMAcovex/covex-quality-manager. **Base de referencia:** main en 5194afe5fb672b33e299a0d9b1bb6a90bbd07647, tras el squash de PR #123. **CI de referencia:** #585 (38065843516), job quality verde, 496 pruebas unitarias comunicadas y regresiones PostgreSQL/navegador.

> Este documento es una fotografía técnica de desarrollo, no una cualificación ni una validación GMP. Lo histórico debajo de docs/CURRENT_STATUS.md y docs/ROADMAP.md describe el estado de cada rama en su momento; no es un inventario de trabajo pendiente de hoy.

## Módulos: baseline funcional

| Módulo | Situación a 2026-10-10 | Salvaguardas y fronteras |
| --- | --- | --- |
| Desviaciones | Desarrollo funcional y regresión integrados | Borradores, bloques, versiones/anexos, documentos, relaciones e histórico; conservar formularios y reglas aprobadas. |
| CAPA | Desarrollo funcional y regresión integrados | Seguimientos y eficacia, emisiones por versión, PDFs; no convertir histórico legacy sin decisión. |
| Controles de Cambios | Desarrollo funcional y regresión integrados | Solicitud, Dictamen, tareas/seguimientos, documentos y estados propios. |
| Reclamaciones | R4A + regresión conjunta R4C integradas | Partes, anexos, relaciones con CAPA/Devoluciones; preservación legacy. |
| Devoluciones | R4B + regresión conjunta R4C integradas | Productos múltiples, anexos, archivo y reglas de destino/stock; conservar su modelo operativo. |
| Auditorías | R3/R4/R5/R6 y programas anuales #123 integrados | Internas/externas, hallazgos, seguimientos, relaciones, planes, emisión Word e histórico; Word en Office por aceptar. |
| PNT/documentación controlada | P1/P2/P3 y correcciones finales #120 integradas | Maestro, revisiones, evidencia externa, acceso documental, biblioteca e importación controlada; sin inferir aprobación ni vigencia de históricos. |

**Siete módulos integrados no equivalen a siete módulos cualificados para uso GMP.** Los cierres mencionados son hitos de desarrollo y revisión funcional; cualquier defecto futuro se gestionará como cambio/incidencia limitada, no como repetición general de módulos.

## Plataforma transversal ya disponible (confirmar su aplicación por módulo)

- Next.js, React/TypeScript, Prisma y PostgreSQL; monolito modular.
- QmsRecord, UUID estables, relaciones QMS permitidas, búsqueda/navegación entre expedientes y referencias históricas.
- Borradores, snapshots, versiones y documentos asociados; historial administrativo/operativo; permisos documentales específicos en PNT (no extrapolar a autorización global).
- Maestros de departamentos, catálogos, parámetros, formularios/versiones y reglas de vencimiento; bandejas de plazos. **Envío automático de avisos no activado.**
- Indicadores de los módulos y tendencias existentes; **dashboard global con tareas y navegación es ampliación nueva**.
- Plantillas controladas con checksum y generadores Word/Excel; emisión de Programas Anuales con snapshot y bytes inmutables en #123.
- Exportación lógica de demostración y verificación técnica: **no es todavía backup corporativo ni restauración operativa acreditada**.
- CI de desarrollo con tests, PostgreSQL y navegador, sin confundirla con pruebas formales de validación.

## Diferenciar implementado, comprobado y pendiente

| Asunto | Evidencia disponible | Estado pendiente |
| --- | --- | --- |
| Programas Anuales de Auditorías | PR #123, CI #585, pruebas con fuentes oficiales internas/externas y emisiones 00/01 | Verificar presencia de las plantillas en el entorno persistente de uso; aceptación del Word en Microsoft Word, firmas, tablas y paginación |
| Plantillas internas PMAI V04 / externas PMAE V05 | Instaladas/utilizadas en entornos de ensayo de PR #123 | No suponer instaladas en servidor futuro o en otro PostgreSQL |
| Índice documental PNT | Análisis privado de 39 hojas, 821 apariciones, 817 códigos únicos; importador y conciliación probados | No se acredita carga masiva definitiva ni verificación documental individual; acordar alcance y conciliar carga real |
| Registros históricos QMS | Importadores y pruebas documentadas de los primeros hitos | Inventario, procedencia, ensayo/reconciliación y aceptación de cada migración productiva |
| Seguridad | 4B1 (D-078, D-086): login con Entra ID de tenant único, admisión local, sesiones revocables, seis perfiles configurables y autorización por operación en servidor, probados con identidad sintética | Configuración real de Entra por IT (registro de la aplicación, credenciales, HTTPS); aceptación QA/DT de los perfiles y de la segregación de funciones |
| Integridad GMP | Versiones e historial; audit trail 4B3 (D-080 a D-082): captura en PostgreSQL de las 63 operaciones de los siete módulos, journal protegido, consulta, revisión y exportación | Aceptación QA/DT de la clasificación crítica, la periodicidad de revisión y la retención; custodia externa; validación |
| IT | Demostración y documentación técnica | Instalación, HTTPS, monitorización, retención, backup/restauración, respuesta ante incidencias y soporte |
| Firmas/aprobaciones | Algunas evidencias externas registradas; PDFs firmados archivados | No existe aprobación electrónica o firma GMP corporativa integrada y validada; diseñar futuro motor |
| Parche React/Next | #123 incorpora parche pnpm para renderer integrado en Next 15.5.26 y pruebas de regresión | Registrar dependencia y retirar únicamente tras actualización comprobada; ver CI_583_R4B_DIAGNOSIS.md |

## Backlog de producto priorizado y acotado

| Clave | Prioridad | Trabajo | Evidencia de aceptación |
| --- | --- | --- | --- |
| A0 | P0 | Consolidar baseline, decisiones, documentación y candidatos a PR obsoletas | Documentos coherentes; sin código, schema, plantillas ni funcionalidades modificadas |
| UX1 | P1 · **hecho** (#126) | Maquetar mejor filtros, indicadores y controles de listados **manteniendo diseño actual** | Comparativa visual por módulo a 1440/768/390; lógica/filtros intactos |
| UX2 | P1 · **hecho** (#128, #129, #130) | Mejorar retorno con filtros/página/pestaña, formularios y errores contextualizados | Pruebas de ida y vuelta, guardado explícito, sin autosave, bloqueo de concurrencia preservado |
| KPI1 | P1 · **hecho** (D1A #131, D1B #133, D1C; indicadores por módulo) | Dashboard QMS común con tareas, próximos/vencidos, tendencias y filtros | Definiciones de KPI auditables, cero doble conteo, drill-down con filtros conservados |
| BE1 | P1 · **Hecho: A, B y C** (D-112, D-113, D-114) | Medición de SQL/paginación, carga y custodia de documentos, errores/logs. A: ficheros fuera de las lecturas por defecto y medición de los ocho módulos; B: registro de errores; C: JIT desactivado y dos consultas reescritas, sin índices nuevos porque la medición no los justificó | Línea base antes/después, índices motivados y pruebas sin regresiones |
| CI1 | P1 · **aplazado** (D-115) | Selección de tests por impacto, paralelismo y diagnóstico, batería completa programada. Aplazado: la CI actual (todas las pruebas en ~9,5 min por PR) es suficiente; diseño de referencia en `docs/superpowers/specs/2026-10-20-ci1-ci-mas-rapida-design.md` | Ninguna regresión crítica retirada; CI verde y duraciones medibles |
| SEC1 | P0 antes de GMP · **implementación técnica hecha** (4B1, 4B3; D-078, D-080–D-082, D-086) | Identidad, RBAC, autorización servidor, segregación de funciones, audit trail según riesgos. Pendiente: configuración real de Entra por IT (con IT1) y aceptación QA/DT de perfiles, segregación de funciones, clasificación crítica, revisión y retención del audit trail | Pruebas positivas/negativas, revisión con QA/IT y controles documentados |
| IT1 | P0 antes de GMP | Servidor COVEX, configuración, HTTPS, backups, restauración, operaciones | Recuperación ejecutada, accesos, monitoreo y procedimiento aprobados |
| DATA1 | P0 antes de GMP | Conciliación y carga controlada de PNT/históricos; aceptación documental | Actas de reconciliación y aceptación Word, procedencia y cambios |
| INT1 | P2 | Alertas controladas, Teams/correo y SharePoint según IT | Consentimiento/roles, idempotencia de envíos, trazabilidad y gestión de fallos |
| VAL1 | P0 antes de GMP | URS, evaluación de riesgos, trazabilidad requisitos-pruebas y validación de uso | Evidencias aprobadas por responsables competentes antes de liberación |

Estado actualizado el 2026-10-20: UX1, UX2, KPI1 y BE1 están integrados en `main`. SEC1 tiene la implementación técnica hecha y queda pendiente de configuración por IT y aceptación QA/DT. CI1 queda aplazado (D-115). El resto sigue pendiente.

**P0 antes de GMP** indica requisito para uso regulado, no que bloquee el desarrollo paralelo del dashboard y la UX.

## Higiene de PR abiertas — inventario, NO cierre automático

A la fecha de corte hay ocho PR abiertas antiguas: **#11, #16, #17, #19, #20, #21, #76 y #112**. Todas deben tratarse como candidatas a obsoletas, no como ramas listas para fusionar.

- #11 (CC): contrastar con las PR posteriores de Controles de Cambios ya integradas.
- #16 y #17 (Hito 10.1): contrastar correcciones, relaciones y UX con la evolución transversal.
- #19, #20 y #21 (Hito 10.2): contrastar plantillas, anexos y campos frente a lo desarrollado después por cada módulo; podría haber diferencias que se deban documentar.
- #76: plan de revisión anterior, reemplazado en la práctica por revisiones y roadmap actual; candidato claro a cierre.
- #112: PNT P3C-2 alternativo; comparar explícitamente con #113, #115 y #120 antes de descartar alguna capacidad.

**Regla:** inspeccionar diff y cambios efectivos en main; registrar qué PR posterior sustituye cada una; cerrar solo si está cubierta o se rechaza expresamente, con comentario y enlace, **sin merge**. La PR A se limita a inventario y decisión; no cierra las ocho.

## Registro y verificación

Fuentes primarias: ramas y commits de GitHub, CI #585, PR #104 (R4C), #113/#115/#120 (PNT), #117/#119/#121/#122/#123 (Auditorías), documentos específicos de docs/. Revisar cambios posteriores a la fecha de corte antes de usar este inventario.

Documentos relacionados: ROADMAP.md (plan vigente), QMS_TARGET_ARCHITECTURE.md (arquitectura objetivo), DECISIONS.md (decisiones cerradas), CURRENT_STATUS.md (registro histórico).

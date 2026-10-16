# Roadmap vigente — COVEX Quality Manager V1 consolidación

**Aprobado conceptualmente:** 2026-10-10. **Baseline de desarrollo:** main 5194afe5, PR #123 integrada, CI #585 verde. Estado detallado y cautelas en [V1_BASELINE_AND_BACKLOG.md](V1_BASELINE_AND_BACKLOG.md); decisiones de arquitectura en [QMS_TARGET_ARCHITECTURE.md](QMS_TARGET_ARCHITECTURE.md).

> Este bloque sustituye como planificación activa a los hitos históricos de la parte inferior. **No** presupone validación GMP, instalación de plantillas en servidores futuros ni carga productiva de históricos.

## Principios de ejecución

- Los **siete módulos** (Desviaciones, CAPA, Controles de Cambios, Reclamaciones, Devoluciones, Auditorías y PNT) tienen desarrollo funcional integrado. No reabrirlos salvo defectos o ampliaciones concretas.
- **Mantener UI actual**, sin rediseño corporativo. Ajustar únicamente la maquetación de filtros/indicadores de los listados y aprobar comparativas visuales.
- UX adicional: navegación y retorno, búsqueda, filtros persistentes, vistas guardadas, ayudas, avisos de cambios pendientes y errores contextualizados. **Guardado siempre explícito, no autosave silencioso**.
- Dashboard global de Calidad, backend y CI más eficientes. Mantener la arquitectura monolítica modular y preparar extensibilidad, login, permisos, aprobaciones y firma **sin dar por implementado lo futuro**.
- Mantener transacciones, historial/versiones, documentos, datos históricos y semántica por PNT. Toda PR acotada, con pruebas y aceptación, sin merge automático.

## Fases de la siguiente etapa

| Fase | Entregable | Salida/criterios de aceptación |
| --- | --- | --- |
| **0 — Consolidación (PR A)** | Baseline, roadmap, decisiones, arquitectura objetivo e inventario de PR obsoletas | Solo documentación; fuente de verdad concordante con main, ningún comportamiento modificado; candidatas abiertas sin merge |
| **1 — UX transversal** | **PR B:** mejora de maquetación de filtros e indicadores de listados; **PR C:** navegación, errores, búsqueda y productividad | Capturas/recorridos 1440/768/390; mantener diseño, semántica, filtros y guardados; regresión por módulo |
| **2 — Dashboard global** | KPI definidos, vencimientos, acciones, tendencias, drill-down y filtros comunes | Conciliación de recuentos contra BD, reglas de exclusión/relaciones y pruebas de filtros |
| **3 — Backend y CI** | Medir SQL/volúmenes, optimizar paginación/documentos, errores, parches de dependencias y pipeline | Línea base vs resultados, seguridad/regresión inalteradas, CI por impacto + suite integral |
| **4 — IT, seguridad y arquitectura GMP** | Hosting corporativo, autenticación/autorización, roles, audit trail según riesgo, backup/restauración; diseño versionado de flujos/firmas futuras | Pruebas de acceso, recuperación y revisión por IT/QA. Trabajo desde el inicio en paralelo |
| **5 — Datos y aceptación documental** | PNT/históricos con alcance, conciliación y procedencia; plantillas oficiales por entorno; Word real | Actas de importación/conciliación, aceptación de tablas/paginación/firmas; no confundir con CI |
| **6 — Alertas e integraciones** | Notificaciones controladas, tareas, correo/Teams y SharePoint según necesidad/IT | Idempotencia, límites, trazabilidad de entregas, permisos y fallback; activación autorizada |
| **7 — Validación GMP e implantación** | URS, evaluación de riesgo, especificaciones, trazabilidad, pruebas formales, SOP, formación, liberación | Evidencias firmadas/aprobadas y decisión de uso operativo; no confundir con desarrollo concluido |

**Dependencias:** IT y seguridad deben diseñarse desde fases 0–3, no esperar a la fase 4. La producción GMP queda bloqueada hasta completar seguridad, datos, controles y validación pertinentes. UX/KPI/CI pueden avanzar en paralelo con preparación IT.

**Cierre técnico de Fase 3 (2026-10-12):** 3B1 y 3B2 integradas; 3B3 completa la CI modular y la regresión integral obligatoria, con PostgreSQL aislado, Chromium, PNT/R4C y gate por SHA satisfactorios. Evidencia, inventario y mediciones en [PHASE_3B3.md](PHASE_3B3.md), PR #138 abierta para revisión e integración, sin merge automático. Este cierre técnico no declara validación GMP ni uso productivo; no se inicia la Fase 4 ni implantación.

## Primeras PR acordadas

- **PR A (ahora):** consolidación documental y gobernanza, sin código, schema, migraciones, plantillas, workflows, dependencias ni acciones administrativas sobre PR antiguas.
- **PR B (posterior):** únicamente disposición y legibilidad de filtros e indicadores de listados, preservando estilos, lógica, responsive y componentes corporativos.
- **PR C (posterior):** retorno con filtros/página/pestaña, errores inline y estados de cambios; no modificar ciclo documental, firmas, plazos, obligaciones ni guardado explícito.

- **Contrato de módulo (aprobado 2026-10-16, D-083):** PR 1 documental con diseño y plan de migración en PR 2–5 sin cambio visible, más PR 2-bis para retirar el alta de relaciones de Control de Cambios y los tipos de relación sin uso. Véase [MODULE_CONTRACT.md](MODULE_CONTRACT.md). Cada PR de implementación mantiene su aprobación de alcance.

La evaluación de UX en Work/Codex precederá a B/C y se dividirá en cambios pequeños revisables. Dashboard y backend tendrán PR independientes según impacto.

---

## Cronología de desarrollo anterior (conservada como histórico)

El bloque siguiente describe objetivos y estados **en el momento en que se redactaron** y puede contener frases como «pendiente» o «PR abierta» ya superadas. No usarlo como backlog vigente; usar el apartado superior.


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


## R3 — Auditorías

R3A: expediente base, planificación, áreas, participantes, códigos AI/AE, listado, alta/edición/detalle, administración e historial. R3B: hallazgos persistentes, tratamiento y relaciones a Desviación/CAPA; sin mini-CAPA. R3C: informes/plantillas/documentos, versiones por emisión/revisión, Review y política de cierre. Plan Maestro anual posterior, no incluido en R3A.

## R3B — hallazgos, CAPA Plan y seguimiento

Implementación sobre R3A fusionado en main 27c8270: hallazgos/recomendaciones, criticidad, acciones locales, atribuciones a relaciones QMS y seguimiento. R3C conserva documentos/informe oficial, versionado por emisión/revisión, firmado/adjuntos, Review y cierre definitivo. Plan Maestro anual/alertas automáticas posteriores. Ver D-065 y docs/AUDITS_R3B.md.

## R3C — Auditorías: documentos, versiones, Review y cierre

Implementado sobre main R3A/R3B: informes por plantilla controlada, CAPA Plan, Plan externo real, recepción de documentos, snapshots 00/01+, PDF exacto, Review transversal y cierre por escenario con excepción proveedor. Validación técnica/CI y alcance en AUDITS_R3C.md; PR abierta para revisión, sin merge automático.

Bloques posteriores: Plan Maestro anual y alertas; fuera del cierre funcional R3C. Revisión manual de Calidad sobre formato/uso de documentos antes de producción controlada.


## R3D — regresión final y cierre funcional de Auditorías

Regresión integrada R3A/R3B/R3C sobre main cc097c1, cinco escenarios, documentos oficiales/QA, histórico, Review, cierre, relaciones, listados y concurrencia. Correcciones limitadas a defectos de archivo, altura/paginación CAPA Plan, mensaje UX e hidratación del banner administrativo (UTC explícito). Sin migración ni ampliación funcional. Auditorías **COMPLETADO** en alcance R3D: validación local y CI 37739441386 verdes, incluido R3A UI ×3 con regresión de medianoche UTC/Madrid. PR #101 abierta, sin merge ni squash. Criterios y evidencia en AUDITS_R3D.md. Plan Maestro anual/alertas posteriores; revisión documental visual en Office por Calidad antes del uso controlado.


## R4A — Reclamaciones funcional

Cierre funcional sobre Auditorías R3A–R3D. Se reutilizan versiones, PDF y Review; condiciones del PNT v03, acciones múltiples, relaciones UUID, documentos históricos y listado paginado. Detalle en COMPLAINTS_R4A.md. Después: Devoluciones funcional, regresión conjunta Reclamaciones↔Devoluciones y módulo PNT. La revisión UX/UI global queda aplazada hasta completar todos los módulos.


## Devoluciones R4B

R4B — Devoluciones: cierre funcional, seguimiento operativo (D-068), archivo de documentos, compatibilidad Reclamaciones/Review y QA. Sin rediseño global. Revisión UX/UI transversal final queda después de los cierres funcionales de módulos.

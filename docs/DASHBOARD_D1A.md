# D1A — Inventario real y contrato del Dashboard global QMS

**Estado:** análisis técnico/funcional, sin implementación. **Referencia:** `main` 6301267920d3de5a2b341cfd70814f786b6569d5 (PR #130 integrada). **Fecha:** 2026-10-11.  
**Repositorio:** `FMAcovex/covex-quality-manager`. **Alcance:** siete módulos, con métricas compartidas únicamente cuando tengan idéntica definición.  
**Limitación:** inventario de código y documentación del repositorio; NO se han leído, conciliado ni alterado los registros reales de la base persistente de Codespaces. Las cifras reales son objeto de la prueba de D1B.

## 1. Hallazgos verificados en `main`

| Módulo | Indicadores existentes | Fuente concreta y límites |
| --- | --- | --- |
| Desviaciones | Total de cohorte, abiertas actuales, clasificación, CAPA, recurrencia, afectación PT, cierres <=30 días, mediana, completitud y tendencia quinquenal | `src/modules/deviations/analytics/{queries,domain}.ts`, `docs/DEVIATION_KPI_DEFINITIONS.md`; `/deviations/indicators`. Usa `includeInKpi=true`, `qmsRecord.isActive=true` y excluye `DRAFT`. |
| CAPA | Cohorte, abiertas, correctivas/preventivas, canceladas, ejecución en plazo y mediana, eficacia, seguimiento pendiente y tendencia quinquenal | `src/modules/capa/analytics/{queries,domain}.ts`, `docs/CAPA_KPI_DEFINITIONS.md`; `/capa/indicators`. Exclusiones anteriores y dos cierres diferentes: operativo y eficacia. |
| Controles de cambios | Cohorte, abiertas, mayor/menor, ejecución en plazo, eficacia y tendencia quinquenal | `src/modules/change-control/analytics/{queries,domain}.ts`; `/changes/indicators`. Filtra `includeInKpi`, activos, no `DRAFT`. Fechas de ejecución y cierre efectivo independientes. |
| Reclamaciones | Cohorte, cliente/proveedor, abiertas/cerradas, clasificación, recurrencia, Parte II/eficacia pendiente, seguimiento vencido y tendencia quinquenal | `src/modules/complaints/analytics/queries.ts`; `/complaints/indicators`. Fechas de cierre y apertura; `status` propio. |
| Devoluciones | Cohorte, abiertas, decisión aceptada/rechazada/pendiente, tipos, productos, mediana y tendencia quinquenal | `src/modules/returns/analytics/queries.ts`; `/returns/indicators`. **Una devolución puede tener varios productos**: `productTypes` no cuenta expedientes. |
| Auditorías | Listado operativo R3/R4 con estado, tipo, escenario, planificación, hallazgos, acciones pendientes, próximas revisiones y filtros | `src/modules/audits/queries.ts`, `src/modules/audits/domain.ts`, `src/modules/audits/plans.ts`; `/audits`, `/audits/plans`. **No hay una ruta `/audits/indicators` ni un motor de tendencias equivalente al de los cinco módulos.** |
| PNT / documentación controlada | Recuento de procedimientos (maestros únicos), revisiones y filas; filtros de revisión vigente, pendiente, vencida, fecha ausente y sin verificar | `src/modules/controlled-documents/{listing,queries}.ts`; `/controlled-documents`. **Maestro ≠ revisión ≠ fila**; `quick=overdue` exige revisión `IN_FORCE` y `reviewDueAt < hoy`, fecha efectiva según `operationalDates`. No hay motor de KPI quinquenal específico. |

Pantalla inicial actual: `src/app/page.tsx` es un directorio de módulos y conserva advertencia de versión piloto. D1B deberá añadir una vista operativa sin perder ese acceso ni afirmar validación GMP.

### Bandeja y contadores operativos

- `src/modules/configuration/admin-queries.ts:getAlertPreview` devuelve `rules` y `items` con `key, ruleKey, module, businessCode, label, dueDate, state, href, detail`; ordenados por vencimiento; se usa en `/settings/alerts`. **No envía notificaciones**.
- Reglas verificadas en ese servicio: `CAPA_FOLLOWUP_DUE`, `CAPA_EFFECTIVENESS_PENDING`, `CHANGE_FOLLOWUP_DUE`, `CHANGE_PLANNED_EXECUTION_DUE`, `COMPLAINT_FOLLOWUP_DUE`, `RETURN_FOLLOWUP_DUE`. No aparecen en el servicio reglas equivalentes de Desviaciones, Auditorías o PNT. Su contenido no debe presentarse como «todos los vencimientos del QMS».
- `getDeviationList`, `getCapaList`, `getChangeControlList`, `getComplaintList` y `getReturnList` ya devuelven contadores (borradores, abiertos, pendientes y otros), pero **no todos tienen el mismo filtro ni idéntica fecha fuente**.
- Algunos listados cargan un máximo de 300 filas para la tabla; **los indicadores globales no deben calcularse a partir de esas filas**. Los `count` Prisma o agregados dedicados han de abarcar la población correspondiente.
- Los contadores de listados y los KPI no son intercambiables: los contadores operativos incluyen categorías o borradores cuando corresponde y los KPI suelen usar `includeInKpi` y excluir borradores.

## 2. Contrato de métricas para D1B

**Dos capas visibles con denominadores explícitos**; nunca una única tarjeta de «total QMS» que sume expedientes, PNT, hallazgos, acciones y productos.

**A. Estado actual (operativo):** número de expedientes por módulo y estado real, tomado de la entidad específica (Deviation/Capa/ChangeControl/Complaint/ReturnRecord/Audit). Clave de deduplicación: UUID del expediente, preferentemente `qmsRecordId` donde exista; una relación `QmsRelation` activa **no crea otro expediente**. Excluir por defecto `qmsRecord.isActive=false`; mostrar los borradores como categoría separada, jamás mezclados con abiertos. CAPA `CLOSED` con eficacia pendiente es una categoría transversal de *acción pendiente*, **no una CAPA OPEN**. Los estados `CANCELLED`, `DRAFT`, `OPEN`, `CLOSED` y estados documentales propios no se fuerzan a un enum universal. Un expediente puede contribuir a más de un indicador temático (p.ej., abierto y vencido): **no sumar las tarjetas entre sí**.

**B. Tendencias históricas (KPI):** reutilizar por módulo los cálculos y exclusiones documentados; no reconstruir ratios agregando porcentajes ya redondeados. Año de apertura (`qmsRecord.year` y fallback previsto) para cohortes; año de cierre/ejecución/eficacia según el indicador específico. Un expediente abierto en 2025 y cerrado en 2026 puede aparecer en volumen de 2025 y cierres de 2026, sin duplicación. El resultado debe incluir `year`, `dataAvailable` y los numeradores/denominadores cuando procedan. Si `dataAvailable=false`, presentar **«Sin datos»** y línea interrumpida; cero solamente con cobertura confirmada.

**Año para Auditorías:** antes de agregar gráficos decidir si la cohorte es `qmsRecord.year` (año de codificación) o fecha operativa; la consulta de listados ya filtra por `qmsRecord.year`. Separar *programa anual planificado* (AuditAnnualPlan/AuditPlanEntry), *auditoría ejecutada* (Audit) y *hallazgos/acciones*; una entrada del plan no es una auditoría nueva. Contar hallazgos activos y acciones activas sin duplicar por relaciones.

**PNT:** apartado documental separado con métricas actuales por **maestro único**, revisiones y estado de revisión; no asimilar revisiones a expedientes QMS ni imponer filtro de año genérico sobre maestro. Para tarjetas «por revisar» y «vencidas», replicar la lógica de `operationalDates`/`matchesQuickFilter` y definir si la presentación es *revisión* o *PNT único*: ambas cifras no son intercambiables. Fechas o verificación no documentada no equivalen a vigencia acreditada.

**Fecha y vencimiento:** una fecha futura sin verificación constituye *próximo seguimiento*, no automáticamente incumplimiento GMP. Definir una fecha de corte única `asOf` en UTC para consulta y normalizar fechas `@db.Date` por día, no usando horas locales variables. Mantener la distinción `OVERDUE` (fecha < hoy) y `UPCOMING` (hasta preaviso configurado); los vencimientos del día no están ya vencidos. «Eficacia pendiente» sin fecha límite evaluable se mantiene como pendiente, **no debe inventarse una fecha vencida**.

## 3. Riesgos concretos que D1B debe resolver

| Riesgo | Evidencia localizada | Decisión para D1B |
| --- | --- | --- |
| Cobertura incompleta de alertas | `getAlertPreview` cubre seis tipos de regla entre cuatro módulos | Reutilizar el servicio sin presentarlo como cobertura total y añadir adaptadores explícitos para desviaciones, auditorías y PNT (o etiquetar «pendiente de ampliar» hasta completar). |
| Inconsistencia de fuentes de próximas fechas | CAPA: lista usa `capa.nextFollowupDate`, alertas usan último `followup.nextFollowupDate`; Reclamación lista usa `complaint.nextFollowupDate`, alertas usan último `followup.nextFollowupDate` | Conciliar en fixtures cuál representa la obligación vigente; no sumar ambos ni suponer equivalencia; no modificar reglas GMP sin decisión específica. |
| Recuento de alertas administrativamente retiradas | Varias consultas de `getAlertPreview` restringen estado, pero no expresan `qmsRecord.isActive=true` | Probar explícitamente anulados y resolver filtrado en el adaptador/servicio antes de usarlo como contador global. |
| Enlace de alerta a pestaña | El motor construye URLs con `tab=followups`, `tab=effectiveness` y otros valores | Contrastar con pestañas válidas reales de cada módulo; enlaces directos por UUID y navegación a la sección operativa correcta. |
| KPI vs recuentos de listado | KPI usan `includeInKpi` y excluyen DRAFT; contadores de listados calculan otros universos | Etiquetar denominador y alcance; reconciliar consultas por módulo bajo la misma selección administrativa y estado. |
| Capacidad histórica desigual | Desviaciones/CAPA usan `HistoricalImportBatch` para cobertura; CC/Reclamaciones/Devoluciones usan años encontrados en `QmsRecord` | Diseñar `dataAvailable` explícito por fuente; no afirmar que un año ausente se ha verificado a cero. |
| Producto/PNT/hallazgos son 1:N | Productos de devolución, revisiones PNT, hallazgos de auditoría, acciones y versiones | Agregados separados, `countDistinct`/ID estable y tests de cardinalidad. |
| Rendimiento de página inicial | Algunos motores `findMany` cargan poblaciones completas en memoria; PNT realiza ensamblado en memoria | No invocar los cinco motores completos más siete listados en cada render de Home. Utilizar consultas de conteo y proyecciones pequeñas, y medir latencia/SQL antes de introducir cachés. |
| Ausencia de identidad/roles globales | `docs/V1_BASELINE_AND_BACKLOG.md`, `docs/QMS_TARGET_ARCHITECTURE.md` | No inventar «mis tareas», responsable autenticado ni permisos granulares. Presentar «Tareas del sistema» hasta disponer de autenticación y autorización. |

Estos son **riesgos/contratos de integración detectados por lectura del código**, no defectos GMP demostrados ni cambios autorizados de reglas operativas.

## 4. Contrato de consulta y filtros comunes propuesto

Una capa nueva `src/modules/dashboard/`, de solo lectura, expondrá como propuesta:
- `DashboardFilters`: `year?: number`, `departmentIds?: string[]`, `moduleTypes?: QmsRecordType[]`, `state?: "OPEN"|"CLOSED"|"DRAFT"|"ALL"` para la vista operativa **solo cuando la categoría tenga significado real**, `asOf: Date`, `taskView?: "overdue"|"upcoming"|"pending"|"all"`.
- `DashboardSummary`: `asOf`, `cards` con `module`, `metricKey`, `label`, `value:number|null`, `population`, `dataAvailable`, `href`; `tasks` con `key` estable, `module`, `recordId`, `businessCode`, `dueAt` opcional, `category`, `state`, `href`; `trends` por módulo y año.
- Aplicar filtros en el **backend** con parámetros validados, nunca solo visualmente. `year` de tendencias = cohorte; en tarjetas actuales distinguir «total actual» de «abiertos del año seleccionado». Los PNT no heredan sin más `year` de los expedientes.
- Para departamento: módulos de expediente usan `departmentId`; Auditorías admiten varios departamentos activos (evitar duplicación cuando se filtra por varios); PNT usan el maestro/snapshot según la consulta vigente. Los registros sin departamento requieren categoría explícita y decisión visible.
- Navegación: URL local verificada al listado o detalle real; preservar filtros mediante los componentes de C1/C2, pero no generar URLs hacia filtros que el módulo no acepta; nunca aceptar redirección externa. Para tarjetas de tendencia sin filtro equivalente, dirigir al módulo con un filtro soportado y documentar el alcance.
- El servicio será **server-only**; respuesta serializable sin binarios DOCX/PDF, anexos ni secretos. No crear nuevas tablas en D1B salvo necesidad justificada; no alterar `QmsRecordVersion` ni documentos firmados.
- Una tarea única se identifica con `module + recordId + category + sourceId` cuando corresponda. Un mismo expediente puede tener dos obligaciones diferentes (p.ej. seguimiento y eficacia), pero **la tarjeta «expedientes afectados» debe contar UUID distintos**.

## 5. Diseño funcional propuesto, respetando la UI actual

1. **Cabecera de Inicio:** mantener título corporativo, estado piloto y accesos a los siete módulos (PNT y Auditorías incluidos).
2. **Tarjetas operativas:** expedientes abiertos por módulo, eficacia pendiente (CAPA/CC cuando proceda), tareas vencidas, tareas próximas, sin sumar categorías heterogéneas.
3. **Bandeja de trabajo:** orden por vencimiento y módulo; código enlazado al detalle; fecha, categoría, estado, regla/fuente; filtros y paginación, no solo top-N sin acceso al resto. «Tareas del sistema», no «Mis tareas».
4. **Tendencias:** selector de año y evolución de cinco años de los cinco motores existentes; Auditorías y PNT con sus indicadores específicos, sin fingir series que el código actual no respalda.
5. **Drill-down:** cada tarjeta conduce al listado filtrado cuando existe filtro equivalente; de lo contrario, a una vista dedicada que aplique exactamente el mismo predicado.
6. **Estados vacíos y errores:** «Sin datos» histórico; «0» real; «No disponible por falta de configuración» para fuentes o reglas faltantes; no ocultar módulos sin datos.
7. **Responsive:** revisar 1440, 768 y 390 px, conservando estilos, sidebar y semántica accesible.

## 6. D1B — Plan técnico por PR (propuesta, no ejecutada)

| Bloque | Cambio | Evidencia requerida |
| --- | --- | --- |
| D1B-1 (datos) | `src/modules/dashboard/{types,queries,metrics,deadline-adapters}.ts`; consultas agregadas, catálogo de indicadores, normalización de fechas y exclusiones | Unitarias de semántica; PostgreSQL con registros activos/anulados/borradores, cohortes 2025/2026, retornos 1:N, CAPA vinculada a múltiples orígenes, revisión PNT múltiple y auditoría multiárea. |
| D1B-2 (experiencia) | `src/app/page.tsx` + componentes mínimos de `src/modules/dashboard/components`; filtros y accesos existentes intactos | Smoke de navegador: tarjetas, cero/sin datos, filtros, navegación con UUID y parámetros, errores, 1440/768/390, sin hidratación. |
| D1B-3 (regresión y rendimiento) | Conciliación independiente de indicadores, pruebas de «as of», rendimiento y revisión QA de definiciones pendientes | CI verde en último commit; diferencias documentadas; duración de consultas y tiempo de render medidos; sin cambios de documentos/versionado. |

### Matriz mínima de conciliación

1. El total de operativos por módulo coincide con `count` independiente de su tabla y estado, excluyendo anulados; borradores no se mezclan.
2. Varias relaciones de una misma CAPA y varios productos de devolución **no** alteran el número de expedientes.
3. «Pendiente de eficacia» se concilia contra fecha, estado y definición de cada módulo; no se convierte en abierto.
4. Un expediente 2025 cerrado 2026 figura una sola vez en cohorte 2025 y en la métrica de cierre de 2026 que le corresponda.
5. `includeInKpi=false` excluye KPI pero no necesariamente un recuento operativo: ambas poblaciones se informan explícitamente.
6. Año sin cobertura presenta «Sin datos»; cohorte con cobertura y cero registros presenta «0».
7. Fecha de hoy = **no vencida**; ayer = vencida; próximo dentro del preaviso = próximo. Verificar zona horaria y fechas `@db.Date`.
8. Auditoría con dos departamentos se cuenta una vez; plan anual sin auditoría no genera auditoría ficticia.
9. PNT con tres revisiones se cuenta como un maestro, tres revisiones y, según vista, número de filas distinto; estado de vigencia de revisión según función existente.
10. Bandeja y tarjeta concuerdan en número de tareas con los mismos filtros; cada enlace lleva a expediente/sección verdadera.
11. Verificación cruzada con los cinco indicadores actuales, sin reemplazarlos ni cambiar su fórmula.
12. CI completa para la PR funcional final; no proclamar validación GMP por una CI verde.

## 7. Eficiencia de CI en D1A y futuro

**D1A es exclusivamente Markdown en `docs/`**. `.github/scripts/controlled_document_scope.py` reconoce `docs/*.md` como `docs_only`; el job `scope` debe pasar y los jobs funcionales (`quality`, PNT, navegador) quedan omitidos **por regla de alcance ya existente**, sin modificar workflow. No es una ejecución de software ni acredita que D1B funcione.

Para D1B-1/2: verificar *antes* de abrir PR sintaxis/tipos/unitarias focalizadas; CI seguirá ejecutando controles aplicables a código. La optimización de CI por impacto/parallelización pertenece a la fase CI1 del roadmap; **no desactivar smokes críticos**. Mantener cada commit acotado y no rerun sin causa.

## 8. Decisiones aún pendientes de QA / aceptación antes de D1B

- Prioridad de las tarjetas y selección inicial de año (¿año actual o última cohorte con datos?). Recomendación UX: año actual para operaciones y año seleccionado explícito para tendencias.
- Significado del año de «Auditorías realizadas» vs «programadas», y cuál será indicador principal.
- Regla efectiva de próximas fechas cuando el campo principal y el último seguimiento difieran; analizar histórico antes de decidir o corregir.
- Inclusión y granularidad de PNT: maestro vigente / revisiones vigentes / pendientes de verificación, distinguiendo registro histórico no verificado.
- Fuente y tratamiento de vencimientos de Desviaciones, Auditorías y PNT; no atribuirles la cobertura del motor actual.
- Filtros por departamento en expedientes sin departamento y en Auditorías multiárea; evitar exclusiones silenciosas.

**Criterio de salida D1A:** inventario y diferencias rastreables a código; contrato propuesto y límites de fuente; pruebas de D1B especificadas; **cero código, migraciones o cambios de datos**. D1A no autoriza automáticamente D1B ni constituye aceptación documental GMP.

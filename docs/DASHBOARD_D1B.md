# D1B — Dashboard global QMS (datos + interfaz + regresión)

**Rama:** `feature/dashboard-d1b-full` sobre D1A integrado (PR #131).  
**Tipo:** ampliación de lectura del inicio, sin cambio de schema/Prisma, datos, PNT, workflows ni documentos.

## Alcance entregado

- Portada con siete módulos: Desviaciones, CAPA, Controles de Cambios, Reclamaciones, Devoluciones, Auditorías y PNT.
- Recuentos actuales (activos administrativamente), separados por abierto, borrador y cierre; PNT por maestros y revisiones.
- Tareas fechadas: motor configurado existente `getAlertPreview` + revisiones pendientes de Desviaciones/Auditorías/PNT, sin enviar notificaciones. Se comprueba `isActive`/departamento en las tareas del motor antes de mostrarlas.
- Tendencia quinquenal de la **cohorte de apertura** en los cinco módulos con motor KPI propio; se reutilizan sus `get*Analytics` y `dataAvailable`, mostrando «s/d» cuando no hay cobertura. Para Auditorías y PNT no se inventa una tendencia no homologada.
- Filtros por módulo de tendencia/bandeja, departamento, año de tendencia y tipo de vencimiento; paginación de tareas; enlaces a expediente o listado.
- Instrumentación `getDashboard().durationMs` y smoke Playwright que registra tiempos de navegación, realiza capturas 1440/768/390.

## Contrato de recuentos

| Campo | Regla |
| --- | --- |
| `status.grouped[].total` | GroupBy por entidad; excluye registros administrativamente anulados `qmsRecord.isActive=false`. No aplica el filtro de KPI `includeInKpi`, distinto del total de tendencias. |
| `status.grouped[].open` | `status=OPEN` en los cinco expedientes y Auditorías; para PNT maestros con estado `ACTIVE`. |
| `status.grouped[].drafts` | `DRAFT` específico de cada tabla, no se contabiliza como abierto. |
| `status.capaEfficacy` | CAPA cerrada operativamente, eficacia PENDING, sin cierre efectivo; pendiente no es abierta. |
| `status.changeEfficacy` | CC abierta con ejecución realizada y eficacia pendiente. |
| `status.pnt.masters` | Maestro no anulado (incluye borradores de registro). |
| `status.pnt.revisions` | Total de revisiones de maestros no anulados, independiente de maestros. |
| `status.pnt.inForce` | Revisiones `IN_FORCE` asociadas a maestro `ACTIVE`, **estado registrado, no acreditación independiente de vigencia**. |
| `trend` | Servicio de analytics existente según módulo seleccionado; año de cohorte y reglas individuales. «s/d» = sin cobertura histórica; 0 = cero con cobertura. |
| `tasks` | Obligaciones fechadas únicas por módulo/registro/regla. Un expediente puede tener >1 obligación, pero no se duplica dentro de la misma regla. La fecha de hoy es UPCOMING, fecha anterior OVERDUE (UTC). |

**Advertencias:** `CAPA/CC eficacia pendiente` no equivale a una tarea vencida; no se ha inventado un plazo de eficacia. El motor de alertas solo cubre reglas activas configuradas; Desviaciones, Auditorías y PNT utilizan adaptadores de fechas existentes. Una auditoría puede pertenecer a varios departamentos, pero solo se agrega una vez. El filtro `year` se aplica exclusivamente a la tendencia y no altera los recuentos operativos actuales.

**Diferencia de alcance entre módulos:** el bloque PNT no utiliza la lógica de estados de expedientes QMS. Las fuentes de próximo seguimiento permanecen las ya definidas en cada módulo (p.ej., alertas de último seguimiento). No se modifica la semántica GMP ni se reescriben expedientes.

## Pruebas

- `src/modules/dashboard/domain.test.ts`: filtros, fecha UTC, vencida vs hoy, deduplicación y paginación, cobertura «s/d», conteos agrupados.
- `scripts/smoke-dashboard-d1b.ts`: fixtures de prueba aislados por UUID, comprobación de siete módulos/activo/anulado, eficacia CAPA/CC, dos revisiones de un maestro, auditoría multiárea, seguimientos fechados y enlaces; limpieza únicamente de fixtures propias. Requiere `APP_ENV=test`.
- `scripts/smoke-dashboard-d1b-ui.ts`: Playwright real: portada, tarjetas, selector de módulo, lista de tareas, cambio de filtros, tendencia sin cobertura en Auditorías/PNT, responsive 1440/768/390, errores de hidratación y tiempos.
- CI: comprobaciones rápidas de tipos/lint antes de PostgreSQL. Los smokes D1B van al principio de las suites para detectar regresiones afectadas sin esperar a todos los casos previos. Todas las regresiones preexistentes se mantienen. Artefacto `dashboard-d1b-responsive`.

## Límites y próximos pasos

La consulta usa agregados `groupBy/count` para los contadores. El módulo seleccionado carga su motor de analytics; no se ejecutan los cinco a la vez. La bandeja de tareas de prueba reusa el servicio `getAlertPreview`; con históricos voluminosos será necesaria paginación SQL/medición adicional, sin cambiar la definición de alertas. **No se ha establecido una cifra p95 de producción**, puesto que no se ha perfilado carga representativa de COVEX.

No existe autenticación corporativa RBAC ni identidad segura: la bandeja es **«Tareas del sistema»**, no «mis tareas». Una CI verde es evidencia de desarrollo, no validación GMP. Mantener aprobación QA/DT e IT pendiente para implantación.

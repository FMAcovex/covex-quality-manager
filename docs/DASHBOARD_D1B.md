# D1B — Dashboard global QMS (datos + interfaz + regresión)

**Base:** `main` posterior a D1A (#131). **Tipo:** hito de desarrollo, no validación GMP. **Implementación:** una sola rama y PR para D1B-1 / D1B-2 / D1B-3.

## Alcance técnico

- `src/modules/dashboard/domain.ts`: contratos, estados, fechas por día UTC, claves de tarea, filtros válidos y normalización de series.
- `src/modules/dashboard/queries.ts`: sólo lectura; seis consultas `groupBy` para expedientes activos completos, recuentos de eficacia, proyección documental de la revisión más reciente e identificación independiente de la revisión en vigor, catálogo de departamentos y composición de tareas y tendencias.
- `src/app/page.tsx` y `src/app/dashboard.css`: cabecera corporativa y advertencia piloto conservadas, filtros de año de cohorte/departamento/módulo/estado/plazos, tarjetas, cinco años, bandeja paginada, vínculos, siete accesos y estilos responsive.
- KPI quinquenales: se consulta **sólo el motor del módulo elegido**, reutilizando `getDeviationAnalytics`, `getCapaAnalytics`, `getChangeAnalytics`, `getComplaintAnalytics` o `getReturnAnalytics`. No se recalculan nuevas fórmulas de recurrencia, eficacia o tiempos.
- Auditorías: expedientes reales por estado; revisión con fecha por último seguimiento **para cada ámbito activo**; multiárea sin doble conteo mediante `groupBy`.
- Documentación controlada: maestros no anulados, revisiones, última revisión por maestro y revisión en vigor para vencimientos, según `operationalDates`/`matchesQuickFilter`. No interpreta `UNVERIFIED` como aprobación.
- Bandeja: fusiona reglas existentes `getAlertPreview` (filtrando expedientes activos y la selección de cohorte/departamento) con seguimiento de Desviaciones, Auditorías y revisión documental en ventana de 30 días. **No se envían avisos** ni se crea identidad de usuario. Las reglas configurables vigentes conservan su propio preaviso.
- Registros y relaciones: los estados se consultan en cada tabla sin unir productos, acciones, versiones o relaciones. La presencia de más de un producto, departamento, origen CAPA o seguimiento no duplica la tarjeta «expedientes». La bandeja sí contiene obligaciones distintas del mismo expediente y las diferencia por clave.
- Los listados de destino mantienen sus parámetros admitidos para año, departamento y estado; el retorno de los expedientes sigue bajo C1/C2.

## Definiciones visibles y límites

1. «Expedientes operativos» = suma de seis módulos, con `qmsRecord.isActive=true`, excluyendo borradores y CAPA canceladas; no incluye PNT. «Abiertos» y «borradores» se presentan aparte. Los valores se calculan sobre **toda** la población, no las páginas o top-300 de listados.
2. «Eficacia pendiente» = CAPA con cierre operativo (`CLOSED`) y eficacia `PENDING` sin cierre efectivo + CC abierto, ejecución `EXECUTED`, eficacia `PENDING`. Son dos poblaciones, no un estado universal.
3. «Tareas con fecha» = obligaciones obtenidas por reglas de alerta configuradas, último seguimiento de Desviaciones, revisión de Auditorías por ámbito y revisión vigente de la última versión PNT. No equivale al universo de todas las acciones pendientes ni a «mis tareas». La fecha de hoy es próxima; fecha anterior, vencida. Los últimos tres orígenes sin regla usan una ventana visible de 30 días.
4. En PNT los recuentos son maestros únicos y revisiones; el filtro `year` no se aplica a maestros (son otra entidad). La bandeja PNT utiliza la última revisión **en vigor**, aunque exista una revisión posterior en borrador, sin incluir obsoletas; la página de listados permite inspeccionar todas las revisiones.
5. Las tendencias de cinco años usan **los motores previos** (población `includeInKpi=true`, activos y no borradores), distinguen `dataAvailable=false` («Sin datos») de año cubierto con cero. Auditorías y PNT no muestran una tendencia quinquenal artificial hasta definir sus cohortes formalmente.
6. El campo «Estado del expediente» controla el valor principal y el enlace filtrado de las tarjetas; los detalles y las obligaciones conservan su semántica operativa propia. «Módulo», «Año» y «Departamento» aplican a expedientes y tareas; PNT no utiliza la cohorte temporal de QMS.
7. Los recuentos de las cinco tarjetas no son mutuamente excluyentes: una CAPA abierta puede además estar vencida; una CAPA cerrada operativamente puede tener eficacia pendiente.

## Pruebas automatizadas y eficiencia de CI

| Prueba | Qué acredita |
| --- | --- |
| `src/modules/dashboard/domain.test.ts` (Vitest) | DRAFT/CLOSED/OPEN/CANCELLED, UTC antes/hoy/después, límite de 30 días, univocidad por obligación, cero/sin cobertura, filtros/URL |
| `pnpm dashboard-d1b:smoke` (PostgreSQL de CI **aislado**) | alta sintética protegida por `APP_ENV=test`, exclusión de anulados, relaciones 2 Desviaciones→1 CAPA, 2 productos→1 devolución, 1 auditoría en dos departamentos, borradores, revisión PNT en vigor vencida aunque exista borrador posterior; limpieza de todos los UUID creados |
| `pnpm dashboard-d1b:ui:smoke` (Playwright) | seis cuentas de abiertas cotejadas con consultas independientes y maestro documental independiente, 7 tarjetas, filtro de módulo/estado, navegación al listado, fechas/cobertura, URLs locales, responsive 1440/768/390, errores de hidratación |

**Orden:** la CI realiza el smoke PostgreSQL D1B justo después de migración y seed, antes del resto de scripts de integración; el browser smoke D1B se ejecuta primero en su etapa, antes del resto de regresiones. No se elimina ningún job ni comprobación existente; el `Fast source and TypeScript gate` de C3 permanece y ejecuta primero Vitest del dashboard. La concurrencia cancela únicamente ejecuciones obsoletas de la misma PR.

**Seguridad:** no se modifican schema Prisma, migraciones, datos históricos, fórmulas de KPI, PNT, plantillas, hashes, archivos ni permisos; en el dashboard no hay Server Actions de escritura. Solo se usan datos estructurados y referencias internas.

## Validación posterior

- Revisar capturas reales y métricas de ejecución en Codespaces a 1440/768/390.
- Confrontar tarjetas, estados y tareas del entorno representativo con expediente fuente; declarar faltas de cobertura documental o alertas si las hay.
- Revisión de QA para definir si «realizada» en Auditorías se asocia a `performedDate` o estado documental y si añadir KPI propio de PNT.
- Medir SQL/latencia con volúmenes crecientes. La duración presentada es **tiempo de preparación del panel**, no un percentil de carga.
- No considerar el resultado como validación/cualificación GMP ni instalación de producción.

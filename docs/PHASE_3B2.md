# Fase 3B2 — Dashboard, selección PNT y metadatos documentales

Base: main `6745212383b1ab8def20dca418ee417115036acc` (3B1, PR #136).
Rama: `feature/phase3b2-dashboard-pnt-documents`. Una única PR para revisión, sin squash ni merge. Sin avance a 3B3.

## Dashboard

Las alertas reciben el alcance del Dashboard (activo/año/departamento/módulo) antes de consultar. Se eliminan las cuatro listas completas de identificadores usadas como filtro posterior. Los lectores de alertas seleccionan identidad, fecha y descripción necesarias; los últimos seguimientos se obtienen con consultas laterales y sus órdenes originales. El lector administrativo sin alcance conserva sus reglas y metadatos.

Desviaciones selecciona el último seguimiento antes de aplicar la ventana de 30 días. Auditorías selecciona el último seguimiento **por ámbito**, incluyendo GENERAL, y después aplica la fecha: un último valor nulo borra ese ámbito, sin restaurar fechas anteriores ni ocultar un hallazgo activo. Se excluyen hallazgos retirados y referencias ajenas al expediente.

La tendencia del Dashboard agrega exclusivamente las aperturas que ya mostraba `countTrend`, sin calcular todo el informe analítico de cada módulo. Conserva `includeInKpi`, exclusión de borradores/anulados, departamento, año del QmsRecord con fallback a fecha de apertura y cobertura histórica. La cobertura de Desviaciones sigue incluyendo los lotes aplicados como antes; CAPA conserva su alcance específico. Las analíticas de módulos y sus denominadores permanecen intactos.

Se mantienen los siete módulos, cinco KPI, eficacia pendiente, PNT independiente del año QMS, filtros, páginas/enlaces y D1C. Los totales PNT siguen distinguiendo última revisión de revisión en vigor; 00 vigente + 01 borrador conserva la obligación de 00.

**Límite deliberado:** la bandeja conserva `uniqueSortedTasks` y su paginación final en memoria, sobre tareas compactas y previamente restringidas. No se sustituye el comparador español ni su deduplicación por una colación SQL no demostrada. La mejora está en los datos recuperados y el cálculo previo, sin alterar el orden aprobado.

## PNT

`listing.ts` usa una selección parametrizada en PostgreSQL para búsqueda, departamento/estado maestro, vista todas/última, revisión/estado documental, plazos, fechas y filtros rápidos. La última revisión se selecciona **antes** de filtrar su estado; no se sustituye por la última revisión que cumple el filtro.

La existencia de lifecycle da prioridad a **sus valores, incluso nulos**. No se usa COALESCE para recuperar fechas antiguas. Se conserva la diferencia entre `due` (incluye hoy) y `overdue` (anterior a hoy), ventana inclusiva de 30 días, búsqueda en referencias de cualquier revisión y maestros sin revisiones cuando no hay restricciones documentales.

Los tres recuentos completos se calculan en SQL: filas, maestros distintos y revisiones. Se recuperan claves compactas de ordenación y solo se hidratan los maestros/revisiones de las 25 filas seleccionadas. Metadatos de origen se cargan únicamente para esas filas. La exportación usa la misma selección sin el límite de página. Una transacción RepeatableRead mantiene coherencia entre recuentos, selección y datos de página, sin caché.

**Límite deliberado:** ordenación y corte de claves compactas siguen usando `Intl.Collator("es", { numeric: true, sensitivity: "base" })`. No se introduce una colación ni DDL. La instalación PostgreSQL no garantiza igualdad con ese comparador en todos los títulos/códigos. Por ello **no se declara una paginación íntegramente SQL**: filtros/recuentos sí se trasladan; el orden exacto y la selección de la página de claves permanecen en memoria. Fechas vacías continúan al final en ambos sentidos y se conservan todos los desempates. No se materializan todos los maestros/revisiones completos para mostrar una página.

## Documentos

`getComplaintDetail` y `getReturnDetail` obtienen metadatos de documentos de versiones y plantillas asignadas, sin `fileData`. Reclamaciones también limita generaciones a metadatos. Los catálogos de plantillas de ambos módulos usan la misma proyección. Devoluciones conserva la proyección documental histórica que ya tenía.

Se conservan todos los campos documentales anteriormente disponibles en cada vista: UUID/tipo, versión, nombre/MIME/tamaño cuando estaba disponible, autor/fecha, checksum y referencias/metadatos. Los tipos de entrada del serializador admiten únicamente la información de plantilla que realmente usan; **el código de serialización y los snapshots no cambian**.

No se modifican rutas de descarga, almacenamiento, bytes/hashes, autorización/pertenencia, anexos oficiales ni generadores. Las rutas y los lectores específicos continúan recuperando binarios para descargar/procesar. Las pruebas generales incluyen generación real con las plantillas existentes; los archivos grandes de la prueba de integridad son objetos ficticios, no documentos oficiales.

## Equivalencia e integridad

Las referencias de solo lectura en `scripts/phase3b2-reference/` proceden del commit base. No se usan en producción.

- Dashboard: 39 comparaciones del **resultado completo**, excluyendo exclusivamente `elapsedMs`; todos los módulos, departamentos, año vacío/2026/sin cobertura, estados, plazos, primeras/segundas/últimas páginas y tres fechas adicionales. Mismos datos y fecha de referencia por comparación. También se compara el resultado administrativo sin filtros. Se repite en la cohorte migrada de 20.000 expedientes y se verifica que todas las versiones/snapshots siguen iguales.
- PNT: 264 comparaciones antes/después de datos visibles, metadatos de origen, selección/orden, opciones, errores, recuentos y páginas, más 12 comparaciones de parámetros escalares repetidos de Next (276 en el smoke final). Ocho órdenes × ambos sentidos/vistas, múltiples filtros, fechas inválidas/invertidas, lifecycle con fechas nulas, búsqueda, maestros sin revisión/una/múltiples, vigente + borrador, retiradas y exportaciones completas. La batería válida se repite sobre 2.000 maestros y miles de revisiones. Solo se excluye de la comparación el payload interno descartado que ninguna pantalla/exportación utiliza.
- Documentos: se registran las SQL reales y se comprueba que detalle/catálogos no seleccionan ninguna columna `fileData`; igualdad completa de metadatos y del resultado de los serializadores. Dos versiones históricas congeladas y una actual por expediente. Catorce descargas a través de las rutas existentes comparadas byte por byte y SHA-256: PDFs históricos de Reclamaciones, PDFs actuales y archivos históricos de Devoluciones y plantillas. Se verifican selecciones inválidas, documentos de otro expediente y conservación posterior de versiones, snapshots y hashes.
- Navegador: Dashboard, PNT/listado/detalle/pestañas, primeras/intermedias/últimas páginas, retorno con filtros/página, búsquedas fuera de la página inicial, XLSX completo y Reclamaciones/Devoluciones con pestañas/descargas; Chromium 1440/768/390, 45 descargas verificadas y cero errores JavaScript/hidratación. Quince capturas 3B2, además de las regresiones D1B/D1C.

## Mediciones reproducibles

PostgreSQL 16-alpine nuevo, 1 CPU/1 GiB, pool 4; las **11 migraciones existentes completas**, incluidas restricciones PNT. Node 24.19.0 local. Cohortes independientes por turno de 100, 1.000, 5.000 y 20.000 expedientes distribuidos entre los seis módulos QMS, con estados/años/departamentos/KPI variados, tres versiones y cinco seguimientos por expediente. PNT: 90/100/500/2.000 maestros, combinando cero/una/tres revisiones, fechas de lifecycle y metadatos ficticios.

Cada pareja usa las mismas filas/UUID/configuración y fecha backend `2026-10-11T12:00:00Z`, un calentamiento y tres muestras secuenciales; se informa la mediana en ms, redondeada. Son mediciones de desarrollo con instrumentación Prisma, no garantías de producción ni prueba de carga. La cohorte de 20.000 se conserva únicamente en la base desechable para medir HTTP con las dos compilaciones y los mismos filtros. No se utiliza 3A como “antes”: la referencia exacta es main/3B1.

| Expedientes / maestros PNT | Dashboard | Dashboard CAPA filtrado | PNT primera | PNT última | PNT última revisión + vencida |
|---|---:|---:|---:|---:|---:|
| 100 / 90 | 47 → 22 | 40 → 13 | 22 → 11 | 20 → 10 | 19 → 8 |
| 1.000 / 100 | 125 → 31 | 106 → 22 | 51 → 20 | 26 → 15 | 29 → 12 |
| 5.000 / 500 | 390 → 89 | 391 → 39 | 136 → 28 | 137 → 22 | 114 → 16 |
| 20.000 / 2.000 | 1.341 → 345 | 1.347 → 104 | 602 → 59 | 518 → 58 | 483 → 25 |

HTTP con 20.000 expedientes y exactamente las mismas rutas/datos:

| Ruta | Antes (ms) | Después (ms) |
|---|---:|---:|
| Dashboard general | 1.577 | 654 |
| Dashboard CAPA + 2026 + departamento | 1.247 | 699 |
| PNT primera página | 730 | 185 |
| PNT última página | 622 | 212 |

Los tiempos HTTP incluyen lectura del cuerpo y son distintos del backend instrumentado. Los cuerpos PNT conservan exactamente 67.798/39.346 bytes; Dashboard difiere en dos bytes correspondientes al tiempo mostrado. No se midió HTTP en las cohortes menores.

En 20.000 expedientes, el Dashboard general pasa de alrededor de 50 SQL a 25; filtrado, de 50–52 a 19. Tamaño estimado de datos materializados (JSON de resultados Prisma sin binarios): Dashboard 24.234.430 → 1.638.732 bytes; PNT primera 17.399.675 → 1.780.930. **Esta es una estimación de objetos materializados, no bytes del protocolo PostgreSQL ni HTML**. PNT aumenta de 3–4 SQL a 8, incluidas transacción/recuentos/hidratación; la reducción de datos compensa los viajes adicionales en estas cohortes. Las claves compactas aún crecen con el total.

| Detalle con archivos ficticios de 1 MiB | Backend antes → después | Binarios recuperados antes → después | Delta RSS aproximado de la muestra mediana |
|---|---:|---:|---:|
| Reclamación (versiones, generación, plantilla) | 47 → 10 ms | 5 MiB → 0 | 13,25 → 0 MiB |
| Devolución (versiones, plantilla) | 65 → 8 ms | 7 MiB → 0 | 18,63 → 0 MiB |

RSS depende del GC/allocator; cero delta no significa cero asignaciones. Se midieron bytes binarios recuperados y tiempos de consulta, no memoria retenida ni pico de generación. No se altera el número de SQL de estos detalles (13/12). Las descargas conservan sus binarios y no se reclama una aceleración del generador o del streaming.

## Regresión y CI

`pnpm quality`: 536 pruebas/91 archivos, Prisma validate/generate, lint y build. Advertencias existentes: dos dependencias de hooks en formularios CAPA/Cambios y un import no usado en el smoke UX-C3; fuera del alcance.

PostgreSQL: 54 comandos correctos en una base nueva migrada, incluyendo toda la suite general, D1B, 3B1/3B2, documentos/versiones/Review/QMS y suites adicionales R4C/PNT P1A/P1B/P2A/P2B/P2C/manual/final.

PNT Chromium adicional: ocho suites P1A/P1B-1/P1B-2/P2A/P2B/P2C/P3C-1/final en otra base migrada independiente; tres verificaciones P2A/P2B/P2C de acceso y persistencia tras reinicio del servidor en modo trusted-proxy con identidad y clave exclusivamente ficticias. Todas correctas.

Regresión general Chromium: 14 comandos correctos (D1B/D1C, 3B1/3B2, UX-C3, Review, Auditorías, Reclamaciones, Devoluciones y R4C), además de las once comprobaciones PNT anteriores. El smoke R3C tuvo una interrupción de navegación en su primera ejecución concurrente y pasó íntegramente al repetirse sin cambios y sin otras suites de navegador activas; no se retiraron ni modificaron aserciones.

Resultados finales de navegador, CI y artefactos: se registran en la PR y en la entrega, verificando el SHA exacto del último commit. La CI existente añade únicamente el marcador sintético, los smokes 3B2 y sus capturas; conserva jobs, condiciones y todas las aserciones. La reorganización general queda para 3B3. Las suites críticas excluidas por condiciones se ejecutan adicionalmente en el PostgreSQL/servidor aislados.

## Revisión sencilla en Codespaces

1. Revisar la PR y hacer checkout de la rama en el checkout habitual limpio; no crear worktrees.
2. `pnpm install --frozen-lockfile`, `pnpm db:generate` y `pnpm quality`. No ejecutar reset/push/seed/migraciones sobre la base habitual para revisar esta PR.
3. Con las variables normales del entorno, `pnpm dev` (reiniciar el servidor existente si estaba activo); abrir el preview local disponible. Dashboard: comparar módulos/año/departamento/estado/plazos y páginas. PNT: probar todas/última, vigente/vencida, filtros combinados y exportación desde una página posterior.
4. Abrir Reclamación/Devolución con documentos, consultar versiones y descargar los archivos habituales. La mejora no exige cambiar datos, plantillas ni estados.

Para ejecutar pruebas **con escritura**, crear PostgreSQL separado con una base `covex_phase3b2_*`, aplicar las migraciones existentes **solo allí**, seed de prueba si se ejecutan suites generales, y configurar `APP_ENV=test`, `PHASE3B2_SYNTHETIC_DATABASE=1` y una DATABASE_URL que apunte inequívocamente a esa base. Ejecutar `pnpm phase3b2:smoke`; para Chromium arrancar un servidor contra esa misma base y configurar `PHASE3B2_UI_BASE_URL=http://127.0.0.1:PUERTO`. Los scripts rechazan la base habitual; la excepción CI requiere conjuntamente CI/GITHUB_ACTIONS y el servicio desechable del workflow.

`scripts/benchmark-phase3b2.ts` exige además `PHASE3B2_BENCHMARK=1` y `PHASE3B2_OUTPUT`. Exporta muestras, referencia y tamaños. La referencia HTTP debe servirse desde una compilación main independiente o reconstruida; guardar antes de recompilar la versión optimizada. `PHASE3B2_KEEP_FIXTURES=1` conserva solo la cohorte final en la base desechable; su manifiesto permite repetir equivalencia en modo de solo lectura mediante `PHASE3B2_EXISTING_FIXTURE`. No usar estas opciones sobre datos reales.

No hay cambios en modelos Prisma, migraciones, seed, reglas GMP, estados/transiciones, formularios, codificación, snapshots, historial/relaciones QMS, permisos, documentos oficiales, navegación global ni diseño D1C. No se añaden dependencias, índices, cachés, workers ni URL pública. No se modifican datos reales de Codespaces. CI verde es evidencia técnica; no declara validación GMP.

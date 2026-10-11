# Fase 3B1 — Correcciones funcionales y paginación SQL

Fecha: 2026-10-12. Base: `main` en `aebf0c3fe55475ddb469f18607d88b458d87f320` (D1C, #135). Rama: `feature/phase3b1-list-fixes-pagination`. Una única PR, sin merge automático; commits separados para correcciones, consultas/paginación y pruebas/documentación.

## Alcance y contratos conservados

- CAPA: `due`, `scheduled` y `none` se aplican en el `where` antes del límite. Se conserva `<= ahora`, `> ahora` y ausencia de fecha, respectivamente; no se sustituyen por fechas de seguimientos históricos.
- Auditorías: fechas ISO de calendario estrictas, límites desde/hasta inclusivos y rango válido. Fechas inválidas o invertidas producen cero coincidencias y un mensaje visible, nunca una ampliación silenciosa. La selección conserva el último seguimiento cronológico por ámbito; un blanco explícito sustituye la fecha anterior, un seguimiento general posterior no oculta el de un hallazgo activo y se excluyen ámbitos retirados/ajenos.
- Review: `withActiveReviewCounts(rows, tx)` utiliza la conexión recibida. Sin argumento conserva el cliente global para el resto de módulos. Solo pendientes y aceptados cuentan como activos; no se aumentan timeouts ni se cambian permisos.
- Desviaciones/CAPA/Cambios: páginas SQL de 25 mediante `count`, `skip` y `take`, conservando orden por estado/fecha/creación y añadiendo UUID como desempate. Páginas inválidas vuelven a 1 y las superiores al rango se ajustan a la última.
- El total de coincidencias usa todos los filtros. Los indicadores generales mantienen su población previa: ámbito administrativo seleccionado, independiente de búsqueda, filtros operativos y página. Los recuentos de vencimientos no se obtienen de las 25 filas visibles.
- Proyecciones específicas conservan todas las columnas y sugerencias visibles: identidad/relaciones activas, acciones propuestas, fechas de tareas y último seguimiento de Cambios. CAPA obtiene únicamente el número de versión, sin snapshots ni seguimientos que la tabla no necesita.
- Los enlaces Primera/Anterior/Siguiente/Última conservan parámetros repetidos. Abrir un expediente o Review conserva página y filtros mediante el contrato UX C1/C2; cambiar filtros reinicia página. Las sugerencias inmediatas corresponden a las filas visibles; el botón Buscar sigue consultando en SQL el conjunto completo, como indica el componente existente.
- Los exportadores permanecen independientes de los listados paginados: `page` nunca se incorpora a sus filtros. Se conservan su alcance previo y la exclusión de borradores; no se amplían silenciosamente filtros documentales antes no soportados. Los listados simples se prueban descargando el XLSX completo desde una página posterior.

No hay cambios en formularios, ciclo de estados, codificación, versiones/snapshots, relaciones, documentos/plantillas, eficacia, cierre, permisos, Prisma/migraciones, dependencias ni dashboard D1B/D1C. El CSS añadido solo permite adaptar los nuevos controles de paginación.

## Regresiones

`phase3b1:smoke` utiliza 1.080 expedientes sintéticos (360 por módulo) y siete Auditorías. Comprueba todas las páginas, unicidad/completitud, orden con fechas empatadas, primera/última página, filtros combinados OR/AND, borradores/administración/Review, CAPA coincidente fuera del antiguo límite de 300, fechas de próxima revisión y ámbitos históricos. Ejecuta una lectura real en un proceso con `connection_limit=1`, sin modificar timeout. Los exportadores recuperan las 358 filas activas no borrador por módulo. UUID/códigos, anulación, snapshots congelados, relaciones e historial se comparan antes/después de las consultas.

`phase3b1:ui:smoke` cubre filtros y búsqueda fuera de la página/antiguo límite, paginación, expediente/Review y retorno con contexto, descarga completa de XLSX y 1440/768/390 px, así como fechas inválidas visibles y ausencia de errores de JavaScript/hidratación. Las capturas son artefactos, no archivos del repositorio.

El workflow general solo añade los dos smokes y capturas 3B1; no reorganiza ni elimina pruebas. `pnpm quality` local pasa: Prisma validate/generate, lint, 536 pruebas en 91 archivos y build. Permanecen tres avisos previos de lint.

La ruta general de CI no incluye todas las suites PNT/R4C. Se completan separadamente sobre PostgreSQL nuevo los comandos generales más R4C y PNT P1A/P1B1/P1B2/P2A/P2B/P2C/P3C2/final, y las regresiones de navegador generales/PNT, incluidas las variantes de acceso tras reinicio. El resultado de la CI del SHA final y la enumeración de suites/artefactos se registran en la PR y entrega final; no se presume que los jobs condicionados omitidos hayan ejecutado sus pruebas.

## Mediciones antes/después

Referencia 3A para el diagnóstico; esta comparación utiliza consultas de `main` y 3B1 sobre la **misma** PostgreSQL sintética y mismo runtime. Tres cohortes separadas de 1.000, 5.000 y 20.000 QMS, repartidas entre los tres módulos; coexisten 26.000 expedientes, tres snapshots de 2 KiB y cinco seguimientos por expediente. Esto hace que los indicadores generales lean la misma población global en todas las cohortes. PostgreSQL 16 limitado a un CPU/1 GiB, Node 24, pool de cuatro conexiones; calentamiento y mediana de tres repeticiones secuenciales. CI utiliza Node 22. No son medidas p95 ni de capacidad productiva.

### Backend de primera página

Tiempo de la función completa en ms y tamaño JSON del resultado. El antes entrega hasta 300 filas; después, hasta 25 más el total filtrado.

| Cohorte QMS | Módulo | Antes ms | Después ms | Última página ms | JSON antes/después (bytes) | Consultas antes/después |
|---:|---|---:|---:|---:|---:|---:|
| 1.000 | Desviaciones | 254 | 308 | 361 | 1.456.456 / 42.328 | 16 / 16 |
| 1.000 | CAPA | 277 | 337 | 398 | 1.936.214 / 37.861 | 16 / 15 |
| 1.000 | Cambios | 355 | 314 | 266 | 2.104.155 / 40.951 | 15 / 15 |
| 5.000 | Desviaciones | 421 | 308 | 354 | 1.456.815 / 42.352 | 16 / 16 |
| 5.000 | CAPA | 197 | 222 | 222 | 1.936.574 / 37.882 | 16 / 15 |
| 5.000 | Cambios | 329 | 207 | 226 | 2.104.513 / 40.974 | 15 / 15 |
| 20.000 | Desviaciones | 811 | 376 | 383 | 1.457.115 / 42.393 | 16 / 16 |
| 20.000 | CAPA | 393 | 228 | 200 | 1.936.874 / 37.922 | 16 / 15 |
| 20.000 | Cambios | 394 | 390 | 223 | 2.104.813 / 41.017 | 15 / 15 |

Las latencias pequeñas no mejoran uniformemente: se añade un total exacto y siguen existiendo indicadores globales. La reducción consistente es el volumen transferido/materializado y el acceso completo, no una promesa porcentual de tiempo.

### HTTP del listado

Respuesta completa, incluido cuerpo HTML/RSC, en ms. Mismos datos, puerto, máquina y configuración; build de `main` antes y de 3B1 después.

| Cohorte | Módulo | Primera antes | Primera después | Última después |
|---:|---|---:|---:|---:|
| 1.000 | Desviaciones | 1.270 | 586 | 347 |
| 1.000 | CAPA | 581 | 289 | 266 |
| 1.000 | Cambios | 614 | 470 | 405 |
| 5.000 | Desviaciones | 498 | 389 | 409 |
| 5.000 | CAPA | 434 | 390 | 270 |
| 5.000 | Cambios | 753 | 194 | 217 |
| 20.000 | Desviaciones | 765 | 250 | 387 |
| 20.000 | CAPA | 599 | 292 | 364 |
| 20.000 | Cambios | 487 | 310 | 324 |

En la cohorte de 20.000 el cuerpo pasa de 3.058.746 a 288.018 bytes (Desviaciones), de 1.897.990 a 193.049 (CAPA) y de 2.765.110 a 263.849 (Cambios). Antes no había navegación a una última página comparable.

Filtros CAPA en esa cohorte: vencidos 198 → 168 ms, programados 364 → 156 ms y sin fecha 284 → 199 ms. Para vencidos/programados, el antes solo devolvía 150 filas del primer bloque; después informa los totales reales 3.333/3.334 y permite recorrerlos. El caso sin fecha devuelve cero en ambos. El smoke incluye además fechas ausentes reales y combinaciones restrictivas.

Evidencias locales fuera de Git: `/workspace/artifacts/phase3b1/benchmark.json`, `http-after.json`, harness comparativo, registros DB/navegador y capturas. No se confunden tiempos de eventos Prisma con CPU SQL ni con el tiempo de renderizado HTTP. No se han añadido índices ni medido estrés/concurrencia sostenida.

## Comprobación en Codespaces sin escribir datos existentes

1. Usar el checkout existente y seleccionar esta rama con el árbol limpio; no crear worktrees. Conservar la conexión/configuración habitual del entorno sin imprimir credenciales.
2. Ejecutar `pnpm db:generate` y arrancar `pnpm dev` con la configuración existente. No ejecutar migrate, seed, push, reset, importaciones ni smokes con escritura sobre esa base.
3. Abrir `/deviations`, `/capa` y `/changes`. Aplicar filtros múltiples/búsqueda, recorrer páginas y comprobar que el total no depende de la página. Abrir un expediente y volver; también abrir Review desde su indicador. Los indicadores generales conservan el ámbito administrativo.
4. En CAPA, probar seguimiento vencido/programado/sin fecha. En Auditorías, probar rangos de próxima revisión; una URL con fecha imposible muestra error sin devolver coincidencias amplias.
5. Descargar un listado simple desde una página posterior si se desea verificar el archivo; esa descarga no modifica el expediente. Conservar las reglas y filtros documentales previos.

Para ejecutar las regresiones con escritura, crear PostgreSQL **nuevo y desechable**, aplicar las migraciones existentes e inicializar catálogos solo allí. Usar una base `covex_phase3b1_*`, `APP_ENV=test` y `PHASE3B1_SYNTHETIC_DATABASE=1`; los scripts rechazan la base habitual y solo limpian sus UUID de fixtures. En GitHub Actions se permite únicamente el servicio PostgreSQL desechable del job. Nunca usar estos flags para eludir el aislamiento.

Con esa base: `pnpm phase3b1:smoke`. Para navegador, arrancar el build con la misma conexión sintética, definir `PHASE3B1_UI_BASE_URL` local y ejecutar `pnpm phase3b1:ui:smoke`. No crear URL pública.

## Límites

El orden es determinista sobre una población sin modificaciones; `skip/take` no crea un snapshot que dure entre peticiones si otros usuarios añaden/retiran expedientes. El total y los indicadores se recalculan al navegar. No se cambian bloqueos de guardado/cierre ni se añaden transacciones largas para mantener una sesión de listado.

3B2 (dashboard/PNT/otras optimizaciones) y 3B3 (reorganización general de CI) quedan fuera. La verificación técnica no constituye validación GMP ni aceptación documental productiva.

# BE1-C — JIT desactivado y dos consultas reescritas: medición

**Fecha:** 2026-10-20. **Decisión:** D-114. **Diseño:** `docs/superpowers/specs/2026-10-20-be1c-consultas-medidas-design.md`.

Medición técnica de desarrollo con datos ficticios. No es una prueba de carga ni una cualificación.

## Método

- **Exploración previa** (antes de diseñar), con la cohorte de 20.000 expedientes de BE1-A en una base aislada:
  - cada SQL de los casos más lentos de BE1-A se registró con su duración;
  - las lentas se analizaron con `EXPLAIN ANALYZE`, con JIT activado y desactivado.
- **Antes/después:** `scripts/benchmark-be1.ts` en modo `after` (el cliente de la aplicación), con las cohortes de 1.000, 5.000 y 20.000.
  - «Antes» se tomó con el código previo a BE1-C, con JIT activo.
  - Cada modo se ejecutó sobre una base nueva, en la misma máquina.
  - Mediana de 3 muestras secuenciales tras un calentamiento.
- **Entorno:** el mismo de BE1-A: contenedor de desarrollo con 4 CPU y 16 GiB, PostgreSQL 16.15 local y Node 22.22. Los tiempos absolutos no son comparables con los de 3B1/3B2.

## Exploración previa: causas

| Caso | Tiempo | Causa | Arreglo |
| --- | --- | --- | --- |
| Panel de inicio | ~470 ms en la primera exploración | Compilación **JIT** de PostgreSQL, activa por defecto: ~420 ms en una sola consulta, la de seguimientos de Auditorías, que sin JIT tarda 28 ms | JIT desactivado en las conexiones de la aplicación |
| Panel de inicio, resto | 2 × ~70 ms | La carga de la relación `lifecycle` de las revisiones PNT enviaba `WHERE (documentId, revisionId) IN ((…), …)` con un par por revisión | La relación se lee aparte, filtrada por documento |
| Auditorías «con PDF firmado» | 80–90 ms | `DISTINCT ON` sobre todas las versiones de todos los expedientes, con recorrido completo y ordenación, para quedarse con unos pocos | Se parte de los PDF firmados y se comprueba con `NOT EXISTS` que su versión es la última, con el índice único existente: 0,5 ms y el mismo resultado |
| Búsqueda por lote (Reclamaciones, OOS) | 60–120 ms | `ILIKE` sobre 10–12 campos y tablas relacionadas | Sin cambios (ver «Descartado») |
| Listados normales | ~50 ms | — | Sin cambios |

El tiempo del panel con JIT varía mucho entre ejecuciones, porque depende de si el coste estimado de la consulta supera el umbral de compilación. En la medición antes/después fue de ~210 ms.

## Resultados

| Caso | Cohorte | ms antes → después | SQL antes → después |
| --- | --- | --- | --- |
| Auditorías, con PDF firmado | 1.000 | 25 → 23 | 17 → 17 |
| | 5.000 | 59 → 20 | 17 → 17 |
| | 20.000 | 110 → 31 | 17 → 17 |
| Panel de inicio | 1.000 | 29 → 52 (repetido: 29) | 26 → 25 |
| | 5.000 | 86 → 62 | 26 → 25 |
| | 20.000 | 211 → 170 | 26 → 25 |
| Índice PNT | 1.000 | 15 → 22 | 8 → 8 |
| | 5.000 | 41 → 24 | 8 → 8 |
| | 20.000 | 107 → 70 | 8 → 8 |
| Reclamaciones, búsqueda por lote (control) | 20.000 | 123 → 111 | 11 → 11 |
| OOS, búsqueda por lote (control) | 20.000 | 111 → 124 | 9 → 9 |
| Listado Auditorías (control) | 20.000 | 53 → 54 | 15 → 15 |

- **«Con PDF firmado»:** con 20.000 expedientes, de 110 a 31 ms. En el smoke, la consulta lee 8 de 901 versiones en lugar de todas.
- **Panel:** con 20.000, de 211 a 170 ms, con una SQL menos. El panel con 1.000 dio 52 ms en la primera cohorte de la base nueva y 29 ms al repetirlo: es variación de arranque.
  - Lo que queda son consultas que ya se ejecutan en paralelo: los seguimientos de Auditorías y CAPA y la tendencia, de 25–45 ms cada una con 20.000.
- **Índice PNT:** mejora con 5.000 y 20.000 sin cambios en su consulta; lo más probable es que se deba a JIT, pero no se ha comprobado por separado.
- **Búsquedas por lote y listados:** sin cambio estructural. Las diferencias son variación entre ejecuciones de 3 muestras, como en BE1-A.

## Descartado y por qué

- **Índices nuevos:** ninguno. La medición no señaló ningún caso que mejorase con un índice.
- **Índices de texto (trigramas) para las búsquedas por lote:**
  - solo ayudarían campo a campo, y el buscador combina 10–12 campos y tablas relacionadas;
  - exigen la extensión `pg_trgm` en el servidor de IT;
  - con ~3.300 expedientes por módulo tardan menos de 0,13 s.
- **Índices para el orden de los listados:** ~50 ms con 20.000; no compensan su coste en cada guardado.
- **JIT en el servidor de PostgreSQL:** no se cambia la configuración de IT. Se desactiva solo en las conexiones de la aplicación y solo si la URL no trae ya `options`.

## Qué medir con datos reales

Tras la carga del histórico (fase 5, DATA1), repetir con una copia de los datos reales:

- el panel de inicio y el índice PNT;
- las búsquedas por lote de Reclamaciones y OOS, para decidir si hacen falta índices de texto;
- `SHOW jit` con el cliente de la aplicación, por si IT ha fijado `options` en la URL.

## Reproducir

```bash
BE1_BENCHMARK=1 BE1_MODE=after BE1_SIZES=1000,5000,20000 BE1_OUTPUT=<carpeta> PHASE3B2_SYNTHETIC_DATABASE=1 pnpm be1:benchmark
pnpm be1c:smoke   # equivalencia de resultados, plan acotado y JIT desactivado
```

Con `APP_ENV=test` y una base sintética aislada. Las salidas JSON no se versionan.

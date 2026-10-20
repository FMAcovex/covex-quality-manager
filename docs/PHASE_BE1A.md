# BE1-A — Ficheros fuera de las lecturas por defecto: medición

**Fecha:** 2026-10-20. **Decisión:** D-112. **Diseño:** `docs/superpowers/specs/2026-10-20-be1a-ficheros-fuera-de-lecturas-design.md`.

Medición técnica de desarrollo con datos ficticios. No es una prueba de carga ni una cualificación.

## Qué se midió

- **Script:** `scripts/benchmark-be1.ts` (`pnpm be1:benchmark`), con la misma forma que el de 3B2. Exige `BE1_BENCHMARK=1`, `BE1_OUTPUT` y una base sintética aislada.
- **Casos:**
  - la primera página de los 8 listados y los filtros que resuelven antes una lista de ids (lote en Reclamaciones y OOS, seguimiento vencido en Devoluciones, PDF firmado en Auditorías);
  - las fichas de Desviación, CAPA, Cambio, Reclamación, Devolución, Auditoría y OOS;
  - los formularios de alta y edición de Desviación, CAPA y Cambio;
  - el panel de inicio, como control.
- **Datos (`scripts/be1-fixtures.ts`):**
  - la cohorte de 3B2, en la que el tamaño es el total de expedientes QMS repartidos entre los seis módulos, más OOS en la misma proporción;
  - en una ficha de Desviación, CAPA, Cambio, Auditoría y OOS: un PDF firmado y dos Word generados de 1 MiB, y su plantilla;
  - una plantilla activa de 1 MiB para cada uno de los tres formularios.
- **Métricas:** mediana de 3 muestras secuenciales tras un calentamiento:
  - tiempo de la consulta en el servidor;
  - número de SQL;
  - bytes de fichero materializados;
  - variación de memoria del proceso (RSS).
- **Antes/después:** ambos usan el cliente de la aplicación (`createAppPrismaClient`, con su extensión de autoría). «Antes» solo desactiva la exclusión de ficheros, así que la única diferencia medida es D-112. Cada modo se ejecutó sobre una base nueva, en la misma máquina y con el mismo código.
- **Entorno:** contenedor de desarrollo con 4 CPU y 16 GiB, PostgreSQL 16.15 local y Node 22.22. A diferencia de 3B1/3B2, el contenedor no permite limitar PostgreSQL a 1 CPU y 1 GiB, así que los tiempos absolutos no son comparables con los de esas fases; la comparación antes/después sí lo es.

## Resultados con 20.000 expedientes

| Caso | ms antes → después | SQL antes → después | MiB de fichero antes → después | Δ RSS MiB antes → después |
| --- | --- | --- | --- | --- |
| Listado Desviaciones | 38 → 38 | 17 → 17 | 0,0 → 0,0 | 0,0 → 0,0 |
| Listado CAPA | 40 → 38 | 15 → 15 | 0,0 → 0,0 | 0,0 → 0,0 |
| Listado Cambios | 49 → 42 | 15 → 15 | 0,0 → 0,0 | 0,0 → 0,0 |
| Listado Reclamaciones | 49 → 51 | 17 → 17 | 0,0 → 0,0 | 0,0 → 0,0 |
| Reclamaciones, búsqueda por lote | 108 → 116 | 11 → 11 | 0,0 → 0,0 | 0,0 → 0,0 |
| Listado Devoluciones | 57 → 53 | 17 → 17 | 0,0 → 0,0 | 0,0 → 0,0 |
| Devoluciones, seguimiento vencido | 62 → 65 | 18 → 18 | 0,0 → 0,0 | 0,0 → 0,0 |
| Listado Auditorías | 50 → 59 | 15 → 15 | 0,0 → 0,0 | 0,0 → 0,0 |
| Auditorías, con PDF firmado | 100 → 118 | 17 → 17 | 0,0 → 0,0 | 0,0 → 0,0 |
| Listado OOS | 34 → 32 | 10 → 10 | 0,0 → 0,0 | 0,0 → 0,0 |
| OOS, búsqueda por lote | 74 → 110 | 9 → 9 | 0,0 → 0,0 | 0,0 → 0,0 |
| Índice PNT | 66 → 68 | 8 → 8 | 0,0 → 0,0 | 2,5 → 2,4 |
| Ficha Desviación | 49 → 12 | 14 → 14 | 3,0 → 0,0 | 10,5 → 0,0 |
| Ficha CAPA | 45 → 10 | 14 → 14 | 3,0 → 0,0 | 8,0 → 0,0 |
| Ficha Cambio | 60 → 11 | 13 → 13 | 4,0 → 0,0 | 12,0 → 0,0 |
| Ficha Reclamación | 12 → 13 | 13 → 13 | 0,0 → 0,0 | 0,0 → 0,0 |
| Ficha Devolución | 8 → 11 | 12 → 12 | 0,0 → 0,0 | 0,0 → 0,0 |
| Ficha Auditoría | 4 → 4 | 5 → 5 | 0,0 → 0,0 | 0,0 → 0,0 |
| Ficha OOS | 5 → 6 | 7 → 7 | 0,0 → 0,0 | 0,0 → 0,0 |
| Formulario Desviación | 10 → 3 | 3 → 3 | 1,0 → 0,0 | 2,6 → 0,0 |
| Formulario CAPA | 12 → 3 | 3 → 3 | 1,0 → 0,0 | 2,8 → 0,0 |
| Formulario Cambio | 11 → 3 | 3 → 3 | 1,0 → 0,0 | 2,8 → 0,0 |
| Panel de inicio (control) | 237 → 229 | 26 → 26 | 0,0 → 0,0 | 1,4 → 1,4 |

## Fichas y formularios con 1.000 y 5.000 expedientes

| Cohorte | Caso | ms antes → después | MiB de fichero antes → después |
| --- | --- | --- | --- |
| 1.000 | Ficha Desviación | 55 → 9 | 3,0 → 0,0 |
| 1.000 | Ficha CAPA | 51 → 8 | 3,0 → 0,0 |
| 1.000 | Ficha Cambio | 63 → 9 | 4,0 → 0,0 |
| 1.000 | Formulario Desviación | 15 → 3 | 1,0 → 0,0 |
| 1.000 | Formulario CAPA | 12 → 2 | 1,0 → 0,0 |
| 1.000 | Formulario Cambio | 15 → 3 | 1,0 → 0,0 |
| 5.000 | Ficha Desviación | 55 → 10 | 3,0 → 0,0 |
| 5.000 | Ficha CAPA | 44 → 9 | 3,0 → 0,0 |
| 5.000 | Ficha Cambio | 62 → 13 | 4,0 → 0,0 |
| 5.000 | Formulario Desviación | 11 → 4 | 1,0 → 0,0 |
| 5.000 | Formulario CAPA | 10 → 3 | 1,0 → 0,0 |
| 5.000 | Formulario Cambio | 10 → 8 | 1,0 → 0,0 |

## Conclusiones

- **Fichas de Desviación, CAPA y Cambio:** dejan de leer 3–4 MiB de ficheros por visita. Pasan de 45–60 ms a 10–12 ms y no reservan memoria por esos ficheros (antes, 8–12 MiB por visita). El ahorro crece con el número de Word generados y PDF firmados de cada expediente, no con el total de expedientes.
- **Formularios de alta y edición de esos módulos:** dejan de leer las plantillas activas (1 MiB cada una en la prueba). Pasan de 10–15 ms a 2–4 ms.
- **Listados, panel y fichas de Reclamación, Devolución, Auditoría y OOS:** ya no leían ficheros (3B2 corrigió Reclamaciones y Devoluciones); mismo número de SQL. Las diferencias de tiempo, de hasta un ±20 %, son variación entre ejecuciones de 3 muestras, sin cambio estructural. La mayor, la búsqueda por lote de OOS con 20.000 (74 → 110 ms), es del mismo orden que la variación del propio «antes»: en una primera ejecución de la línea base, sin la exclusión, ese caso dio 110 ms.
- **Para BE1-C (índices)**, los casos más lentos con 20.000 expedientes son:
  - el panel de inicio (~230 ms), con orden y paginación en memoria (diferido en 3B2);
  - las búsquedas por lote de Reclamaciones y OOS (75–115 ms);
  - el filtro «con PDF firmado» de Auditorías (100–120 ms).

  Son candidatos a medir con `EXPLAIN` antes de proponer índices.

## Volumen de custodia

El script informa del tamaño total y del percentil 95 por tabla. En esta cohorte ficticia solo hay los ficheros de prueba de 1 MiB, que no representan el volumen real. Para decidir con IT el almacenamiento (PostgreSQL o fuera de él), conviene ejecutar la misma consulta sobre una copia de los datos reales:

```sql
SELECT count(*), sum(octet_length("fileData")), percentile_cont(0.95) WITHIN GROUP (ORDER BY octet_length("fileData"))
FROM "GeneratedDocument";  -- y las otras seis tablas con fileData
```

## Reproducir

```bash
BE1_BENCHMARK=1 BE1_MODE=before BE1_OUTPUT=<carpeta> PHASE3B2_SYNTHETIC_DATABASE=1 pnpm be1:benchmark
BE1_BENCHMARK=1 BE1_MODE=after  BE1_OUTPUT=<carpeta> PHASE3B2_SYNTHETIC_DATABASE=1 pnpm be1:benchmark
```

Hay que lanzarlo con `APP_ENV=test` y una base sintética aislada (`covex_phase3b2_*` o el entorno de test aislado). Las salidas JSON no se versionan.

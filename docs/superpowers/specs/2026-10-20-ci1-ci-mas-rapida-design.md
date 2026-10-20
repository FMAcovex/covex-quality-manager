# CI1 — CI más rápida sin quitar pruebas, con diagnóstico y batería nocturna

**Fecha:** 2026-10-20. **Backlog:** CI1 (P1), fase 3 «Backend y CI». **Estado:** enfoque elegido por el responsable («más rápido sin quitar pruebas»); pendiente de revisión de esta especificación.

## 1. Propósito y decisión

Cada PR debe seguir ejecutando **todas** las pruebas, pero esperar menos y, si algo falla, saber qué y dónde sin abrir registros largos. Además, la batería completa debe ejecutarse sola sobre `main` para detectar fallos que dependen de la fecha o que no se ven en una PR.

Decisión del responsable:

- **Sin selección por impacto.** El repositorio es público, así que los minutos de GitHub Actions no tienen coste. Omitir grupos según los ficheros cambiados no ahorra dinero y permitiría fusionar una PR sin pasar regresiones que sí rompe.
- La entrada «selección de tests por impacto» de CI1 se sustituye por un reparto más fino en paralelo. La clasificación actual se mantiene: un cambio solo de documentación omite las pruebas; cualquier otro las ejecuta todas.

Éxito:

- tiempo de espera de una PR de ~9,5 min a ~6,5–7 min, medido en GitHub en al menos 3 ejecuciones;
- ninguna suite retirada ni omitida: el inventario de `ci-suites.json` y la compuerta final siguen exigiendo cada suite;
- la página de cada ejecución muestra una tabla de grupos, tiempos y, si hay fallo, la suite y el fichero de registro;
- una ejecución completa programada cada noche y manual cuando se quiera, sobre `main`.

## 2. Situación de partida (medida, ejecución 39465639190)

- **Camino crítico:** `scope` 7 s → `quality` 2 min 54 s (instalación 15 s, Prisma 5 s, Vitest 34 s, build con ESLint y TypeScript 100 s) → grupo de regresión más lento → compuerta 17 s. Total ~9,5 min.
- **Grupos de regresión.** Cada uno tiene ~70 s de preparación: contenedor, instalación, Prisma, build y Chromium.

| Grupo | Suites (s) | Las más lentas |
| --- | --- | --- |
| postgresql | 271 | phase4b2 72, capture 43, auth 39, phase3b2 26 |
| browser-qms | 286 | phase4b1:ui 70, phase3b2:ui 68, review-r2c:ui 44, phase3b1:ui 33 |
| records-r4c | 230 | complaints-r4a:ui 84, returns-r4b:ui 82, oos:ui 33 |
| pnt | 168 | pnt-p2c:ui 39 + 16, pnt-final:ui 31 |
| browser-audits | 125 | audits-r3b:ui 44, audits-r3c:ui 36 |

- **Variación entre ejecuciones:** ±20 % por suite, sin cambios de orden.
- **Disparadores:** solo `pull_request` hacia `main`. No hay ejecución programada ni manual.
- **Diagnóstico de un fallo:** está en el registro del job (las últimas 20.000 líneas de la suite) y en los artefactos. La página de la ejecución no resume nada.

## 3. Diseño

### 3.1 Reparto de grupos

`.github/ci-suites.json` sigue siendo el inventario único. Los grupos se reparten así, sin quitar ni duplicar suites y conservando el orden relativo dentro de cada uno:

| Grupo | Contenido | Suites (s, estimado) | Necesita build |
| --- | --- | --- | --- |
| `postgresql` | la lista `db` actual | ~95 | **No** |
| `security` | la lista `security` actual (servidor Next) | ~176 | Sí |
| `browser-qms` | phase3b2:ui, phase4b3-c, ux-v1–v4, dashboard-d1b/d1c:ui, ux-c3:ui, be1b | ~135 | Sí |
| `browser-access` | phase4b1:ui, phase3b1:ui, review-r2c:ui | ~146 | Sí |
| `browser-audits` | sin cambios | ~125 | Sí |
| `records-complaints` | complaints-r4a (db y ui), hito8, complaints-returns-r4c (db y ui) | ~105 | Sí |
| `records-returns` | returns-r4b (db y ui), oos (db y ui), evidence:ui | ~122 | Sí |
| `pnt` | sin cambios | ~168 | Sí |

- **`browser-qms` conserva su nombre**, porque `be1b:smoke` lee `ci-evidence/browser-qms-server.log`.
- **Dependencias entre suites.** Cada grupo usa una base nueva. Si una suite necesita datos de otra del grupo anterior, se mantienen juntas. Se comprueba ejecutando cada grupo nuevo en local con `run_ci_group.py` sobre una base nueva.

### 3.2 Trabajos del flujo

- **`unit`** (nuevo): instalación, Prisma y Vitest completo. Corre en paralelo con `quality`.
- **`quality`:** instalación, Prisma y build (incluye ESLint y TypeScript), y publica el build verificado por SHA. Ya no ejecuta Vitest.
- **`regression-db`** (nuevo): ejecuta el grupo `postgresql`. Solo depende de `scope`, así que empieza a la vez que `quality`.
- **`regression`:** matriz con los grupos que necesitan build. Depende de `quality`.
- **`QMS final gate`:**
  - exige `scope`, `unit`, `quality`, `regression-db` y `regression` en éxito;
  - exige evidencia de `unit`, `quality` y de cada grupo de `ci-suites.json` con el mismo SHA y la lista completa de suites, como ahora.
- **Contrato** (`test_ci_contract.py`):
  - la matriz de `ci.yml` coincide exactamente con los grupos de `ci-suites.json` que tienen `ui` o `security`;
  - `regression-db` ejecuta exactamente los que no los tienen.

  Añadir un grupo sin incluirlo en el flujo hace fallar `scope`.

Camino crítico estimado: `scope` 7 s → `quality` ~2 min 20 s → grupo más lento: ~70 s de preparación + ~176 s → compuerta. Unos 6,5–7 min.

### 3.3 Diagnóstico en la página de la ejecución

- **`run_ci_group.py`** escribe en `GITHUB_STEP_SUMMARY` una tabla con suite, segundos y estado. Si algo falla, indica también:
  - qué suite falló;
  - si el fallo fue de infraestructura o funcional (`failureKind`);
  - el fichero de registro dentro del artefacto `ci-results-<grupo>`.
- **La compuerta** escribe un resumen global:
  - estado y segundos de cada grupo;
  - las 5 suites más lentas de la ejecución;
  - la lista de errores.

  `gate-result.json` añade los segundos por grupo, para medir la duración sin descargar los registros.
- **Sin datos de negocio, secretos ni URLs:** solo nombres de suites, tiempos y estados. Fuera de GitHub Actions, sin `GITHUB_STEP_SUMMARY`, no se escribe nada.

### 3.4 Batería completa programada y manual

- **Disparadores** de `ci.yml`, además de `pull_request`:
  - `schedule`: cada noche a las 03:17 UTC, sobre `main`;
  - `workflow_dispatch`: manual.
- **Fuera de una PR:**
  - el SHA probado es `github.sha`;
  - `scope` no compara ficheros y siempre ejecuta todo (`docs_only=false`);
  - el grupo de concurrencia es la rama, y no se cancela una ejecución en curso.
- **Avisos de fallo:** las notificaciones habituales de GitHub para flujos programados. No se configura correo propio, que está fuera del MVP.
- **Limitación conocida:** GitHub desactiva los flujos programados de un repositorio público tras 60 días sin actividad. Se documenta.

### 3.5 Lo que no cambia

- Las suites y su contenido, `controlled_document_scope.py` para PR y el aislamiento por runner (PostgreSQL nuevo, build verificado por SHA y Chromium).
- Las cachés, la compuerta como check obligatorio, el código de la aplicación, el esquema y las migraciones.

## 4. Pruebas

- **Contratos Python** (`test_ci_contract.py`, ejecutados en `scope`):
  - la matriz de `ci.yml` y `regression-db` coinciden con los grupos;
  - el inventario no pierde ninguna suite;
  - la compuerta falla si falta `unit` o `regression-db`, o si falla, se omite o se cancela;
  - la compuerta falla si falta la evidencia de un grupo nuevo;
  - el resumen no incluye nada distinto de nombres, tiempos y estados;
  - `scope` fuera de una PR devuelve `docs_only=false`.
- **Local:** cada grupo nuevo o cambiado se ejecuta con `run_ci_group.py` sobre una base nueva, para comprobar las dependencias entre suites.
- **En GitHub:**
  - la PR ejecuta el flujo nuevo en verde;
  - después de la fusión, una ejecución manual en `main` (`workflow_dispatch`) en verde;
  - medición de 3 ejecuciones antes y 3 después.

## 5. Documentación

- `docs/PHASE_CI1.md`: medición antes/después, nuevo reparto, cómo leer el resumen y cómo lanzar la batería manual.
- `docs/DECISIONS.md`, D-115: sin selección por impacto y por qué, reparto, batería nocturna y manual.
- `docs/PHASE_3B3.md`: nota de que la sección «Inventario obligatorio» queda sustituida por `ci-suites.json`, sin reescribir el histórico.
- `CURRENT_STATUS`, `V1_BASELINE_AND_BACKLOG` (CI1 hecho) y `ROADMAP`.

## 6. Entrega

Una PR con CI verde y fusión según la autorización del responsable. Rollback: revertir la PR. No hay cambios de aplicación ni de datos.

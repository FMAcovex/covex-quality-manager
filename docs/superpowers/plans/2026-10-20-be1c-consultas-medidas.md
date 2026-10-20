# BE1-C — JIT desactivado y dos consultas reescritas: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** bajar el tiempo del panel de inicio y del filtro «con PDF firmado» de Auditorías sin índices ni migraciones, con medición antes/después.

**Architecture:**
- Una función pura añade `options=-c jit=off` a la URL del cliente de la aplicación.
- Se reescriben dos consultas: la de Auditorías en SQL directo y la de revisiones PNT del panel, con lectura de `lifecycle` por documento.
- Un smoke PostgreSQL prueba la equivalencia de resultados y la forma de los planes.

**Tech Stack:** Prisma 6.19, PostgreSQL 16, vitest, tsx.

**Spec:** `docs/superpowers/specs/2026-10-20-be1c-consultas-medidas-design.md`

## Global Constraints

- **Sin cambios de base de datos:** ningún índice, migración ni cambio de `prisma/schema.prisma`.
- **Parámetro de conexión:** `options=-c jit=off`, que se añade solo si la URL no trae ya `options`.
- **Resultados idénticos** a los de las consultas actuales, también en el orden.
- **Medición** con `scripts/benchmark-be1.ts` y las cohortes 1.000/5.000/20.000; «antes» se toma sobre el código previo a este plan.
- **Antes de cada commit:** `git checkout -- next-env.d.ts`. Trailer de sesión y sin identificadores de modelo.

## Review Focus

1. **`DATABASE_URL` con `options` ya puesta por IT, o con parámetros codificados** (`%3D`): no se duplica ni se rompe. Test en Task 1.
2. **Expediente cuya única versión con PDF firmado no es la última:** no aparece como «con PDF firmado», igual que antes. Smoke en Task 2.
3. **Revisión PNT sin fila de `lifecycle`:** el panel usa las fechas de la revisión, igual que antes. Smoke en Task 2 y `phase3b2:smoke`, que compara con la referencia.
4. **Panel con filtro de departamento o año:** las alertas y recuentos PNT no cambian. `phase3b2:smoke` y `dashboard-d1b:smoke` en Task 2.
5. **Arranque de producción** (`ops/runtime/start.mjs` valida la URL): no se ve afectado, porque la URL se amplía dentro del cliente y no en el entorno. Revisión de código en Task 1.

---

### Task 1: Línea base y JIT desactivado

**Files:**
- Create: `src/lib/db-url.ts`, `src/lib/db-url.test.ts`
- Modify: `src/lib/db-client.ts`

**Interfaces:**
- Produces: `export function withJitDisabled(url: string): string`. Si la URL no es válida, la devuelve sin cambios.

- [ ] **Step 1: línea base «antes».**
  - Base nueva: `BE1_BENCHMARK=1 BE1_MODE=after BE1_SIZES=1000,5000,20000 BE1_OUTPUT=$S/be1c-before PHASE3B2_SYNTHETIC_DATABASE=1 pnpm be1:benchmark`. `after` es el cliente de la aplicación actual, todavía con JIT activo.
  - Guardar `benchmark-after.json` como «antes» de BE1-C.
- [ ] **Step 2: tests (fallan primero)** en `db-url.test.ts`:
  - `añade jit=off a una URL sin parámetros`: `withJitDisabled("postgresql://u:p@h:5432/db")` devuelve una URL cuyo `searchParams.get("options")` es `"-c jit=off"`;
  - `conserva otros parámetros`: con `?sslmode=require&connection_limit=5`, los dos se conservan y `options` es `"-c jit=off"`;
  - `respeta options existente`: `?options=-c%20statement_timeout%3D5000` devuelve la URL idéntica;
  - `URL no válida`: `"no-es-url"` se devuelve igual.
- [ ] **Step 3: ejecutar** `vitest run src/lib/db-url.test.ts`. Esperado: FAIL porque no existe el módulo.
- [ ] **Step 4: implementar.**
  - `withJitDisabled` con `new URL()` y `searchParams`.
  - En `createAppPrismaClient`, pasar `datasourceUrl: withJitDisabled(process.env.DATABASE_URL)` cuando exista `DATABASE_URL`; si no existe, no pasar nada.
- [ ] **Step 5: verificar.**
  - el test pasa;
  - vitest completo, tsc y lint pasan;
  - el script de exploración `SHOW jit` con `createAppPrismaClient()` devuelve `off`.

  Commit.

### Task 2: Reescrituras y smoke de equivalencia

**Files:**
- Modify: `src/modules/audits/queries.ts` (consulta `signedPdf`, unas 78 líneas)
- Modify: `src/modules/dashboard/queries.ts` (dos lecturas con `lifecycle`, unas 43–62 líneas)
- Create: `scripts/smoke-be1c-queries.ts`
- Modify: `package.json` (`be1c:smoke`), `.github/ci-suites.json` (grupo `postgresql`, una línea)

**Interfaces:**
- Consumes: `createAppPrismaClient` (cliente con `onQuery`), `createBe1Fixtures(size)` de `scripts/be1-fixtures.ts`.

- [ ] **Step 1: smoke (falla primero).** `be1c:smoke` inyecta `createAppPrismaClient({ log: [{ emit: "event", level: "query" }], onQuery })`, crea `createBe1Fixtures(300)` y:
  - **Auditorías:**
    - crea una auditoría con dos versiones y PDF firmado solo en la primera, y otra con PDF en su última versión;
    - `getAuditList({ signedPdf: "yes" })` incluye la segunda y no la primera; con `"no"`, al revés;
    - el conjunto de ids «con PDF» coincide con el de la consulta antigua, copiada en el smoke;
    - `EXPLAIN` de la consulta usada no contiene `Seq Scan on "QmsRecordVersion"`. Se toma el SQL de `onQuery` en la llamada con `signedPdf: "yes"`.
  - **Panel:**
    - `getDashboardData(base)` y con filtro de departamento;
    - ninguna SQL emitida tiene más de 200 parámetros: se cuentan los `$n` del texto;
    - el resultado coincide con `deepEqual` con el de la referencia de 3B2 (`scripts/phase3b2-reference/dashboard`), quitando `elapsedMs`, como hace `smoke-phase3b2-dashboard.ts`.
  - **JIT:** `$queryRawUnsafe("SHOW jit")` con el cliente de la aplicación devuelve `off`.
- [ ] **Step 2: ejecutar** en una base nueva: `pnpm be1c:smoke`. Esperado: FAIL en `Seq Scan on "QmsRecordVersion"` y en el número de parámetros.
- [ ] **Step 3: implementar.**
  - **Auditorías:** sustituir la consulta por la de la spec §2.2.
  - **Panel:** quitar `lifecycle` de los dos `select` anidados; leer `prisma.controlledRevisionLifecycle.findMany({ where: { documentId: { in: documentIds } }, select: { revisionId, documentId, effectiveFrom, reviewDueAt } })`, donde `documentIds` son los únicos de las revisiones; volver a poner `lifecycle` en cada revisión, con `null` si no hay, con un `Map` por `revisionId`.

    Si con más de 200 documentos el `IN` supera el umbral del smoke, usar SQL directo con `LEFT JOIN` filtrado por las mismas condiciones y anotar la decisión.
- [ ] **Step 4: ejecutar** `pnpm be1c:smoke`. Esperado: PASS. Después, en una base nueva: `phase3b2:smoke`, `dashboard-d1b:smoke`, `audits-r3a:smoke`, `audits-r3b:smoke`, `audits-r4b:smoke`, `audits-annual:smoke`, `be1a:smoke` y `be1b:smoke` (navegador). Todo PASS.
- [ ] **Step 5: verificar y commit.** tsc, lint y vitest; regenerar los inventarios del historial si cambian hashes.

### Task 3: Medición «después», documentación y PR

**Files:**
- Create: `docs/PHASE_BE1C.md`
- Modify: `docs/DECISIONS.md` (D-114), `docs/CURRENT_STATUS.md`, `docs/V1_BASELINE_AND_BACKLOG.md` (fila BE1: A, B y C hechos), `docs/ROADMAP.md` (BE1 completa y nueva medición en la fase 5)

- [ ] **Step 1: medir «después»** con las mismas cohortes (`BE1_MODE=after`, `BE1_OUTPUT=$S/be1c-after`) en una base nueva y en la misma máquina.
- [ ] **Step 2: `docs/PHASE_BE1C.md`:**
  - método;
  - la tabla de la exploración previa (casos, causa y `EXPLAIN`);
  - antes/después del panel, Auditorías con PDF y búsqueda por lote (control), con 1.000/5.000/20.000;
  - lo descartado y por qué;
  - qué medir con datos reales.
- [ ] **Step 3: decisiones y estado.**
  - D-114: JIT desactivado en la aplicación; sin índices nuevos y motivo; nueva medición tras DATA1.
  - CURRENT_STATUS, V1_BASELINE y ROADMAP.
- [ ] **Step 4: verificación final** (lint, tsc, vitest, `prisma validate` y build). Commit, push y PR con suscripción y revisión a los 50 minutos. Fusión en verde (autorizada).

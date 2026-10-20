# BE1-A — Ficheros fuera de las lecturas por defecto: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el cliente Prisma de la aplicación no lea los bytes de fichero salvo donde se usan, con medición antes/después en los ocho módulos.

**Architecture:** el cliente de la aplicación se construye en un módulo sin efectos (`src/lib/db-client.ts`) con la opción `omit` de Prisma 6 para los siete modelos con `Bytes`. Los consumidores de bytes los piden con `omit: { fileData: false }` o con `fileData: true` en un `select`. Un inventario unitario fija qué archivos leen bytes. Un smoke PostgreSQL exige 0 bytes en listados, fichas y formularios. Un script mide antes y después.

**Tech Stack:** Next.js 15, TypeScript, Prisma 6.16, PostgreSQL 16, vitest, tsx.

**Spec:** `docs/superpowers/specs/2026-10-20-be1a-ficheros-fuera-de-lecturas-design.md`

## Global Constraints

- **Modelos excluidos:** `TemplateVersion`, `RecordVersionDocument`, `GeneratedDocument`, `ControlledRevisionDocument`, `AuditAnnualProgrammeVersion`, `AuditCapaPlanVersion`, `AuditTrailExport`. En todos, el campo es `fileData`.
- **Sin cambios de:** pantallas, permisos, checksums, custodia inmutable, `prisma/schema.prisma` ni migraciones.
- **Cohortes de medición:** 1.000, 5.000 y 20.000 expedientes ficticios por módulo, con la mediana de 3 muestras tras 1 calentamiento. PostgreSQL 16 con 1 CPU y 1 GiB si el entorno lo permite; si no, se declara el entorno real.
- **Datos:** solo ficticios. Base aislada `covex_phase3b2_*`, o el entorno aislado de test, o CI desechable, con la misma guarda que `assertPhase3b2Database()`.
- **Antes de cada commit:** `git checkout -- next-env.d.ts`. No se commitean salidas de medición crudas ni `tmp-verify/`.
- **Commits** con el trailer de la sesión. Nada de identificadores de modelo en commits ni en la PR.

## Review Focus

1. **Descarga de plantilla desde Configuración** (`src/app/api/settings/templates/[id]/download/route.ts`, que no menciona `fileData`): debe devolver los bytes completos. Se prueba en Task 3.
2. **Generación de Word desde plantilla** (Anexo III de Desviación, CAPA, Cambios, Reclamaciones, Devoluciones y OOS): la plantilla debe llegar con sus bytes; un error aquí rompería la generación. Se prueba en Task 3.
3. **Versión nueva que copia documentos o plantilla de otra fila:** la copia conserva los bytes y el SHA-256. Se prueba en Task 3.
4. **Valor devuelto por `create`/`update`/`upsert`** de los siete modelos, usado después como si llevara bytes (p. ej. para calcular checksum o responder): debe seguir funcionando. Se revisa en Task 2 y se cubre por la regresión de Task 3.
5. **Exportaciones del historial** (`audit-trail/exports`) y **copia de seguridad o recuperación** (`phase4b2-recovery`): bytes íntegros. Se cubren por la regresión de Task 3.

---

### Task 1: Arnés de medición BE1 y línea base «antes»

**Files:**
- Create: `scripts/be1-fixtures.ts`
- Create: `scripts/benchmark-be1.ts`
- Modify: `package.json` (script `be1:benchmark`)

**Interfaces:**
- Consumes: `createPhase3b2Fixtures(size, freezeHistory, documentarySnapshots)` y `assertPhase3b2Database()` de `scripts/phase3b2-fixtures.ts`. El primero devuelve `{ prefix, departments, ids: string[][] /* [DEV, CAPA, CC, COMPLAINT, RETURN, AUDIT] */, qmsIds, bytes, checksum, cleanup }`.
- Produces: `createBe1Fixtures(size: number): Promise<Be1Fixture>` con `Be1Fixture = Phase3b2Fixture & { oosIds: string[]; binaryDetail: { deviation: string; capa: string; change: string; audit: string; oos: string }; cleanup(): Promise<void> }`; y la salida JSON `{ mode, size, name, median: { ms, sqlCount, materializedMetadataBytes, materializedBinaryBytes, rssDeltaMiB }, samples }[]` en `$BE1_OUTPUT/benchmark-<mode>.json`, más `custody-<size>.json` con `{ model, rows, totalBytes, p95Bytes }[]`.

- [ ] **Step 1: `createBe1Fixtures`**
  - Llama a `createPhase3b2Fixtures(size, false, true)`.
  - Añade `size` registros OOS con `createMany`, con el mismo prefijo y departamentos.
  - Para el registro `ids[m][1]` de Desviación, CAPA y Cambios, y para un OOS y una Auditoría, crea con los `bytes` del fixture: una `TemplateVersion` inactiva enlazada como plantilla del expediente cuando el modelo tenga esa relación, dos `GeneratedDocument` y un `RecordVersionDocument` (PDF firmado) en su versión.
  - `cleanup` borra lo añadido y después llama al `cleanup` de 3B2.
- [ ] **Step 2: `benchmark-be1.ts`**, con la estructura de `benchmark-phase3b2.ts` (cliente instrumentado inyectado en `globalThis.prisma`, `measure` con calentamiento y 3 muestras).
  - **Guardas:** `BE1_BENCHMARK=1`, `BE1_OUTPUT` y `assertPhase3b2Database()`.
  - **Modo `BE1_MODE=before|after`:**
    - `before` crea `new PrismaClient({ log: [{ emit: "event", level: "query" }] })`;
    - `after` crea `createAppPrismaClient([{ emit: "event", level: "query" }])`, importado dinámicamente de `src/lib/db-client.ts` (Task 3).
  - **Casos:**
    - primera página de los 8 listados: `getDeviationList`, `getCapaList`, `getChangeControlList`, `getComplaintList`, `getReturnList`, `getAuditList`, `getOosList` y `queryPntListing({ q: prefix })`;
    - los filtros por lista de ids: lote en Reclamaciones y OOS, seguimiento `DUE` en Devoluciones, PDF firmado en Auditorías;
    - las fichas `getDeviationDetail`, `getCapaDetail`, `getChangeControlDetail`, `getComplaintDetail`, `getReturnDetail`, `getAuditDetail` y `getOosDetail` sobre los ids de `binaryDetail` (y `ids[3][1]`, `ids[4][1]`);
    - los formularios `getDeviationFormLookups`, `getCapaLookups` y `getChangeControlLookups`;
    - `getDashboardData` como control.
  - **Volumen de custodia:** con SQL directo `SELECT count(*), sum(octet_length("fileData")), percentile_cont(0.95) WITHIN GROUP (ORDER BY octet_length("fileData"))` por tabla.
  - **Cohortes:** `BE1_SIZES`, por defecto `1000,5000,20000`.
- [ ] **Step 3: medir que funciona.** Con una base nueva (`r5a.env` o `covex_phase3b2_be1`): `BE1_BENCHMARK=1 BE1_MODE=before BE1_SIZES=1000 BE1_OUTPUT=$S/be1 PHASE3B2_SYNTHETIC_DATABASE=1 pnpm -s be1:benchmark`.
  - Esperado: el JSON tiene todos los casos.
  - `materializedBinaryBytes > 0` al menos en las fichas de Desviación, CAPA y Cambios y en sus formularios.
- [ ] **Step 4: línea base completa** con `BE1_SIZES=1000,5000,20000`. Guardar `benchmark-before.json` en el scratchpad; no se commitea. Anotar en el registro del plan el entorno (CPU, RAM, versión de PG y Node).
- [ ] **Step 5: tsc, lint y commit** de `scripts/be1-fixtures.ts`, `scripts/benchmark-be1.ts` y `package.json`.

### Task 2: Consumidores de bytes explícitos e inventario

**Files:**
- Create: `src/lib/db-binary-omit.ts`
- Create: `src/lib/db-binary-omit.test.ts`
- Modify: los consumidores de bytes. Lista inicial: los 27 archivos de `src` que hoy mencionan `fileData`, más los que aparezcan en el Step 1.

**Interfaces:**
- Produces: `export const binaryOmit = { templateVersion: { fileData: true }, recordVersionDocument: { fileData: true }, generatedDocument: { fileData: true }, controlledRevisionDocument: { fileData: true }, auditAnnualProgrammeVersion: { fileData: true }, auditCapaPlanVersion: { fileData: true }, auditTrailExport: { fileData: true } } as const satisfies Prisma.GlobalOmitConfig;` y `export const withBytes = { fileData: false } as const;` (forma única para pedir los bytes en un `omit`).

- [ ] **Step 1: localizar los consumidores**, sin limitarse a la palabra `fileData`. Con grep:
  - accesos `\.(templateVersion|recordVersionDocument|generatedDocument|controlledRevisionDocument|auditAnnualProgrammeVersion|auditCapaPlanVersion|auditTrailExport)\.`;
  - inclusiones `(templateVersion|TemplateVersion|generatedDocuments|documents|programmeVersions|versions): true` y `include:` sobre esos modelos.

  Para cada uso, anotar en el registro del plan si **lee bytes**, **copia una fila** (`{ ...row }` hacia `create`, `createMany` o `upsert`), **usa el valor devuelto** por una escritura, o **solo metadatos**. Incluir obligatoriamente la descarga de plantillas de Configuración, la generación de Word de los seis módulos con plantilla, el versionado (`src/lib/qms/versioning.ts`) y las acciones de Cambios.
- [ ] **Step 2: test del inventario (falla primero).** En `src/lib/db-binary-omit.test.ts`:
  - `it("binaryOmit cubre exactamente los modelos con Bytes")`: lee `prisma/schema.prisma`, extrae los modelos con un campo `Bytes` y compara (con `expect(...).toEqual`) la lista de nombres en camelCase con `Object.keys(binaryOmit).sort()`.
  - `it("solo los consumidores revisados leen bytes")`: recorre `src`, sin `*.test.*` ni `db-binary-omit.ts`, y compara con `toEqual` los archivos que contienen `fileData` con `REVIEWED_BINARY_CONSUMERS`, un array ordenado de rutas relativas definido en el test.
- [ ] **Step 3: ejecutar** `env -i PATH=$PATH HOME=$HOME pnpm exec vitest run src/lib/db-binary-omit.test.ts`. Esperado: FAIL, porque no existe `db-binary-omit.ts`.
- [ ] **Step 4: crear `src/lib/db-binary-omit.ts`** y, en cada consumidor que lee bytes, pedirlos expresamente:
  - `omit: withBytes` en consultas sin `select`;
  - `fileData: true` si ya hay `select`;
  - en relaciones anidadas, `include: { templateVersion: { omit: withBytes } }`.

  Las copias de fila (Step 1) se reescriben para releer la fila con `omit: withBytes` antes de copiar, o para copiar desde la fuente que ya tiene los bytes. Con el cliente actual, sin `omit` global, todo esto no cambia nada en ejecución.
- [ ] **Step 5: completar `REVIEWED_BINARY_CONSUMERS`** con el resultado del Step 1 y del Step 4, y volver a ejecutar el test. Esperado: PASS.
- [ ] **Step 6: verificar** tsc, lint y `env -i PATH=$PATH HOME=$HOME pnpm exec vitest run` (toda la suite en verde). Commit.

### Task 3: Activar la exclusión y smoke `be1a:smoke`

**Files:**
- Create: `src/lib/db-client.ts`
- Modify: `src/lib/db.ts`
- Create: `scripts/smoke-be1a-binaries.ts`
- Modify: `package.json` (`be1a:smoke`), `.github/ci-suites.json` (grupo `postgresql`)

**Interfaces:**
- Consumes: `binaryOmit` y `withBytes` (Task 2); `createBe1Fixtures` (Task 1).
- Produces: `export function createAppPrismaClient(log?: Prisma.LogDefinition[] | Prisma.LogLevel[]): PrismaClient` en `src/lib/db-client.ts`, sin efectos al importarse. Contiene la construcción con `omit: binaryOmit` y la extensión `$allOperations` que hoy está en `db.ts`. `db.ts` queda como `globalForPrisma.prisma ?? createAppPrismaClient(nivelesActuales)` y conserva `contextualDatabase` y la caché global.

- [ ] **Step 1: escribir el smoke (falla primero).** `scripts/smoke-be1a-binaries.ts`, que se ejecuta con `node --conditions=react-server --import tsx`:
  - inyecta en `globalThis.prisma` un cliente de `createAppPrismaClient([{ emit: "event", level: "query" }])` y registra cada SQL;
  - crea `createBe1Fixtures(100)`;
  - para cada listado, ficha y formulario de la lista de Task 1, asserta que ningún SQL emitido contiene `"fileData"` y que el resultado no tiene ninguna clave `fileData` (con la función `hasBinary` de `smoke-phase3b2-documents.ts`);
  - asserta que `prisma.generatedDocument.findFirstOrThrow({ where: { id } })` sobre el cliente de la app no tiene la propiedad `fileData`, y que con `omit: withBytes` la tiene con `fixture.checksum`;
  - **descargas:** llama a los handlers de ruta de los PDF firmados (Desviación, CAPA, Cambios, Reclamaciones, OOS y Devoluciones), de los documentos de Devoluciones, de la descarga de plantilla de Configuración y de las evidencias. Cada uno debe responder 200 con bytes iguales a `fixture.bytes` y SHA-256 igual a `fixture.checksum`, como `verify()` en `smoke-phase3b2-documents.ts`;
  - **generación:** genera el Word del Anexo III de una Desviación a partir de una `TemplateVersion` válida con el servicio de generación que use la página, y asserta que el documento generado tiene bytes y checksum coherentes;
  - **copia:** crea una versión nueva del expediente con PDF firmado con el servicio de versionado y asserta que los documentos copiados conservan bytes y SHA-256;
  - en `finally`, ejecuta `fixture.cleanup()`.
- [ ] **Step 2: ejecutar** con una base nueva: `pnpm -s be1a:smoke`. Esperado: FAIL, porque `createAppPrismaClient` no existe; tras crearlo **sin** `omit`, FAIL porque las fichas emiten SQL con `"fileData"`. Anotar los dos RED en el registro.
- [ ] **Step 3: crear `src/lib/db-client.ts` con `omit: binaryOmit`** y adaptar `db.ts`.
- [ ] **Step 4: ejecutar `pnpm -s be1a:smoke`.** Esperado: PASS, con «BE1-A OK: 0 bytes en listados/fichas/formularios; descargas, generación y copias íntegras».
- [ ] **Step 5: regresión local** sobre una base nueva:
  - `phase3b2:smoke`, `versioning:smoke` y los smokes de PDF firmados, evidencias y plantillas (`template-install-d105:smoke`);
  - `pnt-p2a`/`p2b`/`p2c`, `audits-r3c`, `audits-annual` y `phase4b2-recovery`;
  - los grupos de navegador `browser-qms`, `browser-audits` y `records-r4c` con `run-r5a.sh`, tras `pnpm build`.

  Todo PASS. Si algo falla, el consumidor que falta vuelve a Task 2 (Step 4) y al inventario.
- [ ] **Step 6: verificar** tsc, lint, vitest completo, `prisma validate` y build. Añadir `be1a:smoke` a `ci-suites.json` (grupo `postgresql`). Commit.

### Task 4: Medición «después», documentación y PR

**Files:**
- Create: `docs/PHASE_BE1A.md`
- Modify: `docs/DECISIONS.md` (D-112), `docs/CURRENT_STATUS.md`, `docs/V1_BASELINE_AND_BACKLOG.md` (fila BE1), `docs/ROADMAP.md` (BE1-B/C pendientes de aprobación)

- [ ] **Step 1: medir con el cambio.** Ejecutar `BE1_MODE=after` con las mismas cohortes, en la misma máquina y con la misma build. Esperado: `materializedBinaryBytes` = 0 en todos los casos salvo el control de custodia; los resultados funcionales no cambian.
- [ ] **Step 2: escribir `docs/PHASE_BE1A.md`**:
  - entorno y método;
  - tabla por cohorte y caso con «antes» y «después» (ms, SQL, MiB de fichero y RSS);
  - volumen de custodia por tabla;
  - conclusiones;
  - lo que queda para BE1-B/C y para IT.

  Sin datos reales.
- [ ] **Step 3: decisiones y estado.**
  - D-112 en DECISIONS: exclusión por defecto, cómo pedir bytes, inventario y límite del compilador en transacciones.
  - CURRENT_STATUS: entrada BE1-A.
  - V1_BASELINE: BE1 «A hecho (#PR); B y C pendientes».
  - ROADMAP: B y C descritos.
- [ ] **Step 4: verificación final** (lint, tsc, vitest, `prisma validate` y build). Commit, push y PR con el método vigente (suscripción y revisión a los 50 min). La fusión requiere la confirmación del responsable para esta PR.

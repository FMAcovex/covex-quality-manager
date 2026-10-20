# BE1-B — Registro de errores con referencia visible: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que cada fallo del servidor deje una línea JSON en la salida estándar con una referencia que el usuario ve, sin datos de negocio.

**Architecture:**
- Un registrador puro, `src/lib/log/server-log.ts`, escribe con `process.stdout.write`, por encima del envoltorio seguro de 4B2, y solo con metadatos fijos.
- Captura en tres puntos:
  - `onRequestError` de Next.js, con `ref` igual al `digest` visible;
  - la rama genérica de `persistenceFormError`, con referencia `E-…` en el mensaje;
  - los `catch` de servidor que ocultan fallos reales.
- Una prueba estática impide nuevos `catch` vacíos sin registro ni justificación.

**Tech Stack:** Next.js 15.5 (`onRequestError` en `instrumentation.ts`), TypeScript, vitest, tsx/Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-be1b-registro-de-errores-design.md`

## Global Constraints

- **Campos de cada línea:**
  - `service: "covex-quality-manager"`, `event`, `level: "error"`, `at` (ISO);
  - `ref`, `operation`, `module` y `userId` (UUID o `null`);
  - `errorName`;
  - `prismaCode` y `prismaModel`, solo en errores conocidos de Prisma;
  - `frames`, como máximo 10, sin la primera línea de la traza.
- **Nunca se escribe:** el mensaje del error, `cause`, `meta` completo, argumentos, cuerpos, cabeceras, cookies, SQL, valores de formulario, nombre ni correo.
- **Formato de la referencia generada:** `^E-[0-9a-f]{8}$`. La de errores no controlados es el `digest` de Next.js.
- **Texto visible de la rama genérica:** «Se ha producido un error inesperado de persistencia. Los datos no se han guardado. Revisa los campos e inténtalo de nuevo. Referencia para IT: E-xxxxxxxx.»
- **Límites técnicos:** sin librerías nuevas ni migraciones. `installSafeLogging` no se toca. El registrador no se importa en componentes `"use client"`.
- **Antes de cada commit:** `git checkout -- next-env.d.ts`. Commits con el trailer de la sesión y sin identificadores de modelo.

## Review Focus

1. **Error sin `stack` o lanzado como no-`Error`** (cadena, `null`, objeto circular): la línea se escribe igual y el registrador no lanza. Test en Task 1.
2. **Mensaje de Prisma con valores de formulario** (los `PrismaClientValidationError` incluyen los argumentos): no aparecen en la línea. Test en Task 1.
3. **`onRequestError` llamado sin `digest`** (rutas API): se genera una `E-…` y no falla. Test en Task 2.
4. **Petición con consulta en la URL** (`?q=lote-secreto`): no aparece en la línea, solo `routePath`. Test en Task 2.
5. **Fallo dentro del propio registrador** (stdout cerrado): no rompe la respuesta al usuario. Test en Task 1 con un `write` que lanza.

---

### Task 1: Registrador común

**Files:**
- Create: `src/lib/log/server-log.ts`
- Test: `src/lib/log/server-log.test.ts`

**Interfaces:**
- Produces:
  - `export type ServerErrorContext = { ref?: string; operation?: string; module?: string; userId?: string | null }`;
  - `export function newErrorReference(): string`, que devuelve `E-` + 8 hexadecimales con `randomBytes(4)`;
  - `export function serverErrorLine(event: string, error: unknown, context: ServerErrorContext & { ref: string; at: Date }): string`, una línea JSON sin salto final;
  - `export function logServerError(event: string, error: unknown, context?: ServerErrorContext, write?: (line: string) => void): string`, que devuelve la `ref`.

  Por defecto, `logServerError` toma `userId` de `currentIdentity()?.principal.id ?? null` (`@/lib/auth/context`) y `write` es `line => process.stdout.write(line + "\n")`.

- [ ] **Step 1: tests (fallan primero)** en `server-log.test.ts`:
  - `serverErrorLine produce los campos fijos`:
    - entrada: `new TypeError("boom con dato-secreto-123")`, `{ ref: "E-0000abcd", operation: "saveDeviation", module: "DEVIATION", userId: "11111111-1111-1111-1111-111111111111", at: new Date("2026-10-20T10:00:00Z") }`;
    - el JSON parseado tiene `service`, `event`, `level: "error"`, `at: "2026-10-20T10:00:00.000Z"`, `ref`, `operation`, `module`, `userId`, `errorName: "TypeError"` y `frames` (array).
  - `no escribe el mensaje, cause ni meta`:
    - errores con `"dato-secreto-123"` en el mensaje, en `cause` y en un `PrismaClientKnownRequestError` con `meta: { target: ["dato-secreto-123"], modelName: "Deviation" }`;
    - la línea no contiene `dato-secreto-123`;
    - para el de Prisma, `prismaCode: "P2002"` y `prismaModel: "Deviation"`.
  - `PrismaClientValidationError no filtra argumentos`:
    - `new Prisma.PrismaClientValidationError("Argument whatHappened: dato-secreto-123", { clientVersion: "test" })`;
    - la línea no contiene `dato-secreto-123`.
  - `recorta a 10 frames sin la línea del mensaje`:
    - un error con `stack` de 1 línea de mensaje y 15 `    at f (x.ts:1:1)`;
    - `frames.length === 10` y ningún frame contiene el mensaje.
  - `acepta valores que no son Error`:
    - para `"texto"`, `null`, `undefined`, `{}` y un objeto circular, la línea es JSON válido;
    - `errorName` es `"string"`, `"null"`, `"undefined"`, `"Object"` y `"Object"`;
    - `frames` es `[]`.
  - `newErrorReference sigue el formato`: 50 llamadas cumplen `/^E-[0-9a-f]{8}$/`.
  - `logServerError devuelve la ref y escribe una línea`:
    - con `write` espía, devuelve la `ref` recibida (`"abc123"`, un digest) o una `E-…`;
    - escribe exactamente una línea.
  - `logServerError no lanza si write falla`: con un `write` que lanza, devuelve igualmente la `ref`.
- [ ] **Step 2: ejecutar.** `env -i PATH=$PATH HOME=$HOME pnpm exec vitest run src/lib/log/server-log.test.ts`. Esperado: FAIL porque no existe el módulo.
- [ ] **Step 3: implementar** en `src/lib/log/server-log.ts`, con `import "server-only"`.
  - `errorName`: `error.constructor?.name` para objetos; `typeof`, o `"null"`, para el resto.
  - `frames`: `stack.split("\n").slice(1).map(trim).filter(l => l.startsWith("at ")).slice(0, 10)`.
  - Serializar con `JSON.stringify` de un objeto construido a mano, sin pasar nunca el error.
  - Envolver todo en `try/catch`. Si falla, escribir `{service, event, level, at, ref}`. Si también falla el `write`, ignorarlo.
- [ ] **Step 4: ejecutar el test.** Esperado: PASS. Después: `pnpm exec tsc --noEmit -p .` y `pnpm exec eslint src/lib/log`.
- [ ] **Step 5: commit.**

### Task 2: Errores no controlados (`onRequestError`)

**Files:**
- Modify: `src/instrumentation.ts` (añadir el export).
- Create: `src/lib/log/request-error.ts`, para que la lógica sea testeable sin Next.
- Modify: `src/app/error.tsx` (quitar el `useEffect` que escribe en la consola).
- Test: `src/lib/log/request-error.test.ts`

**Interfaces:**
- Consumes: `logServerError` (Task 1).
- Produces:
  - `export function handleRequestError(error: unknown, request: { path: string; method: string }, context: { routePath: string; routeType: string }, write?: (line: string) => void): string`;
  - en `instrumentation.ts`: `export async function onRequestError(...args)`, que importa dinámicamente `./lib/log/request-error` solo si `process.env.NEXT_RUNTIME === "nodejs"` y llama a `handleRequestError`.

- [ ] **Step 1: tests (fallan primero).**
  - `usa el digest como ref`: con `Object.assign(new Error("x"), { digest: "2931774425" })`, `{ path: "/deviations/abc?q=lote-secreto", method: "GET" }` y `{ routePath: "/deviations/[id]", routeType: "render" }`:
    - la línea tiene `ref: "2931774425"`, `event: "request.unhandled"`, `operation: "GET /deviations/[id]"` y `module: "render"`;
    - no contiene `lote-secreto` ni `/deviations/abc`.
  - `sin digest genera una E-`: la `ref` cumple `/^E-[0-9a-f]{8}$/`.
- [ ] **Step 2: ejecutar.** Esperado: FAIL porque no existe el módulo.
- [ ] **Step 3: implementar** `handleRequestError` y el export `onRequestError`. Quitar de `error.tsx` el `useEffect` y su import si queda sin uso; la página y la «Referencia técnica» no cambian.
- [ ] **Step 4: ejecutar.**
  - el test: Esperado: PASS;
  - `env -i PATH=$PATH HOME=$HOME pnpm exec vitest run`: todo en verde, incluidos los inventarios de autorización y de escritores;
  - si fallan los inventarios del historial, regenerarlos con el procedimiento del repo (`scripts/audit-writer-inventory.ts` y `scripts/audit-policy-catalog.ts`).
- [ ] **Step 5: commit.**

### Task 3: Referencia en los fallos inesperados al guardar

**Files:**
- Modify: `src/lib/forms/persistence-error.ts` (rama final).
- Test: `src/lib/forms/persistence-error.test.ts`

**Interfaces:**
- Consumes: `logServerError` y `newErrorReference` (Task 1).
- Produces: `persistenceFormError(error, entityLabel, options: { duplicateField?: string; write?: (line: string) => void } = {})`. `write` solo sirve para tests; por defecto se usa la salida estándar.

- [ ] **Step 1: tests (fallan primero).**
  - `la rama genérica registra y muestra la referencia`:
    - con `persistenceFormError(new Error("fallo interno dato-secreto"), "la desviación", { write })`, `fieldErrors[0]` cumple `/Referencia para IT: (E-[0-9a-f]{8})\.$/`;
    - `write` se llamó una vez con una línea que tiene esa misma `ref`, `event: "action.persistence"` y `operation: "la desviación"`, y que no contiene `dato-secreto`.
  - `las ramas esperadas no registran`: con P2002, P2003, P2025, `PrismaClientValidationError` y el motivo crítico, `write` no se llama.
  - Se adapta el test existente de la rama genérica, si lo hay, al texto nuevo.
- [ ] **Step 2: ejecutar** `vitest run src/lib/forms/persistence-error.test.ts`. Esperado: FAIL.
- [ ] **Step 3: implementar.** `const ref = logServerError("action.persistence", error, { operation: entityLabel }, options.write)`. El texto visible es el de Global Constraints.
- [ ] **Step 4: verificar.** El test pasa, la suite vitest completa pasa y `grep -rn "error inesperado de persistencia" scripts` no deja ninguna prueba con el texto antiguo exacto; si lo hay, se adapta.
- [ ] **Step 5: commit.**

### Task 4: `catch` que ocultan fallos y prueba estática

**Files:**
- Create: `src/lib/log/silent-catch.test.ts`
- Modify: los archivos de servidor cuyos `catch` se clasifiquen como «oculta un fallo». La lista sale del Step 1.

**Interfaces:**
- Consumes: `logServerError` (Task 1).

- [ ] **Step 1: clasificar.**
  - Listar con `grep -rnE "catch *(\([^)]*\))? *\{" src --include=*.ts --include=*.tsx`, sin tests, y `.catch(() =>` sin registro.
  - Para cada uno, anotar en el registro del plan `archivo:línea — oculta fallo | entrada esperada | cliente`, con el criterio de la spec §3.4.
  - Sin cuerpo pero con comentario justificado cuenta como «entrada esperada».
- [ ] **Step 2: test estático (falla primero)** `silent-catch.test.ts`, `ningún catch de servidor descarta un error sin registro ni justificación`:
  - recorre `src`, sin `*.test.*` ni archivos con `"use client"` en su primera línea;
  - para cada `catch` (sintaxis `catch {`, `catch (x) {` y `.catch(() =>`), toma el bloque hasta su `}` de cierre, contando llaves;
  - falla si el bloque no contiene `logServerError`, ni un comentario (`//` o `/*`), ni usa la variable capturada (`throw`, `return` con ella o pasarla a otra función);
  - el mensaje del fallo lista `archivo:línea`.

  Esperado en el primer run: FAIL con la lista de los «oculta fallo» y de los legítimos sin comentario.
- [ ] **Step 3: corregir.**
  - Los «oculta fallo» pasan a `logServerError("<modulo>.<operacion>", error, { module })`, sin cambiar lo que ve el usuario ni el valor devuelto.
  - Los legítimos reciben un comentario breve del motivo, por ejemplo `/* Entrada del usuario mal formada: se trata como vacía. */`.
  - Si un `catch` de cliente oculta un fallo, se deja como está y se anota: el registrador es solo de servidor.
- [ ] **Step 4: verificar.**
  - el test estático pasa;
  - vitest completo, tsc y lint pasan;
  - se regeneran los inventarios del historial si cambian hashes.
- [ ] **Step 5: commit.**

### Task 5: Smoke de extremo a extremo, documentación y PR

**Files:**
- Create: `scripts/smoke-be1b-error-log.ts`
- Modify: `package.json` (`be1b:smoke`), `.github/ci-suites.json` (grupo `browser-qms`, una línea añadida sin reformatear el archivo)
- Modify: `docs/DECISIONS.md` (D-113), `docs/PHASE_4B2.md` §14, `docs/CURRENT_STATUS.md`, `docs/V1_BASELINE_AND_BACKLOG.md` (fila BE1), `docs/ROADMAP.md` (línea BE1)

- [ ] **Step 1: smoke (falla primero si se ejecuta sobre la build anterior a Task 2).** `be1b:smoke`:
  - lee el registro del servidor de `process.env.BE1B_SERVER_LOG ?? "ci-evidence/browser-qms-server.log"`;
  - **forma preferente:** pide con `fetch` una página autenticada con una cookie de sesión ficticia y bien formada a un segundo `next start` que el propio smoke arranca en el puerto 3100, con `DATABASE_URL` apuntando a una base inexistente (`…/covex_be1b_unreachable`) y su salida a un archivo temporal. La validación de la sesión falla en la base, se pinta la página de error y el HTML contiene `Referencia técnica: <code>DIGEST</code>`;
  - asserta que el registro de ese servidor tiene una línea JSON con `event: "request.unhandled"` y `ref: DIGEST`, sin la cookie ni la consulta;
  - si la página de error no aparece así (por ejemplo, porque redirige a login sin tocar la base), probar a acceder a una ruta con identidad de prueba. Si tampoco funciona, aplicar el Ruling: el smoke comprueba la línea con `ref` igual a la cabecera o el cuerpo de error de una ruta API que falle por base inaccesible, y la coincidencia digest–página queda cubierta por el test de Task 2. Se anota en el registro del plan.
- [ ] **Step 2: ejecutar** con la build actual (`pnpm build` y `run-r5a.sh be1b:smoke` con `BE1B_SERVER_LOG` local). Esperado: PASS («BE1-B OK: la referencia visible está en el registro del servidor»).
- [ ] **Step 3: documentación.**
  - **D-113:** registro operativo, campos, exclusiones, relación con `installSafeLogging`, la prueba estática de `catch`, y que no es audit trail.
  - **`PHASE_4B2.md` §14:** cómo buscar una referencia, por ejemplo `docker compose logs app | grep '"ref":"E-7f3a9c2b"'` o `journalctl -u covex-quality | grep '"ref":"2931774425"'`, y la tabla de campos.
  - **CURRENT_STATUS, V1_BASELINE y ROADMAP:** BE1-B hecho y BE1-C pendiente.
- [ ] **Step 4: verificación final.**
  - lint, tsc, vitest, `prisma validate` (con el entorno r5a) y build;
  - regresión local de los grupos `postgresql`, `browser-qms` y `browser-audits` en una base nueva.
- [ ] **Step 5: commit, push y PR.** Suscripción y revisión a los 50 minutos. Fusión cuando esté en verde (autorizada por el responsable para esta PR).

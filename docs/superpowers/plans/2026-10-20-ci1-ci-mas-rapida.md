# CI1 — CI más rápida sin quitar pruebas: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** bajar la espera de una PR de ~9,5 a ~6,5–7 min sin omitir ninguna suite, con un resumen legible en cada ejecución y una batería completa nocturna y manual sobre `main`.

**Architecture:**
- `ci-suites.json` se reparte en grupos más pequeños.
- Vitest pasa a un trabajo propio (`unit`).
- El grupo sin navegador ni servidor (`postgresql`) corre en `regression-db`, sin esperar al build.
- Contratos Python fijan que el flujo y el inventario coinciden.
- El runner y la compuerta escriben un resumen en `GITHUB_STEP_SUMMARY`.
- `ci.yml` añade `schedule` y `workflow_dispatch`.

**Tech Stack:** GitHub Actions, Python 3 (stdlib, `unittest`), pnpm, Next 15, PostgreSQL 16.

**Spec:** `docs/superpowers/specs/2026-10-20-ci1-ci-mas-rapida-design.md`

## Global Constraints

- **Inventario íntegro.** Ninguna suite se retira, omite ni duplica. `test_inventory_does_not_drop_any_existing_smoke` sigue pasando.
- **Sin selección por impacto.** Solo la ruta actual «solo documentación» omite pruebas.
- **`browser-qms` conserva el nombre**, porque lo usa `be1b:smoke`.
- **Contenido del resumen:** solo nombres de grupo y suite, segundos, estado, `failureKind` y nombre de fichero de registro. Nunca `error`, salida de suites, URLs ni secretos.
- **Programación:** cron `17 3 * * *` (UTC). Fuera de PR, el SHA probado es `github.sha` y no se cancela la ejecución en curso.
- **Sin dependencias nuevas.** Python solo con stdlib; el parseo de `ci.yml` se hace por texto, sin PyYAML.
- **Antes de cada commit:** `git checkout -- next-env.d.ts`. Trailer de sesión y sin identificadores de modelo.

## Review Focus

1. **Una suite que dependía de datos de otra del mismo grupo antiguo.** Con el reparto queda en una base nueva y falla. Se comprueba en local en la Task 1, ejecutando cada grupo nuevo sobre una base nueva.
2. **`regression-db` en verde, pero la compuerta no exige su evidencia** (o la del grupo `postgresql` llega de otro SHA): la PR quedaría verde sin regresión de base de datos. Test en la Task 1.
3. **Ejecución programada con `github.event.pull_request` vacío:** checkout, nombre del artefacto, `TESTED_SHA` y concurrencia no deben romperse ni cancelar la batería nocturna. Test de `scope` y revisión del YAML en la Task 3. Ejecución manual en `main` tras la fusión.
4. **Un fallo de infraestructura antes de la primera suite** (Next no arranca): el resumen debe seguir escribiéndose con `failureKind=infrastructure` y sin la salida del error. Test en la Task 2.
5. **Un resumen con el texto de una excepción o de una suite** que contenga datos o URLs: prohibido. Test en la Task 2 con una salida que incluye una URL y un texto reconocible.

---

### Task 1: Reparto de grupos, `unit` y `regression-db`, con contratos

**Files:**
- Modify: `.github/ci-suites.json`, `.github/workflows/ci.yml`, `.github/scripts/ci_gate.py`, `.github/scripts/test_ci_contract.py`

**Interfaces:**
- Produces:
  - `ci_gate.evaluate(sha, classified_sha, documentation, needs, evidence, groups) -> list[str]`, con la firma de hoy. Exige en `needs` los trabajos `scope`, `unit`, `quality`, `regression-db` y `regression`, y en la evidencia `unit`, `quality` y cada grupo.
  - Constante `REQUIRED_JOBS = ["unit", "quality", "regression-db", "regression"]` en `ci_gate.py`.
  - Evidencia `ci-evidence/unit.json` = `{"group": "unit", "sha": …, "status": "success"}`, igual que `quality.json`.

- [ ] **Step 1: tests (fallan primero)** en `test_ci_contract.py`:
  - `setUp`: `needs` con las claves `scope`, `unit`, `quality`, `regression-db` y `regression`; evidencia `unit` como la de `quality`.
  - `test_workflow_matrix_matches_groups`:
    - toma la línea `group: [ … ]` de `ci.yml` y comprueba que su conjunto es igual a `{g for g, s in groups.items() if s["ui"] or s.get("security")}`;
    - comprueba que los grupos restantes son exactamente `{"postgresql"}` y que `ci.yml` contiene `run_ci_group.py postgresql` dentro del job `regression-db:`.
  - `test_groups_are_balanced`: con las duraciones medidas de la spec §3.1 en un diccionario del propio test, ningún grupo supera los 180 s. Si una suite no tiene duración, cuenta 2 s.
  - `test_each_job_failure_skip_cancel_absence` ya recorre `self.needs`, así que cubre `unit` y `regression-db` sin cambios. Comprobar que falla con la compuerta actual.
  - Documentación: `needs` de la ruta de documentación con `unit` y `regression-db` en `skipped`. Si alguno no está en `skipped`, error.
- [ ] **Step 2: ejecutar** `python3 .github/scripts/test_ci_contract.py`. Esperado: FAIL en la matriz, el equilibrio y los trabajos nuevos.
- [ ] **Step 3: implementar.**
  - **`ci-suites.json`:** grupos y contenido según la spec §3.1. Mantener el orden relativo y `complaints-returns-r4c:smoke` en `db` y en `ui` de `records-complaints`.
  - **`ci_gate.py`:** `REQUIRED_JOBS` y la evidencia `unit`.
  - **`ci.yml`:**
    - job `unit` (needs `scope`): checkout, pnpm, `pnpm db:validate && pnpm db:generate`, `pnpm test`, evidencia `unit.json`, artefacto `ci-results-unit`;
    - `quality` sin Vitest;
    - job `regression-db` (needs `scope`): como `regression`, pero sin build ni Chromium, con servicio PostgreSQL y `run_ci_group.py postgresql`;
    - matriz `regression` con los 7 grupos restantes;
    - `final-gate` con needs `[scope, unit, quality, regression-db, regression]` y `if` de documentación en los dos jobs nuevos.
- [ ] **Step 4: ejecutar** el contrato. Esperado: PASS.
- [ ] **Step 5: verificación local por grupo nuevo o cambiado,** cada uno sobre una base nueva (`covex_phase4b1_test_ci1`):
  - preparar el build: `pnpm build`, empaquetar `next-build.tar` y `build-manifest.json` como en `ci.yml`;
  - variables: las del `env` de `ci.yml` y del job de regresión; `TESTED_SHA=$(git rev-parse HEAD)`; `PHASE3B3_SYNTHETIC_DATABASE=1`;
  - comando: `python3 .github/scripts/run_ci_group.py <grupo>` para `postgresql`, `security`, `browser-qms`, `browser-access`, `records-complaints` y `records-returns`;
  - esperado: los seis terminan con `"status": "success"`.
  - Si una suite falla por datos de otra, moverla al grupo de la suite de la que depende y anotar un `Ruling`.
  - Borrar `next-build.tar`, `build-manifest.json` y `ci-evidence/` antes del commit.
- [ ] **Step 6: commit.**

### Task 2: Resumen en la página de la ejecución

**Files:**
- Modify: `.github/scripts/run_ci_group.py`, `.github/scripts/ci_gate.py`, `.github/scripts/test_ci_contract.py`

**Interfaces:**
- Produces:
  - `run_ci_group.summary_markdown(result: dict) -> str`;
  - `ci_gate.gate_summary(evidence: dict, errors: list[str]) -> str`;
  - en `gate-result.json`, el campo `seconds: {grupo: total}`.
  - Ambas funciones escriben en `GITHUB_STEP_SUMMARY` solo si la variable existe, en modo añadir.

- [ ] **Step 1: tests (fallan primero):**
  - `test_group_summary_success`:
    - entrada: `result` con 3 comandos y `status: success`;
    - el markdown contiene una fila por comando con segundos y ✅, el total de segundos del grupo y el nombre del grupo.
  - `test_group_summary_failure`:
    - entrada: el último comando con `status: 1`, `failureKind: functional` y `error: "Failed suite: x http://127.0.0.1:3000/secret DATO-REAL"`;
    - el markdown nombra la suite fallida, `functional` y el fichero `<grupo>-<n>.log` del artefacto `ci-results-<grupo>`;
    - el markdown no contiene `http`, `DATO-REAL` ni `secret`.
  - `test_group_summary_infrastructure_before_first_suite`: con `commands: []`, `status: failure` y `failureKind: infrastructure`, contiene «infraestructura» y no contiene el error.
  - `test_gate_summary`:
    - tabla con un grupo por fila (estado y segundos);
    - las 5 suites más lentas del conjunto, en orden descendente;
    - errores de la compuerta en una lista;
    - con la evidencia de `setUp`, `seconds` tiene una clave por grupo.
- [ ] **Step 2: ejecutar** el contrato. Esperado: FAIL, porque las funciones no existen.
- [ ] **Step 3: implementar** las funciones y llamarlas:
  - en `run_ci_group.main`, en `finally`, tras `persist()`;
  - en `ci_gate.main`, antes de salir, también con errores.
- [ ] **Step 4: ejecutar** el contrato. Esperado: PASS. Después, en local con `GITHUB_STEP_SUMMARY=$S/summary.md`, ejecutar `run_ci_group.py postgresql` y leer el fichero.
- [ ] **Step 5: commit.**

### Task 3: Batería nocturna y manual

**Files:**
- Modify: `.github/workflows/ci.yml`, `.github/scripts/controlled_document_scope.py`, `.github/scripts/test_ci_contract.py`

**Interfaces:**
- Produces: `controlled_document_scope.main()`. Si `GITHUB_EVENT_NAME` no es `pull_request`, escribe `docs_only=false` y `head_sha=$GITHUB_SHA` sin llamar a git.

- [ ] **Step 1: tests (fallan primero):**
  - `test_scope_outside_pull_request_runs_everything`:
    - entorno: `GITHUB_EVENT_NAME=schedule`, `GITHUB_SHA=abc`, `GITHUB_OUTPUT` temporal y sin `PR_BASE_SHA`;
    - salida: `docs_only=false` y `head_sha=abc`.
  - `test_workflow_triggers`: el texto de `ci.yml` contiene:
    - `schedule:` con `cron: "17 3 * * *"`;
    - `workflow_dispatch:`;
    - ninguna aparición de `github.event.pull_request.head.sha` que no vaya seguida de `|| github.sha`;
    - la concurrencia con `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`.
- [ ] **Step 2: ejecutar.** Esperado: FAIL.
- [ ] **Step 3: implementar.**
  - **Disparadores:** en `ci.yml`, `pull_request` (main), `schedule` y `workflow_dispatch`.
  - **SHA probado:** en `checkout`, `TESTED_SHA` y los nombres de artefacto, `${{ github.event.pull_request.head.sha || github.sha }}`.
  - **Concurrencia:** `group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}`.
  - **`scope`:** pasa `GITHUB_EVENT_NAME`. `PR_BASE_SHA` y `PR_HEAD_SHA` solo existen en PR.
- [ ] **Step 4: ejecutar** el contrato. Esperado: PASS.
- [ ] **Step 5: commit.**

### Task 4: Medición, documentación y PR

**Files:**
- Create: `docs/PHASE_CI1.md`
- Modify: `docs/DECISIONS.md` (D-115), `docs/PHASE_3B3.md` (nota en «Inventario obligatorio»), `docs/CURRENT_STATUS.md`, `docs/V1_BASELINE_AND_BACKLOG.md` (CI1 hecho), `docs/ROADMAP.md`

- [ ] **Step 1: verificación local.** Contrato, `pnpm lint`, `pnpm exec tsc --noEmit` y Vitest completo. Esperado: todo PASS.
- [ ] **Step 2: PR.**
  - Push, abrir la PR, suscribirse y programar una revisión a los 50 min.
  - La primera ejecución del flujo nuevo debe quedar en verde.
  - Comprobar en la página de la ejecución el resumen de los grupos y de la compuerta.
- [ ] **Step 3: medición.**
  - **Antes:** ejecuciones 39465639190 (9 min 30 s), 39458534998 (8 min 19 s) y 39400449433 (10 min 2 s).
  - **Después:** la ejecución de la PR y dos más.
  - Para obtener esas dos, relanzar la ejecución de la PR con `actions_run_trigger`, porque `workflow_dispatch` solo existe tras la fusión. Se acepta como forma de medir, no para obtener verde.
  - Datos: duración total (`created_at` → `updated_at`) y por trabajo.
- [ ] **Step 4: documentación.**
  - **`PHASE_CI1.md`:**
    - tabla antes/después;
    - el reparto y por qué no hay selección por impacto;
    - cómo leer el resumen;
    - cómo lanzar la batería manual (Actions → CI → Run workflow sobre `main`);
    - el límite de 60 días de los flujos programados.
  - **D-115:** sin selección por impacto (repo público, minutos gratis, cobertura íntegra), reparto, `unit`/`regression-db`, resumen y batería nocturna y manual.
  - **Estados:** CURRENT_STATUS, V1_BASELINE (fila CI1 hecha) y ROADMAP (fase 3 técnicamente completa).
  - Commit y push.
- [ ] **Step 5: fusión y comprobación.**
  - Fusión en verde.
  - Lanzar `workflow_dispatch` sobre `main` y comprobar que termina en verde con todos los grupos.
  - Comunicar el resultado al responsable.

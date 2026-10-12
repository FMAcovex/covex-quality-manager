# Fase 3B3 — CI y regresión integral final

Fecha: 2026-10-12. Base `main` tras PR #137: `09ac7ce62e29abaa7103b288f6e9a39b97106eb5`. Rama `feature/phase3b3-ci-final-regression`, única [PR #138](https://github.com/FMAcovex/covex-quality-manager/pull/138), abierta para revisión, sin merge ni squash.

**Cierre técnico de Fase 3 comprobado:** [regresión integral 38242113349](https://github.com/FMAcovex/covex-quality-manager/actions/runs/38242113349) sobre `68ad7dbb3c291fa07d34d8fa438e2a4d159ec1c7`: ocho jobs satisfactorios, incluidos los cinco grupos de regresión y `QMS final gate`; 536 pruebas Vitest / 91 archivos. La publicación final añade documentación y conservación de capturas existentes; su nueva revisión se verifica nuevamente mediante la CI completa. El SHA y la ejecución definitivos se identifican en la PR, en Checks y en `gate-result.json`, evitando una referencia circular al commit que contiene este informe.

Esto acredita regresión técnica con datos sintéticos. No acredita validación GMP, aceptación formal de documentos en Word ni autorización productiva. No inicia IT, seguridad ni implantación. La integración en `main` sigue pendiente de revisión.

## Arquitectura y aislamiento

1. `scope` obtiene el HEAD exacto de la PR, ejecuta los contratos Python y clasifica los archivos entre documentación exclusiva y cambio que exige regresión integral.
2. `quality` instala con lockfile congelado, valida/genera Prisma, ejecuta Vitest completo y construye Next 15.5.26. El build ejecuta obligatoriamente ESLint y comprobación TypeScript; no hay flags para omitirlos. Se eliminan el lint/TypeScript previo redundante y la generación Prisma repetida dentro del mismo job.
3. Cinco jobs de matriz ejecutan suites secuenciales dentro de cada grupo, pero los grupos corren en paralelo. Cada runner tiene PostgreSQL 16 recién creado, migraciones completas y seed sintético propios, filesystem y procesos independientes. No comparten base mutable, sesiones ni fixtures. Cada navegador usa su propio proceso Next, readiness HTTP 200 y puerto local 3000. El runner espera al proceso que lanzó al detener/reiniciar PNT.
4. Los cuatro grupos Chromium reutilizan el mismo build, generado para el SHA de la PR en Ubuntu 22 / Node 22. Un manifiesto identifica SHA y SHA-256 del tar; se verifica antes de extraer y antes de iniciar el servidor. PostgreSQL puro no necesita el build ni Chromium.
5. `QMS final gate`, con `if: always()`, comprueba los estados y evidencias individuales del mismo run y SHA. El resultado es un check estable y un artefacto JSON.

La caché pnpm está asociada al lockfile; la de Chromium también, conservando `playwright install --with-deps chromium` para instalar dependencias de sistema y verificar el navegador correspondiente. `.next/cache` usa lockfile y fuentes/configuración con fallback incremental; se construye siempre y nunca se reutiliza un build final de otro SHA. Los clientes Prisma se generan en cada runner independiente porque sus dependencias son locales.

`APP_ENV=test` y las guardas de los smokes delimitan escritura sintética. El runner admite el servicio desechable de Actions o una base local con prefijo `covex_phase3b2_ci3b3_` y marcador explícito; no usa la base development del checkout. Las variables documentales demo/ciclo/origen solo se aplican a los jobs de regresión. La clave del reinicio trusted-proxy es un literal sintético de pruebas, sin credenciales corporativas.

## Inventario obligatorio

El contrato ejecutable es [`.github/ci-suites.json`](../.github/ci-suites.json). Los contratos exigen que **todos** los scripts actuales `*:smoke` de `package.json` estén inventariados. Añadir una suite sin asignarla provoca fallo del job `scope`. Todos los grupos comienzan con `db:deploy` y `db:seed`; además se ejecutan estos comandos, en el orden del inventario:

### `regression (postgresql)`

```text
dashboard-d1b:smoke phase3b1:smoke phase3b2:smoke
db:smoke import:smoke indicators:smoke capa:import:smoke capa:smoke
versions:smoke changes:smoke hito8:smoke hito9:smoke demo:seed
create-save:smoke relations:smoke b2-3:smoke b3-3:smoke b4-3:smoke
c3:smoke d3:smoke d6:smoke d5-3:smoke d5-6:smoke
r1-capa:smoke r2b-documents:smoke r3-capa:smoke
r3-complaints:smoke complaints-r4a:smoke r2-returns-documents:smoke
r3-returns:smoke returns-r4b:smoke
review-r1:smoke review-r2a:smoke review-r2b1:smoke review-r2b2:smoke
review-r2b3:smoke audits-r3a:smoke audits-r3b:smoke audits-r3c:smoke
audits-r4b:smoke audits-annual:smoke review-r2c:smoke hito10:smoke
```

### `regression (browser-qms)`

```text
dashboard-d1b:ui:smoke dashboard-d1c:ui:smoke
phase3b1:ui:smoke phase3b2:ui:smoke ux-c3:ui:smoke review-r2c:ui:smoke
```

### `regression (browser-audits)`

```text
audits-r3a:ui:smoke audits-r3b:ui:smoke audits-r3c:ui:smoke
audits-r4b:ui:smoke audits-annual:ui:smoke
```

### `regression (records-r4c)`

```text
DB: complaints-r4a:smoke returns-r4b:smoke hito8:smoke
    complaints-returns-r4c:smoke
UI: complaints-r4a:ui:smoke returns-r4b:ui:smoke
    complaints-returns-r4c:smoke
```

R4C combina DB y navegador cuando recibe `R4C_UI_BASE_URL`; esa variable se aplica únicamente en la etapa UI. Su cobertura ya no depende del nombre histórico de una rama. R4A/R4B/hito8 se mantienen en el grupo general y en la preparación conjunta R4C porque esta última requiere su contexto aislado.

### `regression (pnt)`

```text
DB: pnt-p1a:smoke pnt-p1b1:smoke pnt-p1b2:smoke pnt-p2a:smoke
    pnt-p2b:smoke pnt-p2c:smoke pnt-p3c2:smoke pnt-final:smoke
UI: pnt-p1a:ui:smoke pnt-p1b1:ui:smoke pnt-p1b2:ui:smoke
    pnt-p2a:ui:smoke pnt-p2b:ui:smoke pnt-p2c:ui:smoke
    pnt-p3c1:ui:smoke pnt-final:ui:smoke
Reinicio trusted-proxy:
    pnt-p2a:ui:smoke / P2A_VERIFY_RESTART=true
    pnt-p2b:ui:smoke / P2B_VERIFY_ACCESS=true
    pnt-p2c:ui:smoke / P2C_VERIFY_RESTART=true
```

Se conservan pruebas negativas, persistencia documental, identidad simulada, permisos, versiones, snapshots y hashes. No se cambian sus aserciones ni scripts funcionales. Cada suite vigente se ejecuta íntegramente en su runner aislado.

## Matriz de cobertura

| Módulo / contrato | PostgreSQL | Chromium | Evidencia principal |
| --- | --- | --- | --- |
| Desviaciones | import/db/versions, relaciones, documentos y 3B1/3B2 | QMS: C3, Review, 3B1/3B2 | páginas SQL, filtros, guardado, navegación, borradores, históricos |
| CAPA | import/capa/R1/R2/R3, Review, relaciones y 3B1/3B2 | QMS: Review, C3, 3B1/3B2 | eficacia, filtros antes de paginar, recuentos/transacción |
| Controles de Cambios | changes, hito9, versiones y 3B1/3B2 | QMS: Review, C3, 3B1/3B2 | estados, documentos, paginación SQL y retorno |
| Reclamaciones | R3/R4A/documentos, R4C conjunto | R4A, R4C y QMS 3B2 | cierre, revisiones, descargas byte por byte y metadatos sin binarios |
| Devoluciones | R2/R3/R4B/documentos, R4C conjunto | R4B, R4C y QMS 3B2 | productos/relaciones, cierre e históricos inmutables |
| Auditorías | R3A/R3B/R3C/R4B/anuales, 3B1 | cinco suites Auditorías y QMS | documentos/versiones, CAPA Plan, cierre, programas anuales |
| PNT | P1A/P1B/P2A/P2B/P2C/P3C2/final y 3B2 | ocho suites PNT + tres tras reinicio y QMS 3B2 | importación/conciliación sintética, selección/revisión, permisos, persistencia/hashes |
| Dashboard D1B/D1C | D1B, 3B1/3B2 | D1B/D1C/3B1/3B2 | cálculos equivalentes, filtros, navegación y 1440/768/390 |
| Transversales | versiones, relaciones, Review R1→R2C, C3/D3/D5/D6 | Review R2C/C3 y suites por módulo | integridad, pruebas negativas, cierres e históricos |

Vitest completo cubre además los contratos de servicios/rutas y casos negativos. Las suites Chromium mantienen sus comprobaciones de hidratación/errores de navegador; las ejecuciones satisfactorias no detectaron errores. Las plantillas de CI son fixtures compatibles sintéticos: no sustituyen aceptación manual de plantillas oficiales.

## Gate final y clasificación documental

Para un cambio de código deben ser satisfactorios `scope`, `quality` y la matriz completa. El gate exige exactamente las evidencias `quality`, `postgresql`, `browser-qms`, `browser-audits`, `records-r4c` y `pnt`, todas con SHA actual, estado success y lista completa y ordenada de comandos con retorno 0. Un artefacto ausente, una suite omitida, SHA anterior, cancelación, timeout o fallo impide el verde. La concurrencia por PR cancela revisiones antiguas; cada commit nuevo dispara la verificación de su HEAD.

La ruta documental solo admite `README.md` y Markdown bajo `docs/`, archivos normales no ejecutables o eliminaciones. Rechaza symlinks, traversal, cambios de código, tests, esquema, migraciones, dependencias, build, workflows, scripts y `AGENTS.md`. El diff desactiva detección de renombres para que renombrar código a documentación siga incluyendo la eliminación del código. `scope` siempre prueba los contratos. Solo en esta ruta se exige que `quality` y `regression` estén explícitamente skipped; cualquier otro resultado falla.

Seis pruebas Python con múltiples casos verifican cada job y grupo fallido/omitido/cancelado/ausente, pruebas no ejecutadas, SHA obsoleto, ruta documental positiva y clasificación negativa. Además se invoca el proceso real del gate con fixtures temporales: éxito retorna 0 y fracaso/skip/cancelación/artefacto ausente retornan 1.

**Demostración real roja:** [run 38241845824](https://github.com/FMAcovex/covex-quality-manager/actions/runs/38241845824), `a7b5fe7`: quality falló, la regresión dependiente quedó omitida y el gate falló. La causa fue aplicar el origen documental de navegador a Vitest, alterando sus fixtures (tres respuestas 403 inesperadas). Se corrigió el alcance del entorno, manteniendo pruebas y permisos intactos. **Demostración verde:** run 38242113349 con todos los grupos, `documentationOnly=false`, SHA `68ad7db…`, `errors=[]`. No se usaron reintentos indiscriminados.

El runner marca fallos de bootstrap, verificación del build, inicio/readiness y reinicio como `infrastructure`; fallos de comandos de regresión como `functional`. Es clasificación por etapa: el log conserva la causa para distinguir un defecto de aplicación de una infraestructura que fallase durante una suite. Fallos de instalación, servicio o acciones previas quedan visibles en el job y mantienen el gate rojo.

## Mediciones CI

Tiempos reales de GitHub, no estimaciones. Total = `created_at` → `updated_at` del run, incluida planificación; duración del job = `started_at` → `completed_at`. Un solo run por referencia: no son medianas ni una garantía de duración futura.

| Referencia | Run | SHA | Total |
| --- | --- | --- | --- |
| D1B | [38171276026](https://github.com/FMAcovex/covex-quality-manager/actions/runs/38171276026) | `17ad0fe` | 11:02 |
| D1C | [38175474670](https://github.com/FMAcovex/covex-quality-manager/actions/runs/38175474670) | `c9f5d4c` | 11:39 |
| 3B1 | [38181910503](https://github.com/FMAcovex/covex-quality-manager/actions/runs/38181910503) | `3b3f13e` | 12:33 |
| 3B2 | [38238506636](https://github.com/FMAcovex/covex-quality-manager/actions/runs/38238506636) | `cccd512` | 14:04 |
| 3B3 integral medida | [38242113349](https://github.com/FMAcovex/covex-quality-manager/actions/runs/38242113349) | `68ad7db` | **7:31** |

En las cuatro referencias, PNT especial y R4C final estaban skipped. La nueva CI tiene mayor cobertura efectiva y un gate adicional. Su total medido baja 393 s / 46,6% frente a 3B2.

Duraciones anteriores por job: D1B scope 5 s / quality 653 s; D1C scope 7 s / quality 688 s; 3B1 scope 6 s / quality 742 s; 3B2 scope 9 s / quality 831 s. En cada run los otros dos jobs quedaron omitidos sin ejecutar pasos; sus timestamps no constituyen tiempo de pruebas.

| Job 3B3 | Duración | Instalación pnpm | Prisma | Suites | Publicación resultados |
| --- | --- | --- | --- | --- | --- |
| scope | 7 s | — | — | contratos 1 s | — |
| quality | 143 s | 23 s | validate/generate 4 s | Vitest 24 s; lint/types/build 73 s | build 3 s; resultado 1 s |
| browser-qms | 241 s | 16 s | 2 s | 145 s | 1 s |
| browser-audits | 209 s | 18 s | 3 s | 113 s | 1 s |
| records-r4c | 281 s | 20 s | 3 s | 192 s | 1 s |
| pnt | 255 s | 16 s | 3 s | 168 s | 1 s |
| postgresql | 159 s | 17 s | 4 s | 98 s | 1 s |
| QMS final gate | 10 s | — | — | validación <1 s | 1 s |

Los grupos incluyen migraciones/seed: 2,4–4,2 s por grupo, medidos por comando. Inicializar cada servicio PostgreSQL lleva 12–20 s. Descargar el build lleva 2–12 s, verificar/extraer ≤1 s. Restaurar pnpm (setup-node) lleva 4–16 s en grupos; Chromium sin caché inicial + dependencias 29–34 s; `.next/cache` fue miss en esta medición. Publicar la caché al terminar lleva 2–6 s. Arranque/readiness/reinicio añaden aproximadamente 1–3 s al bloque de suites según el grupo; el runner espera condiciones, sin sleeps largos fijos.

**Comparación de suites equivalentes:**

| Bloque equivalente | 3B2 | 3B3 | Interpretación |
| --- | --- | --- | --- |
| Comprobaciones fuente/calidad | gate previo 50 s + quality 164 s | Prisma 4 s + Vitest completo 24 s + lint/types/build 73 s = 101 s | Misma cobertura completa; se eliminan validaciones previas repetidas. El build pasa por lint/types; no se miden por separado porque Next los integra. |
| DB general, mismas suites | 96 s | 98 s | Sin reducción significativa; conservadas. |
| Chromium general existente | 457 s, instalación/arranque incluidos | subtareas equivalentes: QMS 140,7 s, Auditorías 107,2 s, R4A/R4B 164,1 s; en runners paralelos | Suma de comandos comunes 412 s; recorrido lento común 164,1 s, más infraestructura de su runner. El run nuevo añade R4C y PNT; estas duraciones no son una comparación de hardware controlado. |
| Build compilación informada por Next | 24,6 s | 16,2 s | Total build anterior aproximadamente 106 s; nuevo 73 s. Cache inicial nueva vacía; no atribuir toda diferencia a caché. |
| Workflow | 844 s | 451 s | Regresión nueva completa frente a cobertura antigua parcial. |

El quality antiguo duró 831 s; ahora el trabajo se distribuye. La suma de duraciones de jobs nuevos es 1.305 s (21:45 de runners) frente a 840 s antiguos, aunque el tiempo de espera del usuario baja. El mayor consumo agregado se explica por cinco instalaciones/servicios aislados y PNT/R4C adicionales: no se afirma ahorro de minutos facturados. Las dependencias compartidas se transportan como build/cachés, nunca como base de datos mutable.

## Integración y rendimiento 3B1/3B2

Se reutilizan los estudios reproducibles de [PHASE_3B1.md](PHASE_3B1.md) y [PHASE_3B2.md](PHASE_3B2.md), con cohortes sintéticas 1.000/5.000/20.000 y 2.000 maestros PNT. El árbol `src` de main integrado `09ac7ce` y 3B2 final `cccd512` tiene el mismo hash Git `aa9b975a6d1c89b4653167eb48ea66ba8af324f3`; 3B3 no modifica código funcional, schema/migraciones, seed, dependencias/config de aplicación ni plantillas. Esa identidad permite reutilizar mediciones sin repetir cargas costosas.

| Mediana sintética 20.000 | Antes | Después |
| --- | --- | --- |
| HTTP listado Desviaciones (3B1) | 765 ms | 250 ms |
| HTTP listado CAPA (3B1) | 599 ms | 292 ms |
| HTTP listado Cambios (3B1) | 487 ms | 310 ms |
| Backend Dashboard (3B2) | 1.341 ms | 345 ms |
| Dashboard HTTP general (3B2) | 1.577 ms | 654 ms |
| Dashboard HTTP filtro (3B2) | 1.247 ms | 699 ms |
| PNT backend primera/última página (3B2) | 602 / 518 ms | 59 / 58 ms |
| PNT HTTP primera/última página (3B2) | 730 / 622 ms | 185 / 212 ms |
| Metadatos Reclamación / Devolución | 5 / 7 MiB de binarios leídos | 0 / 0 |

Payloads de listados 3B1: Desviaciones 3.058.746→288.018 bytes, CAPA 1.897.990→193.049, Cambios 2.765.110→263.849. SQL Dashboard 50→25 consultas y filtrado 50–52→19; PNT 3–4→8, ahora acotadas y transaccionales: más consultas no implica más volumen. Metadatos backend Reclamaciones 47→10 ms / Devoluciones 65→8 ms.

Los benchmarks 3B2 usan PostgreSQL 16 limitado a 1 CPU/1 GiB, pool 4, Node 24, un calentamiento y tres ejecuciones secuenciales; no son carga concurrente productiva ni mediciones nuevas de servidor 3B3. Dashboard compara resultados completos con fecha fija; PNT contempla UTC de la ejecución y los dos lectores usan el mismo instante. Detalles y límites de orden/paginación siguen vigentes en 3B2.

La regresión 3B3 vuelve a ejecutar `phase3b1:smoke`, `phase3b2:smoke` y ambos Chromium sobre main integrado: filtros previos a paginación, recuentos, eficacia/borradores/cierres, resultados Dashboard, selección PNT, hashes y bytes históricos. El estudio 3B2 conserva 39 comparaciones completas Dashboard, 276 PNT, 14 descargas de rutas y 45 descargas en navegador con hashes; se reutiliza esa evidencia junto a la regresión nueva, sin atribuir los 20.000 registros al seed de cada job CI.

## Evidencias y revisión en GitHub

En la PR #138 abrir **Checks**, seleccionar el run CI correspondiente al **último commit** y verificar `scope`, `quality`, los cinco jobs `regression (…)` y **`QMS final gate`** con success. En esta PR la clasificación debe ser `docs_only=false`, aunque el último commit sea documental, porque se compara el diff completo contra main. No hace falta lanzar suites ni reintentar jobs manualmente.

En ese run, **Artifacts** contiene `ci-results-quality`, los cinco `ci-results-<grupo>` con JSON de SHA/comandos/duración y logs, y `qms-final-gate` con `gate-result.json`. Comprobar SHA igual al HEAD, `documentationOnly=false`, seis grupos y `errors=[]`. Las capturas existentes se conservan para D1B/D1C, 3B1/3B2, PNT final/P3C1 y programas anuales a 1440/768/390, según cada suite. Retención de resultados según GitHub (90 días por defecto); build transportado durante 7 días. Exportar evidencias antes de expirar si se necesitan para archivo prolongado.

**Check que debe exigirse en protección de main:** `QMS final gate`, fuente **GitHub Actions**, workflow `CI`. En Settings → Branches → Branch protection rule de `main` → Require status checks to pass before merging, seleccionar exactamente ese check tras su primera ejecución. Si se usa Rulesets: Settings → Rules → Rulesets → regla para main → Require status checks → Add checks → `QMS final gate` / GitHub Actions. Mantener también checks ya exigidos si existen; los nombres antiguos de jobs especiales han cambiado y deben revisarse por un administrador. No se han cambiado rulesets, protecciones ni permisos del repositorio. Sin ese requisito configurado, el gate rojo señala fallo técnico pero no se afirma que GitHub impida por sí solo toda fusión.

La PR permanece abierta y no activa auto-merge. Ninguna URL pública, despliegue, dato real, modelo/migración, regla GMP, formulario/estado, codificación, motor documental, permiso productivo, plantilla oficial ni diseño D1C se modifica. Fase 3 cerrada técnicamente en el alcance autorizado; revisión/integración y futuras fases quedan pendientes.

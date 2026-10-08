# R4C — Reclamaciones y Devoluciones: regresión final

Baseline: main `d2ee3266386a5e4e699a0f7a67da95e9458e17a1`. Rama: `feature/complaints-returns-final-regression`.

Alcance exclusivo: regresión conjunta R4A/R4B. Sin nuevas funcionalidades, rediseño, cambios Prisma, migraciones ni modificación de documentos controlados. Fuentes y decisiones funcionales siguen siendo COMPLAINTS_R4A.md, RETURNS_R4B.md, D-067 y D-068.

## Defecto encontrado y corrección

El selector compartido de relaciones programaba ocultar las sugerencias 120 ms después de perder el foco. Si el campo recuperaba el foco antes, el temporizador anterior cerraba el menú mientras el usuario buscaba el expediente para revincular. Reproducido en servidor de producción, con la API devolviendo el UUID correcto y la relación realmente desactivada.

La corrección comprueba que el foco siga fuera del campo antes de ocultar las sugerencias. No cambia búsquedas, matriz QMS, escrituras, diseño ni persistencia. El nuevo smoke ejerce blur/focus rápido y revinculación desde los dos módulos; el smoke R4A también cubre el mismo control al vincular CAPA y Devoluciones. No se requiere una batería de navegador de otros módulos para este cambio del control de foco.

## Cobertura

| Comprobación | Evidencia |
|---|---|
| Cliente/proveedor operativos | R4A PG/UI y R4C, ambos tipos |
| Crear/vincular desde Reclamación | R4B UI con alta real Draft→OPEN; R4C con origen transaccional |
| COMPLAINT → RETURN | R4C, dos vínculos y cero filas inversas |
| Navegación ida/vuelta | R4C UI, clic real mediante resolver QMS |
| Varias Devoluciones | R4C, dos por cada cliente/proveedor |
| Desvincular/revincular | R4C PG/UI desde ambos extremos; mismo UUID de relación |
| Snapshots históricos de Reclamación | R4A y R4C, V00 congelado idéntico tras relaciones/cierre |
| Snapshot técnico único de Devolución | R4B/R4C, secuencia 0 y autor original |
| UUID producto/ReturnFollowup | R4B y R4C, edición y cierre sin recreación |
| Cierre Reclamación con Devolución abierta | R4A UI con cierre real; R4C comprueba dos seguimientos independientes |
| Cierre Devolución | R4B UI con acción real, decisión y trazabilidad; R4C integridad posterior |
| Documentos históricos/PDF | R4A III/IV V00/V01 y PDF por versión; R4B III/IV por producto/V/VI, archivos inmutables y PDF III/V sustituidos |
| Review | R4A versión exacta preservada; R4B producto/seguimiento UUID y recordVersionId null |
| Listados/filtros | R4A/R4B PG, paginación 305; R4C relaciones y planificación antes/después de cierre |

## Ejecución y CI

Smokes mínimos: complaints-r4a:smoke, returns-r4b:smoke, hito8:smoke y complaints-returns-r4c:smoke. Navegador: R4C conjunto, R4A y R4B. Los smokes existentes no se modifican ni se debilitan. Las pruebas locales de documentos utilizan las fuentes oficiales previamente contrastadas, copiadas al worktree fuera de Git; la CI utiliza los fixtures TEST existentes.

La CI de esta rama ejecuta un job acotado con PostgreSQL, los cuatro smokes, los tres recorridos de navegador y pnpm quality al final. El job acumulado existente se conserva íntegro para las demás ramas; no se ejecuta la batería de Auditorías/CAPA/CC en R4C. La compilación previa al navegador permite verificar el comportamiento en producción; quality al final vuelve a incluir Prisma validate/generate, lint, todos los unitarios y build.

El resultado definitivo de quality, CI y head se registra en la PR. El cierre funcional de Reclamaciones y Devoluciones puede marcarse COMPLETADO cuando esta regresión y la CI estén verdes. Permanece fuera del alcance: **Revisión UX/UI transversal final**.

Validación local final: 90 tests afectados en 12 archivos; los cuatro smokes PostgreSQL verdes; R4C UI conjunto y R4A/R4B UI con fuentes oficiales verdes, incluidos documentos históricos/PDF, Review y 1440/768/390 Madrid. pnpm quality final verde: 346 tests en 67 archivos, Prisma validate/generate, lint y build. Solo permanecen los dos avisos de lint preexistentes en CAPA/CC; cero errores. No se ejecutó la batería de navegador de Auditorías.

El build previo a navegador regenera next-env.d.ts con una referencia triple-slash que la regla existente de lint rechaza. Antes de quality, CI restaura exclusivamente ese archivo autogenerado al contenido versionado; mantiene todas las reglas y pruebas. No se excluyen archivos de lint ni se desactivan checks.

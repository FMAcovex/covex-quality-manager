# BE1-C — Consultas lentas medidas: JIT y dos reescrituras (sin índices nuevos)

**Fecha:** 2026-10-20. **Backlog:** BE1, tercera y última entrega (A → B → C). **Estado:** planteamiento aprobado en conversación; pendiente de revisión de esta especificación.

## 1. Propósito y resultado de la medición previa

BE1 pedía «índices motivados»: añadir índices solo donde una medición los justifique. Antes de diseñar se midió con la cohorte de 20.000 expedientes de BE1-A (base aislada, PostgreSQL 16.15), registrando cada SQL con su duración y analizando las lentas con `EXPLAIN ANALYZE`:

| Caso | Tiempo | Causa | Arreglo propuesto |
| --- | --- | --- | --- |
| Panel de inicio | ~470 ms | Compilación **JIT** de PostgreSQL (activa por defecto): ~420 ms de una sola consulta de seguimientos de Auditorías, que sin JIT tarda 28 ms | Desactivar JIT en las conexiones de la aplicación |
| Panel de inicio, resto | 2 × ~70 ms | Al cargar la relación `lifecycle` de las revisiones PNT, Prisma envía `WHERE (documentId, revisionId) IN ((…),(…), …)` con miles de parámetros | Reescribir la carga de esa relación |
| Auditorías «con PDF firmado» | 80–90 ms | `DISTINCT ON` sobre todas las versiones de todos los expedientes (60.000 filas, recorrido completo y ordenación) para quedarse con 7 | Reescribir: partir de los PDF firmados y comprobar que su versión es la última con el índice único existente (0,5 ms, mismo resultado) |
| Búsqueda por lote (Reclamaciones, OOS) | 60–120 ms | `ILIKE` sobre 10–12 campos y tablas relacionadas | **Sin cambios** (ver §4) |
| Listados normales | ~50 ms | — | Sin cambios |

Conclusión: **no hace falta ningún índice nuevo**; las mejoras vienen de una opción de conexión y de dos consultas mal planteadas.

Éxito:

- el panel de inicio y el filtro «con PDF firmado» de Auditorías bajan de forma medible con la cohorte de 20.000, con los mismos resultados;
- ninguna migración, ningún cambio de esquema ni de pantallas;
- medición antes/después publicada.

## 2. Diseño

### 2.1 JIT desactivado en la aplicación

- `createAppPrismaClient` (`src/lib/db-client.ts`) construye el cliente con la URL de `DATABASE_URL` añadiendo el parámetro `options=-c jit=off`.
- Si la URL ya trae un parámetro `options`, no se toca: IT puede decidir otra configuración.
- Se ha comprobado que Prisma 6.19 respeta el parámetro: `SHOW jit` devuelve `off`.
- La función que añade el parámetro es pura y se prueba sola: `withJitDisabled(url: string): string`.
- No afecta a los scripts con su propio `PrismaClient` (copias de seguridad, recuperación, mediciones) ni a la configuración del servidor PostgreSQL de IT.
- Motivo: la aplicación hace consultas cortas de tipo transaccional, donde JIT no aporta y su compilación cuesta más que la propia consulta. Es una recomendación habitual para este tipo de carga.

### 2.2 Filtro «con PDF firmado» de Auditorías

- En `src/modules/audits/queries.ts`, la consulta en SQL directo que obtiene los expedientes cuya última versión tiene PDF firmado pasa a:

  ```sql
  SELECT v."qmsRecordId" FROM "RecordVersionDocument" d
  JOIN "QmsRecordVersion" v ON v.id = d."recordVersionId"
  WHERE d.kind = 'SIGNED_PDF'
    AND NOT EXISTS (SELECT 1 FROM "QmsRecordVersion" w WHERE w."qmsRecordId" = v."qmsRecordId" AND w."sequenceNumber" > v."sequenceNumber")
  ```

- Se conservan las demás condiciones que tenga la consulta actual (tipo de documento, ámbito), reproducidas tal cual.

### 2.3 Revisiones PNT del panel de inicio

- En `src/modules/dashboard/queries.ts`, las dos lecturas de revisiones con `lifecycle` dejan de pedir la relación anidada.
- Se lee `ControlledRevisionLifecycle` en una sola consulta por `documentId` (`IN` de identificadores simples, uno por documento, no pares) o con un `LEFT JOIN` en SQL directo. Se elige el que mida mejor y se anota.
- Se combina en memoria para devolver exactamente la misma forma.

## 3. Pruebas

- **Unitaria de `withJitDisabled`:**
  - URL sin parámetros;
  - URL con otros parámetros (`sslmode`, `connection_limit`), que se conservan;
  - URL que ya tiene `options`, que no se cambia.
- **Equivalencia con PostgreSQL** (smoke `be1c:smoke`, grupo `postgresql`):
  - sobre una cohorte ficticia, el resultado de las dos consultas reescritas coincide con el de las consultas antiguas, copiadas en el propio smoke como referencia;
  - casos con varias versiones y PDF solo en una versión antigua, y revisiones sin `lifecycle`;
  - además, `SHOW jit` con el cliente de la aplicación devuelve `off`.
- **Regresión:** las pruebas del panel (`dashboard-d1b`, `phase3b2`), Auditorías y la CI completa.

## 4. Fuera de alcance, con motivo

- **Índices de texto (trigramas) para las búsquedas:** solo ayudarían campo a campo, mientras el buscador combina 10–12 campos y tablas relacionadas. Además exigen la extensión `pg_trgm` en el servidor de IT. Con unos 3.300 expedientes por módulo tardan menos de 0,13 s. Se reevaluará con datos reales.
- **Índices para el orden de los listados:** ~50 ms con 20.000; no compensan su coste en cada guardado.
- **Volver a medir con datos reales** tras la carga del histórico (fase 5, DATA1) queda anotado en el roadmap.

## 5. Medición y documentación

- `scripts/benchmark-be1.ts` se reutiliza para medir antes/después los casos del panel, Auditorías con PDF firmado y la búsqueda por lote (control), con las mismas cohortes. Si hace falta, se añade un modo que compare con JIT activado.
- **Documentación:**
  - `docs/PHASE_BE1C.md`: medición y conclusiones;
  - `docs/DECISIONS.md`, D-114: JIT desactivado en la aplicación, sin índices nuevos y por qué;
  - `docs/CURRENT_STATUS.md`, `docs/V1_BASELINE_AND_BACKLOG.md` y `docs/ROADMAP.md`: BE1 completa.

## 6. Entrega

- Una PR con CI verde. La fusión según la pauta que fije el responsable.
- Rollback: revertir la PR. No hay migraciones.

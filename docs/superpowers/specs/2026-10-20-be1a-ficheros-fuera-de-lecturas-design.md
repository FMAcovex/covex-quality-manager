# BE1-A — Ficheros fuera de las lecturas por defecto y medición de los ocho módulos

**Fecha:** 2026-10-20. **Backlog:** BE1 (`docs/V1_BASELINE_AND_BACKLOG.md`), primera de tres entregas (A → B → C) aprobadas por el responsable del proyecto. **Estado:** diseño aprobado en conversación; pendiente de revisión de esta especificación.

## 1. Propósito y criterios de éxito

Que la aplicación no lea de PostgreSQL los bytes de los ficheros (plantillas, Word generados, PDF firmados, originales, documentos PNT, programas anuales, planes CAPA de auditorías, exportaciones del historial) salvo en las operaciones que los usan, y dejar medido el efecto en los ocho módulos.

Éxito:

- Listados, fichas y formularios cargan **0 bytes de fichero**; una prueba con PostgreSQL lo exige.
- Las descargas, la generación de Word, las copias de documentos a versiones nuevas, la instalación de plantillas y las exportaciones funcionan igual, con los mismos bytes y checksums.
- Tabla antes/después publicada con tiempo, consultas SQL, bytes de fichero materializados y memoria, con las cohortes de 3B1/3B2.
- Sin cambios de pantallas, permisos, checksums, custodia inmutable, esquema ni migraciones.

Fuera de alcance: registro de errores (BE1-B), índices (BE1-C), cambio de almacenamiento o subida/descarga por trozos (custodia: solo se miden volúmenes y se documentan opciones para IT), paginación del panel y del índice PNT en memoria (diferidas en 3B2).

## 2. Situación de partida

- Siete modelos guardan bytes en columnas `Bytes`: `TemplateVersion.fileData?`, `RecordVersionDocument.fileData`, `GeneratedDocument.fileData?`, `ControlledRevisionDocument.fileData?`, `AuditAnnualProgrammeVersion.fileData`, `AuditCapaPlanVersion.fileData`, `AuditTrailExport.fileData`.
- 3B2 dejó sin binarios las fichas de Reclamaciones y Devoluciones con `select` explícitos. Siguen leyendo bytes sin necesidad, entre otras:
  - las fichas de Desviaciones, CAPA y Cambios (`generatedDocuments`, documentos de versión y relaciones de plantilla con `: true`);
  - las búsquedas de plantillas de los formularios (`templateVersion.findMany` sin `select`);
  - unas 40 inclusiones de `TemplateVersion` en acciones y versionado.
- Solo 3B1/3B2 tienen medición. Reclamaciones, Devoluciones, Auditorías y OOS no tienen línea base.

## 3. Diseño

### 3.1 Exclusión global

`src/lib/db.ts` crea el cliente con la opción `omit` de Prisma 6, que excluye `fileData` de los siete modelos. La exclusión se aplica en ejecución a todas las operaciones del cliente de la aplicación, incluidas las transacciones interactivas y las relaciones anidadas (`include`). No afecta al SQL directo ni a los scripts que crean su propio `PrismaClient`.

### 3.2 Consumidores de bytes

Cada operación que necesita los bytes los pide expresamente con `omit: { fileData: false }` en la consulta, o con `fileData: true` en un `select` explícito, sin cambiar su lógica. Consumidores conocidos (archivos de `src` que hoy leen `fileData`):

- **Rutas de descarga:**
  - historial: `audit-trail/exports`;
  - Auditorías: `audits/[id]/documents` y programas anuales;
  - PDF firmados por versión: Desviaciones, CAPA, Cambios y Reclamaciones;
  - PDF firmados de OOS y de Devoluciones;
  - documentos PNT;
  - originales custodiados (`document-originals`);
  - evidencias;
  - documentos de Devoluciones.
- **Servicios:**
  - `lib/qms/record-evidence.ts`;
  - `lib/qms/signed-version-document.ts`;
  - `lib/audit/trail-actions.ts` y `action-result.ts`;
  - Auditorías: documentos, informe, programa anual y plan CAPA;
  - configuración: instalación y recursos de plantillas, acciones de administración;
  - documentos y ciclo de vida de PNT;
  - archivo de Devoluciones.
- **Generación de Word desde plantilla y copias de documentos a versiones nuevas:** se localizan durante la implementación siguiendo los usos de los modelos anteriores, no solo la palabra `fileData`.

### 3.3 Riesgo de copia silenciosa y su control

En `TemplateVersion` y `GeneratedDocument` el fichero es opcional. Un código que copie una fila completa (`{ ...fila }`) a un `create` guardaría la copia **sin fichero** sin error de compilación. Controles:

1. Antes del cambio se revisan todas las escrituras de esos dos modelos que parten de una fila leída. Cada caso queda anotado en el registro del plan.
2. Pruebas con PostgreSQL de versión nueva, regeneración y sustitución de plantilla: los bytes y el SHA-256 de la copia coinciden con los del origen.
3. En el resto de casos el fallo es ruidoso. Los modelos con fichero obligatorio fallan en el `create`. Las descargas verifican el checksum antes de entregar y fallan sin entregar nada incorrecto.

### 3.4 Límite del compilador e inventario

El tipo de `omit` llega al compilador en las consultas directas y anidadas, pero **no** dentro de `$transaction(async tx => …)`. Además, el cliente se exporta como `PrismaClient` y las funciones reciben `Prisma.TransactionClient`, tipos que no conocen la exclusión. No se promete detección completa en compilación. Se añade en su lugar un **inventario de consumidores de bytes**, en la línea de los inventarios del historial:

- una prueba unitaria recorre `src` (sin `*.test.*`), lista los archivos que mencionan `fileData` y compara con una lista revisada en el propio test;
- un archivo nuevo que lea bytes hace fallar la prueba hasta que alguien lo revise y lo añada.

No se cambian las 89 anotaciones de tipo existentes.

## 4. Medición

- **Script:** `scripts/benchmark-be1.ts`, con la misma forma que `scripts/benchmark-phase3b2.ts`, protegido por `BE1_BENCHMARK=1` y base aislada.
- **Casos:**
  - los 8 listados (Desviaciones, CAPA, Cambios, Reclamaciones, Devoluciones, Auditorías, OOS, PNT) en su primera página, más un filtro representativo en cada uno de los que filtran por lista de ids (lote en Reclamaciones y OOS, seguimiento en Devoluciones, PDF firmado en Auditorías);
  - las fichas de Desviaciones, CAPA, Cambios, Reclamaciones, Devoluciones, Auditorías y OOS, con documentos generados y adjuntos de tamaño realista;
  - los formularios de alta y edición que cargan plantillas;
  - el panel de inicio, como control.
- **Cohortes y entorno:** 1.000, 5.000 y 20.000 expedientes ficticios por módulo, en PostgreSQL 16 con 1 CPU y 1 GiB cuando el entorno lo permita (si no, se declara el entorno real), con la mediana de 3 ejecuciones tras un calentamiento.
- **Métricas:** ms, número de SQL, bytes de metadatos y de fichero materializados, y variación de RSS.
- **Antes/después:** misma base y misma build salvo el cambio. Las cifras «antes» se toman sobre `main` previo al cambio.
- **Custodia:** el script informa además del tamaño total y del percentil 95 de bytes por modelo en la cohorte, como dato de partida para las opciones de IT. No se cambia el almacenamiento.
- **Publicación:** `docs/PHASE_BE1A.md` con entorno, método, tablas y conclusiones, sin datos reales.

## 5. Pruebas

- **Smoke PostgreSQL nuevo `be1a:smoke`** (grupo `postgresql`), que exige 0 bytes de fichero:
  - crea expedientes con Word generado, PDF firmado, evidencia y plantilla con bytes;
  - ejecuta las consultas de listado, ficha y formulario de los ocho módulos con un cliente instrumentado;
  - comprueba además que la descarga de cada tipo devuelve los bytes originales.
- Las pruebas de copia de §3.3, dentro del mismo smoke o en las suites de versionado existentes.
- La prueba unitaria del inventario de §3.4.
- **Regresión:**
  - suites existentes de descargas, generación, versiones, PDF firmados, PNT, Auditorías y recuperación (`phase4b2-recovery`);
  - CI completa;
  - lint, tsc, `prisma validate` y build.

## 6. Documentación

- **`docs/DECISIONS.md`, D-112:** los bytes de fichero quedan fuera de las lecturas por defecto; quien los necesita los pide expresamente; existe un inventario de consumidores.
- **`docs/CURRENT_STATUS.md` y `docs/V1_BASELINE_AND_BACKLOG.md`:** BE1-A hecho; B (errores y registros) y C (índices con evidencia) pendientes de aprobación de alcance.
- **`docs/PHASE_BE1A.md`:** medición.

## 7. Entrega

- Una PR desde la rama de trabajo, con CI verde, y fusión según la pauta vigente.
- Rollback: revertir la PR. No hay migraciones ni datos nuevos.

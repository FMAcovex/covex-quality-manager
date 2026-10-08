# P1A — Registro maestro de PNT

Baseline: `da0f61a4c77677b002d1e18fc4162dd629a4a8d6`.

## Fuentes contrastadas

Se revisó el texto extraído de los originales vigentes de Dirección de Calidad en SharePoint:

- **GC-00/001/03**, «Elaboración, aprobación y archivo de PNT», vigente desde 13/04/2026. Fichero `GC-00.001.03 Elaboración de PNTs.docx`, carpeta `GC-00.001 Elaboración, aprobación y archivo de PNT's`. Apartados 5.4 (AB-XX/YYY/ZZ y revisión original 00), 5.5 (validez general cinco años), 5.8 (revisiones).
- **GC-00/013/01**, «Control de documentación», vigente desde 15/06/2023. Fichero `GC-00.013.01 Control de documentación.docx`, carpeta `GC-00.013 Control de documentación`.

Ambas carpetas están en `DIRECCIÓN DE CALIDAD/GC-00 DIREC. GARANTIA DE CALIDAD`. No se usaron borradores ni OBSOLETOS. Este contraste textual no acredita huellas de binarios ni fidelidad de formato. El índice `ÍNDICE GENERAL 2025.xlsx` no se importa ni se procesa en P1A.

## Modelos y límites

`ControlledDocument` representa la identidad permanente: UUID, código base único opcional durante el borrador, título, tipo PNT, Department existente, código/nombre departamental congelados, observaciones, fechas, responsable y estado administrativo. `TECHNICAL_INSTRUCTION` queda reservado en el enum sin captura ni flujo habilitado.

`ControlledDocumentRevision` tiene UUID propio, revisión explícita de dos cifras (incluida 00), motivo, fechas documentadas, revisión anterior, estado documental, snapshots de identidad/departamento, fuente y verificación, responsable/fecha de registro. La referencia anterior se limita al mismo maestro. `ControlledDocumentChange` registra cambios del maestro y de revisión dentro de la misma transacción, con valores anterior/nuevo, responsable y motivo: historial operativo, no audit trail GMP.

Restricciones PostgreSQL: código base único incluso para históricos, revisión única por maestro, una vigente y una en elaboración simultáneas, formato y orden de fechas. La limitación de una revisión en preparación es una decisión operativa P1A, no una regla GMP atribuida al PNT. No hay códigos anuales ni revisiones creadas automáticamente.

Los estados administrativos son Borrador de registro, Activo en registro y Anulado (reservado). Solo se implementan alta/edición de borrador y registro del maestro activo; no hay acción de anulación del maestro en P1A. Los estados documentales futuros están definidos, pero la captura solo admite:

- borrador en elaboración;
- registro contrastado de una revisión **ya existente** vigente, obsoleta o anulada.

Este último exige referencia, confirmación de verificación y responsable. Una vigente exige fecha alcanzada. No se aprueba ni publica una revisión nueva mediante un selector. No se sustituye ni se obsoleta automáticamente una vigente: el ciclo de aprobación/publicación corresponde a P2. Las revisiones existentes verificadas quedan consolidadas y no editables; los borradores conservan su UUID al editarse. El código de un maestro registrado/consolidado es permanente.

Las fechas se almacenan por revisión (en el borrador pueden ser previstas y no activan su vigencia) sin inferir fechas ausentes, sin completar automáticamente cinco años y sin generar revisión al vencer. Los departamentos inactivos pueden seleccionarse para documentación histórica contrastada, nunca se reactivan. La edición con el mismo Department conserva el snapshot aunque el catálogo cambie. Cambiar el maestro no modifica ninguna revisión consolidada. El servicio comprueba concurrencia mediante bloqueo del maestro y fecha de modificación.

## Pantallas

Menú «Documentación controlada»; listado SQL (25 por página, sin límite total), búsqueda código/título/departamento congelado/referencia, departamento, estado maestro/documental, revisión y vigencia/revisión prevista. Nuevo PNT admite borrador incompleto sin inventar revisión 00; completar y registrar posteriormente. Ficha con Información, Revisiones (orden descendente), Documentos (referencias/verificación reales de solo lectura) e Historial. Edición del maestro y de revisiones en elaboración. No hay botones simulados de descarga, aprobación, firma o importación. La navegación local vuelve a cargar el documento para mostrar el snapshot persistido después de acciones. Los rechazos de validación conservan los valores capturados.

## Verificación

- Pruebas focalizadas de código, borrador, fechas, evidencia y composición SQL de filtros.
- `pnpm pnt-p1a:smoke`: PostgreSQL, persistencia, revisión inicial 00, unicidad, vigente más elaboración, edición/conflictos, departamentos históricos, snapshots, historial y rollback, filtros y 301 registros paginados.
- Smoke navegador P1A: rechazo sin perder datos capturados, borrador incompleto, completar registro, añadir/editar revisión, referencias/historial y listado. No ejecuta navegadores de otros módulos.
- Prisma validate/generate y `pnpm quality` al final.

## Pendientes concretos P1B

Analizar las 42 hojas del índice real; clasificar familias PNT/otros tipos y códigos históricos antes de importar; resolver códigos duplicados entre hojas como procedencias múltiples de una misma identidad, o conflictos para revisión manual. Implementar parser, staging, previsualización, validación/deduplicación, informe de incidencias y confirmación de importación idempotente. Mapear departamentos históricos sin reactivarlos, fechas ausentes, revisión 00, anulados y en elaboración. `sourceMetadata` JSON en maestro/revisión permite conservar fichero/hoja/fila(s) y `verificationStatus` permite marcar datos pendientes de contraste. No se insertan datos del índice ahora.

P2/P3: evidencia de aprobación independiente del método vinculada al UUID de revisión, posterior PDF firmado manualmente V1, eventual firma autenticada con evento/marca temporal/evidencia verificable solo tras decisión y validación específica; gestión documental/copias, relaciones y comunicaciones. P1A no crea campos de firma ni declara cumplimiento regulatorio.

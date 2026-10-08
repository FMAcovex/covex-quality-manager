# P1B-2 — Importación controlada del índice maestro PNT

Baseline: main `bf72ade8239072e116bc540a9076be0460550072` (P1B-1). Rama: `feature/pnt-p1b2-import`.

## Flujo y límites

La pantalla P1B-1 sigue ofreciendo análisis sin escrituras operativas. Guardar un lote vuelve a analizar el archivo en servidor; no acepta informes manipulados por el navegador. Se guarda SHA-256, nombre, UUID, fecha de análisis, responsable, resumen, procedencia, filas normalizadas e incidencias. No se almacena el XLSX binario.

Staging: 16 MiB de JSON por lote y 100 lotes pendientes/parciales en total. Retención de pendientes: 30 días desde el alta, sin renovación silenciosa. Al acceder al módulo se caducan los lotes vencidos y se purgan sus filas sin resultado. Se conserva la cabecera, resumen, decisiones/eventos operativos y filas ya confirmadas. El vencimiento bloquea nuevas decisiones y confirmaciones incluso antes de la purga. Los resultados confirmados conservan datos normalizados, resolución y procedencia, retirando las celdas Excel originales; no se borran PNT ni revisiones. La purga es oportunista al usar el módulo; en una instalación sin uso debe ejecutarse el servicio de retención periódicamente según la operación local.

Recuperación por UUID y listado de los 100 lotes más recientes. Filtros de código/título y decisión, paginación de 25 filas, consulta de originales/incidencias/diferencias. Cada decisión conserva responsable, fecha, motivo, resolución y alcance. Las familias no PNT permanecen excluidas. Los grupos repetidos muestran todas sus procedencias: elegir explícitamente una fila válida y excluir las demás, excluir el grupo o dejarlo pendiente. No se elige revisión por su número.

La inclusión exige título, código válido del parser, departamento existente elegido expresamente, revisión de las incidencias y motivo. La revisión puede quedar vacía: se importa solo el maestro, conservando la declaración y fechas en metadatos, sin inventar 00. Fechas vacías permanecen vacías; fechas imposibles o contradictorias se rechazan. Una correspondencia desconocida no permite incluir; una correspondencia manual, incluso histórica/inactiva, queda documentada sin crear ni reactivar departamentos. El índice no aporta un nombre departamental acreditado cuando solo identifica la hoja: se conserva su etiqueta original y código, sin inventar ese nombre.

## Fuente y estados separados

`GC-00` no se analiza, concilia ni importa. `GC-00(` es la única fuente GC-00, con departamento normalizado `GC-00` y hoja original conservada. PORTADA y Caducidades 2026 siguen siendo fuentes secundarias excluidas.

Tres dimensiones independientes:

- Declaración Excel: IN_FORCE / ANNULLED / IN_PREPARATION / UNDETERMINED en `sourceMetadata.indexImport`, con valores originales, resolución y procedencias.
- Estado documental: nuevas revisiones `IMPORTED_PENDING`, siempre `UNVERIFIED`, sin `consolidatedAt`, verificador, aprobación, revisión anterior inventada ni evidencias/PDF. La nueva etiqueta no participa en las restricciones de una vigente y un borrador de P1A.
- Estado administrativo: los nuevos maestros quedan DRAFT / UNVERIFIED. Una declaración ANULADO no produce una anulación administrativa ni documental acreditada.

Ficha y listado muestran origen, estado declarado y pendiente de verificación. Las revisiones importadas no pasan por el flujo de registro verificado P1A. Su contenido no se presenta como consolidado. El código de un maestro importado queda protegido también frente a edición P1A.

## Persistencia y confirmación

Migración aditiva `20261008210000_pnt_p1b2_import`: enum IMPORTED_PENDING y modelos `ControlledDocumentImportBatch`, `ControlledDocumentImportRow`, `ControlledDocumentImportEvent`. UUID, índices por lote/estado/identidad/procedencia, FK Restrict y checks de estados, decisión completa y ausencia de evidencia en IMPORTED_PENDING. No cambios a QMS, relaciones, versiones ni otros módulos.

Servicio específico: staging → decisión manual → propuesta → casilla de confirmación expresa → transacción. La propuesta muestra nuevos maestros/revisiones, existentes a omitir, excluidos, pendientes, conflictos, escrituras operativas y escrituras totales, incluyendo resultados e historial del lote. El servidor exige el token exacto, la versión del lote y el conjunto exacto de filas elegibles mostrado. Los pendientes y conflictos no entran en la importación parcial.

La decisión captura una huella del maestro, todas sus revisiones y departamento. La propuesta y confirmación releen la BD. Cambios posteriores obligan a nueva conciliación; título, departamento o fechas incompatibles bloquean, sin sobrescritura. Una revisión existente compatible se omite, preservando íntegramente su estado, verificación, fuente, consolidación y snapshot. Una nueva revisión compatible se añade sin modificar el maestro existente ni sus revisiones. Se registra su historial específico `ControlledDocumentChange`, además de resultado y eventos del lote.

Identidades SQL existentes: baseCode y documentId + revisionCode. Procedencia: SHA-256 + hoja + fila, `sourceKey` único dentro del lote. Todos los orígenes de un grupo se guardan en la procedencia de la importación. Transacciones SERIALIZABLE, bloqueo del lote y versión optimista impiden resultados parciales y confirmaciones concurrentes incoherentes; una colisión solicita revisión/reintento. El recibo del token confirmado permite repetir la misma solicitud sin nuevas escrituras. Reimportar el archivo genera otro lote para conciliación, pero omite las identidades ya registradas; no sobrescribe históricos ni degrada verificación.

Errores de confirmación dejan un marcador operativo genérico; no guardan SQL ni datos privados en logs. El cliente Prisma específico de análisis/importación no emite diagnósticos que puedan revelar contenido del libro. Historial operativo, no audit trail GMP validada.

## Verificación

Fixtures exclusivamente sintéticos en Git. Pruebas de validación de resolución, fechas, revisión explícita, GC-00 excluida, GC-00( y familias excluidas. Smoke PostgreSQL específico: decisiones de grupo, desconocidos/inactivos, declarados vigentes/anulados/en elaboración, 00/vacíos, parcial, reimportación/reintento, revisión adicional, revisión consolidada inmutable, cambios posteriores, fallo SQL después de una escritura con rollback total, concurrencia entre lotes y del mismo token, resultados/historial y caducidad. Smoke Chromium: guardar/recuperar, decidir, propuesta y casilla expresa, importación parcial, exclusión de grupo, ficha/listado y consulta de resultados, sin hidratación fallida.

El Excel real se prueba solo en QA privado/aislado con análisis sin confirmación: 42 hojas, 39 interpretadas, 821 apariciones PNT / 817 códigos, cuatro grupos discrepantes y 970 otras familias. Ni binario ni filas reales en Git/logs; ninguna importación real definitiva. CI documental reutilizada por rutas, con guardia de esquema aditivo específico para estos modelos/estado; sin excepción de rama. Incluye smokes PostgreSQL/navegador P1A, P1B-1 y P1B-2 y `pnpm quality` final.

## Pendientes P2

Contraste y acreditación documental, aprobación vinculada a revisión, gestión de evidencias/archivos y PDF firmado externo. Decidir el flujo que acredita y promueve una revisión importada, respetando sus datos de origen e históricos. No implementados en P1B-2: aprobación/firma electrónica, archivos firmados, publicación, alertas ni P3. La importación del libro corporativo exige autorización expresa para las confirmaciones reales.

# P1B-1 — Previsualización y conciliación del índice maestro

Baseline P1A fusionada: `18f885d2d0b3b4f0c2f899a1610808233700351c`.

## Fuente y corrección del usuario

`ÍNDICE GENERAL 2025.xlsx` se analizó en el entorno de trabajo privado, obtenido del original de Dirección de Calidad previamente identificado. Ni el binario, ni sus filas reales, ni el informe detallado se versionan, se publican como fixtures o se escriben en logs. Los tests versionados generan XLSX sintéticos.

**GC-00 no es fuente válida.** Se descarta al seleccionar las hojas, antes de resolver/interpretar su worksheet XML; no aporta filas, candidatos, conflictos, duplicidades ni estadísticas. Se usa exclusivamente **GC-00(** para ese departamento; `departmentCode = GC-00`, pero `source.sheet = GC-00(`. Su coexistencia con la descartada no origina ninguna conciliación entre ambas. PORTADA y Caducidades 2026 también se excluyen como fuentes secundarias. El número total de hojas solo refleja metadata del libro; no cuenta filas descartadas.

## Lectura y normalización

Lector OOXML XLSX con límites de tamaño/expansión, integridad ZIP y sin ejecutar fórmulas, entidades externas o enlaces. Reconoce textos compartidos/inline y valores numéricos/fecha. Las columnas se detectan por encabezados, incluidos encabezados en varias filas y posiciones distintas; SG-20 A–E y particiones MC-20_1/2/3 se prueban expresamente. Si faltan encabezados, puede mostrar una disposición inferida, marcada para revisión manual. Los encabezados y pies de totales no son filas documentales.

Código base separado de revisión; normalización compatible de espacios, guiones y separadores sin perder originales. Revisión 0/3 → 00/03. ANULADO no se convierte en número. Se admiten fechas numéricas Excel (epoch 1900/1904), ISO y texto día/mes/año, incluidas fechas vacías y marcadores NA/ANULADO/EN ELABORACIÓN. Fechas ambiguas o inválidas quedan como incidencia; no se infiere un siglo ni se completa una revisión prevista a cinco años. Valores de fórmulas son valores cacheados, nunca recálculos; se marcan para contraste.

Solo códigos estándar y clasificación PNT son candidatos potenciales. PAM/PAF, PV/IV, PL/PF, VO/DC, PE/PAN, planes maestros y otras familias se muestran aparte. Un candidato no implica que esté listo para importar: errores, ausencias y conciliaciones siguen pendientes.

## Estados y contrato P1B-2

Contrato versionado `PreviewReport` / `PreviewRow`: nombre/SHA-256 del archivo, hoja/fila, código original, celdas originales con tipo/valor cacheado, valores normalizados, clasificación, incidencias, decisión pendiente y resultado de conciliación. `identityKey` es el código base; `revisionKey` base/revisión explícita; `sourceKey` es la huella de archivo/hoja/fila. Las claves permiten definir una futura confirmación idempotente; todavía no hay confirmación ni API escritora.

Se distingue `declaredState` (Vigente según índice, Anulado, En elaboración, Sin determinar), `stateBasis` (texto explícito, fechas o desconocido) y `reviewOverdue` (fecha prevista anterior a la referencia temporal). Una fecha vigente del índice solo permite inferir su declaración, no verificar un Word/PDF. La fecha vencida no obsoleta ni crea revisiones. Estados contradictorios, vigencias futuras y revisiones ausentes requieren revisión manual. **Cada fila del índice conserva `verificationStatus = UNVERIFIED`**, aunque coincida con una revisión verificada en BD; esta última conserva sus valores y se indica por separado.

No se modifica el esquema P1A ni se añaden estados de aprobación: `sourceMetadata` JSON puede conservar la declaración del índice y su procedencia de forma separada del estado documental de la app; `verificationStatus` ya admite UNVERIFIED/REVIEW_REQUIRED. P1B-2 debe cerrar el mapeo del estado documental persistido de los registros no contrastados y el criterio de consolidación. No se llamará al registro P1A de existentes verificados fingiendo una verificación del índice.

## Duplicados y conciliación de solo lectura

Agrupación por código base normalizado: duplicado exacto, revisiones distintas, títulos distintos, datos contradictorios para la misma revisión, repetición dentro de una hoja y correspondencia departamental distinta. Se conservan todas las procedencias válidas; no se elige la revisión más alta ni se crea un segundo maestro.

Consulta en lotes `ControlledDocument` y sus revisiones, y el catálogo Department. Clasifica documento nuevo, maestro existente con revisión no registrada, revisión existente, conflicto con persistidos y no importable sin resolver incidencias. Una diferencia de fechas, título, departamento o estado se presenta con valores índice/persistido para conciliación. Si la revisión ya existe, se compara con su snapshot histórico, no con un título/departamento posterior del maestro. Departamentos sin correspondencia o inactivos se señalan; no se crean ni reactivan. **El servicio productivo solo usa SELECT**: no inserta/actualiza PNT, revisiones, historial ni departamentos, ni modifica una revisión consolidada.

## Pantalla y privacidad

«Importar índice maestro» en el listado P1A: seleccionar XLSX (hasta 8 MiB), analizar, resumen, examinar filas, buscar por código/título, filtrar incidencia/conciliación, paginar, consultar originales y todas las procedencias de los grupos. No existe botón de importación definitiva.

El API limita el cuerpo antes del multipart, analiza en memoria y devuelve el informe con `Cache-Control: private, no-store`. No guarda el original ni crea tablas de staging. El cliente conserva el informe solamente durante esta página: al recargarlo o analizar otro archivo se descarta. El entorno privado de desarrollo conserva temporalmente los bytes/informe solo para esta comprobación, fuera del repositorio. Sin integración corporativa nueva en la aplicación.

## Resultados del libro real (referencia 2026-10-08)

Recalculados desde las fuentes válidas, sin GC-00:

- 42 hojas en el libro; **39 interpretadas**, tres excluidas.
- **1.791 filas documentales**: **821 apariciones PNT**, **817 códigos base únicos**, **970 documentos de otras familias**.
- **4 grupos repetidos**, cuatro apariciones adicionales; cuatro grupos con discrepancias de título/datos, **0 grupos con revisiones distintas**.
- **821 candidatos pendientes de verificación documental**; ningún dato importado.
- 212 filas con datos incompletos del índice; 156 anuladas según índice, dos en elaboración; 99 con revisión prevista vencida.

La correspondencia con Department y conflictos contra BD dependen del catálogo/registro del entorno donde se analice. El smoke privado utiliza una BD QA aislada con registros ficticios: no se presenta su conciliación como inventario real de producción. Las cifras preliminares que incluían GC-00 ya no sirven de referencia.

## Pruebas y CI

Tests sintéticos focalizados: exclusión temprana incluso con XML descartado inválido; estadísticas iguales al agregar datos contradictorios en GC-00; no consultar sus códigos exclusivos en BD; procedencia GC-00( y normalización GC-00; columnas reordenadas/SG-20/particiones MC-20; fechas/00/estados/familias; duplicidades; inactivos/ausentes y revisiones consolidadas existentes.

`pnpm pnt-p1b1:smoke`: PostgreSQL/API, informe repetible, rechazo de XLSX inválido y snapshots de PNT/revisiones/historial/Department idénticos antes y después. Solo el montaje y limpieza de fixtures ficticios escriben en la BD QA; el análisis no escribe. La variable opcional `P1B1_PRIVATE_XLSX_PATH` verifica el original privado e imprime exclusivamente estadísticas agregadas.

`pnpm pnt-p1b1:ui:smoke`: carga/análisis, resumen, filtros, originales, exclusión y ausencia de botón definitivo; BD sin cambios. `pnpm quality` se ejecuta una vez al final. Se reutiliza el job documental existente de CI, seleccionado por rutas modificadas y scripts/dependencias, **sin nueva condición por nombre de rama**. Ejecuta P1A/P1B-1 y quality; no navegadores de otros módulos para cambios exclusivamente documentales. Cambios de dependencias/build/test o rutas ajenas conservan la validación general.

## Pendientes exactos P1B-2

Persistencia de staging/decisiones y permisos/retención; decisiones humanas sobre duplicados/conflictos y correspondencias departamentales; clasificación de familias no PNT; completar datos desde fuentes reales sin inferencias. Cerrar el mapeo de estados declarados sin verificar y la política de consolidación. Añadir confirmación transaccional idempotente con clave de identidad/revisión y procedencias múltiples, comprobación de concurrencia/obsolescencia de la conciliación, historial del lote y reporte de importados/rechazados. No sobrescribir consolidadas, no reactivar departamentos y no asignar VERIFIED automáticamente. La futura verificación y aprobación mantienen evidencia independiente de su método; no se implementan ahora.

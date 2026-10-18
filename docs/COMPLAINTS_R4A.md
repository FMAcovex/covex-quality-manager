# R4A — Reclamaciones: cierre funcional

Baseline: `main` `4e09c3f993bdaa9e90cb7b0232103c9cd76247fd`. Rama: `feature/complaints-r4a-functional`. Alcance: funcional y ajustes de interfaz necesarios; la revisión UX/UI global queda aplazada hasta completar todos los módulos.

## Estado previo revisado

| Grupo | Evidencia en main y actuación R4A |
|---|---|
| A — Correcto, reutilizado | Cliente/proveedor al comienzo, Draft, campos Parte I/II, ocho acciones múltiples, relaciones canónicas COMPLAINT→CAPA/RETURN, navegación inversa, PDF por QmsRecordVersion, Review R2C y sus targets, generación III/V v03 y smoke R3 Reclamaciones. |
| B — Parcial | Versiones y snapshots: faltaban bloqueo de secuencia, UUID de relaciones y fecha inicial consistente. Listado: límite 300 y filtros de seguimiento/situación en memoria. IV v03 estaba bloqueado por falta de fuente verificada. |
| C — Corregido | UUID de propuestas recreados al editar, desplazamiento de campos Word al expandir varias acciones, pérdida de datos al cambiar Parte II, obligatorios de producto no reactivos, falta de paginación real y filtros de recurrencia/CAPA/Return. |
| D — Legacy conservado | ComplaintFollowup, datos, modelo y entrada técnica existentes. Consulta de solo lectura en Historial cuando hay datos; ninguna captura paralela en la UX principal ni backfill masivo. Extracción de anexos v02 conservada. |

## Fuentes reales

Fuente SharePoint autorizada de Dirección de Calidad, carpeta `10 AUDITORIAS e INSPECCIONES/INSPECCIONES/PLANTA FARMA/INSPECCIÓN 2026/PLAN CAPA/Deficiencia 4/4.b. Reclamaciones`:

| Binario revisado | SHA-256 |
|---|---|
| GC-00.027.03 Reclamaciones.docx | `45965ecfbfb4cf496242349e74f42a01a598868b4a35eeac92b21a91a80ded59` |
| Anexo III 03 INFORME RECLAMACION.docx | `764e12076b407e9675f6291f03c8bab477f7850fbdb62fed8a904b4693b2bcde` |
| Anexo IV 02 RECLAMACION RESPUESTA.docx | `61b642c608cf4f8726a6ec04325e2cbbdbec30f3cf727b96acab746be1861dce` |
| Anexo V 02 LISTADO DE RECLAMACIONES.xlsx | `8d9a572fcfbc8bba05d99e3772aa0fec6fd3b716b6db2eaa5a056737d79d1d83` |

Los nombres IV/V contienen “02”, pero sus cabeceras pertenecen a GC-00/027/03; no se seleccionaron por el nombre. III y V coinciden con los hashes v03 que ya reconocía el generador. Se conserva estructura/tablas/campos/textos fijos; III amplía únicamente las filas previstas de acciones. Fecha de seguimiento se incorpora a la celda existente de versión, sin crear otro campo oficial. IV utiliza su binario separado real y conserva sus cuatro tablas.

El PNT muestra 26/05/2026. R4A conserva la fecha de aplicabilidad 28/09/2026 ya configurada para v03 en la aplicación y los pins históricos; no realiza reasignación retroactiva de plantillas ni declara una nueva vigencia documental. El instalador verifica todos los hashes antes de escribir y no cambia la vigencia de versiones ya existentes. Los binarios corporativos no se versionan en Git.

El usuario ha contrastado `RECLAMACIONES.docx` y confirmado la coincidencia funcional, con la corrección explícita de retirar «Aprobaciones Parte I» y «Aprobaciones seguimiento / cierre». Ambos campos se retiran de la captura y presentación funcional actual. `approvalNames` y `closeApprovalNames` permanecen en Prisma, base de datos y snapshots por compatibilidad legacy: el guardado conserva los valores existentes leídos bajo bloqueo transaccional e ignora entradas antiguas de esos campos. No se modifica el esquema ni se hace migración; los snapshots históricos congelados permanecen intactos.

## Flujo y reglas

- El guardado devuelve confirmación tras el commit y el formulario carga el detalle persistido. Esto evita el retorno pendiente observado al combinar la respuesta de acción con la redirección al detalle ya visitado del Draft. No altera la asignación de códigos/versiones.
- Pestañas: Resumen, Parte I, Parte II, Relaciones, Documentos, Versiones, Revisión, Historial. No cambian las identidades, anchors ni deep links de Review ya válidos.
- Guardar actualiza el estado vivo y el snapshot vigente mutable; no crea otra versión ni cambia autor/motivo originales de emisión. Guardar como nueva versión exige fecha DATE válida y motivo; mantiene autor/creación y asigna V01+ bajo bloqueo transaccional de QmsRecord. Draft debe abrirse antes de un seguimiento formal.
- V00 recoge la apertura documentada; al emitir V01 se congela. Los siguientes cambios en Parte II, acciones, relaciones, eficacia y cierre no alteran versiones anteriores. La fecha de seguimiento, propuestas con UUID y relaciones canónicas con UUID/tipo/código forman parte del snapshot. No se generan versiones por cambios administrativos.
- Las propuestas CAPA y acciones conservan UUID al editar, incluida una propuesta vinculada; un UUID ajeno se rechaza. Los códigos libres históricos se consultan sin introducir otra relación formal. Relaciones permite buscar/seleccionar el UUID real; no crea filas inversas ni duplica vínculos.
- Parte I conserva registro, evaluación inicial, investigación/impacto, causa, clasificación, evaluación regulatoria, resolución, acciones, comunicaciones y conclusión. Referencia/lote/cantidad/caducidad son campos existentes; producto/material activa sus obligatorios. Los controles internos son opcionales.
- §5.2 del PNT permite una incidencia comercial, administrativa o logística evaluada sin impacto GMP/ambiental sin apertura completa del informe. Se reutiliza NO_GMP_IMPACT para esa condición, conservando el enum histórico sin tratarlo como criticidad. Se exige descripción, ausencia de impacto documentada, evaluador y decisión, además de identificación operativa de la aplicación. Si se identifica impacto, debe completarse el informe y seleccionar criticidad. No se crean modelos ni campos nuevos.
- Draft admite propuestas incompletas. Los detalles condicionales y Parte II permanecen montados para conservar contenido al alternar; los obligatorios se activan según estado/condición. Las fechas se validan también en backend.
- Parte II conserva respuesta/compromisos/suficiencia, verificación de eficacia, estado y referencias/responsable de acciones, conclusión, cierre/próximo seguimiento. Las aprobaciones quedan únicamente como datos legacy, sin captura ni presentación funcional actual. No hay firma electrónica.
- Cierre en Parte I exige decisión de no continuar y conclusión. Cierre en Parte II exige conclusión propia, fecha, valoración de eficacia (también justificación de N/A), resultado sin Pendiente y acciones completadas o con seguimiento independiente documentado. No se exige cerrar universalmente toda CAPA/devolución: §5.8 permite acciones vinculadas pendientes bajo control. La evaluación regulatoria aplicable debe estar documentada. No se inventan plazos ni automatizaciones de retirada/notificación.

## Documentos, PDF y Review

Las referencias canónicas de expedientes vinculados se incorporan al texto de resolución del documento desde el snapshot, sin crear códigos libres paralelos ni alterar las etiquetas oficiales. III y IV pueden descargarse para una secuencia exacta desde su snapshot; GeneratedDocument queda asociado a QmsRecordVersion y plantilla cuando el snapshot dispone de pin. IV es opcional cuando se requiere respuesta formal al cliente (§5.7), sin convertirlo en obligatorio de cierre ni bloquear respuesta a proveedor. V conserva el listado anual oficial; listado simple comparte los filtros SQL y utiliza el próximo seguimiento del expediente y la fecha de la versión funcional, con fallback histórico cuando no existen versiones.

La carga del PDF confirma el commit y recarga el detalle únicamente en Reclamaciones; los demás módulos conservan su comportamiento. PDF firmado usa exclusivamente RecordVersionDocument: pertenencia al expediente/versión, checksum, descarga y sustitución con motivo/historial existentes. Review conserva PENDING/ACCEPTED/RESOLVED, Activas=PENDING+ACCEPTED, valueSnapshot y recordVersionId. Un hilo de V00 sigue en V00 después de V01/V02. El historial administrativo sigue separado de las versiones.

## Listado y despliegue

Consulta y conteo filtrados en SQL; páginas de 25 registros, filtro por situación/seguimiento/recurrencia/CAPA/devolución/Review, búsqueda por código relacionado, conservación de ColumnSelector. Versiones y Review se consultan por lotes, sin consultas por fila. Sin migración ni modificación de schema.prisma.

Instalar binarios autorizados desde una carpeta fuera de Git con `pnpm templates:install -- /ruta/carpeta` (D-099), que los reconoce por su SHA-256. El PNT v02 histórico se instala igual y queda guardado para los anexos v02. La CI usa OOXML ficticio explícitamente etiquetado TEST solo para comprobar los flujos; la comprobación local utiliza los tres anexos reales instalados en la BD aislada.

## Validación

Validación local: `pnpm quality` en Node 22 verde (334 tests en 67 archivos, Prisma validate/generate, lint y build); 36 smokes del pipeline PostgreSQL y seed demo verdes; smoke R4A PG y UI cliente/proveedor verde con fuentes oficiales, 1440/768/390 sin errores JS/hidratación. Regresión de navegador Review R2C y Auditorías R3A×3/R3B/R3C; resultados también en CURRENT_STATUS y en la PR. CI ejecuta esos checks con Node 22 e incorpora los nuevos smokes R4A. Se conserva sin modificaciones ni debilitamiento el smoke R3 Reclamaciones. El nuevo smoke PostgreSQL prueba tres emisiones concurrentes, snapshots históricos completos, desvinculación conservando fecha y paginación de 305 registros. El smoke UI usa guardados reales, V00/V01/V02, acciones múltiples, búsqueda UUID, PDF por versión con descarga HTTP y checksum verificado, Review histórico y cierre en 1440/768/390 con navegador Europe/Madrid y servidor UTC.

Documento del usuario contrastado por el usuario; aprobaciones retiradas de la UX conservando el histórico legacy. Pendiente visual único: **Revisión UX/UI transversal final**.

## Corrección final del contraste del usuario

Retiradas las secciones de aprobaciones del formulario y del detalle. Confirmado sin cambios: `effectivenessRequired` y `externalCommunication` no se capturan; `internalObservations` permanece opcional en Control interno al final de los datos funcionales; Parte II ofrece Pendiente / Sí (continúa) / No procede; un expediente abierto, incluida eficacia pendiente, conserva próximo seguimiento. El smoke de navegador añade comprobaciones de ausencia de esos campos y persistencia de aprobaciones legacy en la BD y V00/V01/V02, además de los guardados Draft, cambios y nueva versión existentes. Los documentos históricos siguen usando los snapshots originales.

Validación de la corrección: 28 tests afectados en 5 archivos verdes; `pnpm quality` verde (334 tests / 67 archivos), typecheck, smoke R4A PostgreSQL, regresión R3 Reclamaciones y smoke R4A UI cliente/proveedor con anexos oficiales a 1440/768/390. El navegador verifica también que un cliente antiguo que envía valores de aprobación diferentes o vacíos no sobrescribe el histórico. No se ha debilitado ninguna comprobación previa. La CI completa de la misma PR #102 ejecuta todos los checks sobre el head publicado.

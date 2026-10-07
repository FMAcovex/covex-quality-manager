# Flujos funcionales

## W-01 — Crear desviación

1. Usuario entra en Desviaciones.
2. Pulsa `+ Nueva desviación`.
3. La app crea/edita un formulario por bloques.
4. Se permite guardar con información parcial compatible con expediente Abierto.
5. Al primer guardado definitivo se crea QmsRecord + Deviation.
6. Se registra historial de creación.

La codificación visible puede asignarse según regla aprobada. Nunca usarla como PK.

## W-02 — Editar desviación

1. Abrir expediente a pantalla completa.
2. Pulsar Editar.
3. Modificar campos.
4. Guardar.
5. Registrar campos modificados en ChangeHistory.

En V1 se permite editar una desviación Cerrada.

## W-03 — Añadir seguimiento

1. Desde expediente, pulsar `+ Seguimiento`.
2. Introducir fecha, autor manual, tipo, comentario, próxima fecha y evidencia opcional.
3. Crear DeviationFollowup.
4. No sobrescribir entradas anteriores.
5. Mostrar línea temporal ordenada.

## W-04 — Planificar CAPA

1. En evaluación de la desviación indicar si procede CAPA.
2. Añadir una o varias propuestas.
3. Cada propuesta se guarda en DeviationCapaPlan.
4. Cuando exista módulo CAPA, acción `Crear CAPA` genera QmsRecord/Capa y QmsRelation.
5. La propuesta queda vinculada al expediente CAPA real.

Una desviación admite varias CAPA. Una CAPA puede relacionarse con varias desviaciones u otros registros.

## W-05 — Cerrar desviación

1. Completar investigación, causa, impacto, acciones y conclusión según PNT.
2. Introducir fecha cierre y estado Cerrada.
3. Aplicar validaciones de consistencia disponibles.
4. Guardar.
5. La app no bloquea edición en V1.

No inventar automáticamente conclusiones GMP.

## W-06 — Generar Anexo III

1. Cargar expediente.
2. Seleccionar la TemplateVersion correspondiente al expediente.
3. Mapear campos.
4. Generar DOCX conservando formato controlado.
5. Descargar.
6. Registrar GeneratedDocument.
7. No guardar automáticamente en SharePoint en MVP.

## W-07 — Generar Anexo V

1. Usuario pulsa Exportar > Anexo V.
2. Selecciona año.
3. App consulta todas las desviaciones del año.
4. Usa versión de plantilla aplicable.
5. Completa hoja detallada y vista simplificada/imprimible.
6. Descarga XLSX.
7. No altera los registros.

## W-08 — Listado simple

1. Usuario aplica filtros opcionales.
2. Exportar > Listado simple.
3. Exportar columnas operativas de seguimiento.
4. Mantener filtros activos.

También debe existir listado completo por año.

## W-09 — Importación histórica

1. Leer fichero origen sin modificarlo.
2. Validar cabeceras y tipos.
3. Ejecutar modo preview/dry-run.
4. Detectar duplicados y anomalías.
5. Importar 2025/2026.
6. No inventar campos faltantes.
7. Marcar calidad del dato.
8. Generar resumen: creados, omitidos, advertencias, errores.

La importación debe ser idempotente o disponer de clave de importación para evitar duplicados.

## W-10 — Relaciones

1. Usuario visualiza `Expedientes relacionados`.
2. Puede vincular un registro existente compatible.
3. Se crea una única QmsRelation.
4. La relación se muestra desde ambos expedientes.
5. Desactivar relación no elimina los expedientes.

## W-11 — Cambio de versión documental

1. Se crea nueva FormVersion/TemplateVersion.
2. Se marca como vigente para nuevos expedientes a partir de fecha definida.
3. Históricos mantienen sus versiones.
4. No migrar silenciosamente documentos históricos a la nueva versión.


## W-12 — Reabrir una desviación

1. Partir de una desviación Cerrada.
2. Antes de modificarla, actualizar y congelar el snapshot de la versión vigente.
3. Cambiar el estado a Abierta.
4. La fecha de cierre deja de ser vigente en la nueva versión y se conserva únicamente en la versión histórica cerrada.
5. Crear V01/V02… con tipo REOPENING.
6. Registrar el motivo en historial operativo.
7. Las ediciones posteriores actualizan esa versión hasta una nueva reapertura.

## W-13 — Versionar seguimientos CAPA

1. V00 representa el informe inicial.
2. Al registrar un seguimiento se crea el registro `CapaFollowup`.
3. Se congela la versión CAPA anterior.
4. Se crea la versión con el mismo número del seguimiento: V01, V02, V03…
5. El snapshot conserva estado, acciones, próxima fecha, ejecución, eficacia y cierres existentes en ese momento.
6. Si después del seguimiento se completa el cierre operativo o la eficacia mediante edición, se actualiza el snapshot de esa misma versión.
7. El siguiente seguimiento congela la versión anterior y crea la siguiente.
8. Puede existir una versión con estado Cerrada y eficacia Pendiente antes de la versión que registra el cierre efectivo.

## W-14 — Descargar una versión histórica

1. Abrir la pestaña Versiones del expediente.
2. Seleccionar la versión.
3. Generar el anexo a partir del snapshot persistido de esa versión, no del estado actual.
4. Usar la versión de plantilla asociada al snapshot cuando esté disponible.
5. Registrar `GeneratedDocument.recordVersionId`.


## W-15 — Solicitud y Dictamen de un Control de Cambio

1. Crear un único expediente de Control de Cambio.
2. Completar Solicitud (Anexo III): identificación, alcance, solicitante, descripción, justificación, documentos y aceptación/denegación.
3. Completar Dictamen (Anexo IV): evaluación, clasificación, implicaciones, resultado y plan de ejecución.
4. El plan admite cualquier número de departamentos y acciones.
5. Al aprobar el Dictamen, las acciones de origen DICTAMEN quedan bloqueadas como baseline.
6. Las necesidades posteriores no modifican silenciosamente el baseline; se añaden como tareas nuevas desde un seguimiento.

## W-16 — Seguimiento de Control de Cambio

1. El primer seguimiento formal es 00.
2. Cada seguimiento incorpora todas las tareas existentes en ese momento.
3. Para cada tarea se registra estado, fecha real y evidencia/comentario.
4. Una tarea detectada durante seguimiento se crea con `origin=FOLLOWUP` e `introducedInFollowup=xx`.
5. Esa tarea persiste en seguimientos posteriores.
6. En el Anexo V se representa en azul, de acuerdo con la plantilla controlada.
7. Cada seguimiento crea una versión funcional V00, V01, V02... del expediente.

## W-17 — Ejecución, eficacia y cierre de Control de Cambio

1. Mientras existan acciones pendientes, el cambio permanece No ejecutado.
2. Cuando todas las acciones aplicables finalizan, puede pasar a Ejecutado y se registra la fecha de ejecución/cierre operativo.
3. La eficacia puede permanecer Pendiente después de la ejecución.
4. Con eficacia Aceptable se permite el cierre efectivo.
5. También puede cerrarse sin ejecución cuando se documenta expresamente el motivo; en ese caso la eficacia se registra como No aplica.
6. Si permanece abierto, el seguimiento exige motivo y próxima fecha.

## W-18 — Documentos de Control de Cambio

- Anexo III: Solicitud.
- Anexo IV: Dictamen y plan aprobado.
- Anexo V: documento por seguimiento/versión.
- Anexo VII: listado oficial anual.
- Listado simple: vista operativa ampliada, opcionalmente filtrada.

Los Anexos V históricos se generan desde el snapshot exacto de la versión seleccionada.


## W-19 — Reclamación

1. Abrir expediente R/X/NNN/AAAA.
2. Registrar cliente/proveedor y elemento afectado.
3. Investigar hechos, impacto y causa raíz.
4. Clasificar Crítica/Mayor/Menor/Sin impacto GMP.
5. Definir resolución y CAPA cuando proceda.
6. Registrar comunicación/respuesta.
7. Evaluar eficacia si aplica.
8. Cerrar con conclusión y fecha.
9. Mantener relaciones Reclamación → CAPA y Reclamación → Devolución mediante la capa común QMS.

Las CAPA propuestas pueden convertirse directamente en un expediente CAPA real conservando relación QMS.

## W-20 — Devolución

1. Abrir DEV/LG-xx/YYY/AAAA.
2. Registrar cliente/entidad, motivo y documentación.
3. Añadir uno o varios productos.
4. Evaluar criterios de reintegración SI/NO/N.A.
5. Completar evaluación adicional para termolábiles cuando aplique.
6. GC/DT decide Aceptada/Rechazada y destino final.
7. Registrar destrucción/trazabilidad cuando corresponda.
8. Cerrar el expediente.
9. Consultar o vincular la Reclamación de origen mediante la única relación canónica Reclamación → Devolución.

## W-21 — Documentos de Reclamaciones y Devoluciones

Reclamaciones:
- Anexo III: informe interno Parte I + Parte II;
- Anexo IV: respuesta externa;
- Anexo V: listado anual.

Devoluciones:
- Anexo III: formulario de devolución;
- Anexo IV: hoja de devolución, una por producto;
- Anexo V: declaración de conservación del cliente;
- Anexo VI: listado anual.

Los anexos se extraen del PNT controlado instalado y se rellenan sin rediseñar su estructura.


## W-22 — Evolución de formulario
1. Seleccionar una versión existente.
2. Crear clon con nuevo código y fecha de vigencia.
3. El clon queda DRAFT e inactivo.
4. Revisar campos/metadatos de visualización.
5. Implementar técnicamente cualquier cambio estructural GMP que sea necesario.
6. Ejecutar pruebas.
7. Activar la nueva versión.
8. La versión anterior queda RETIRED y conserva todos sus expedientes.

## W-23 — Nueva plantilla documental
1. Seleccionar módulo y tipo documental.
2. Informar versión y vigencia.
3. Adjuntar DOCX/XLSX controlado o registrar ruta técnica.
4. La aplicación calcula SHA-256 cuando recibe archivo.
5. La plantilla queda inactiva.
6. Verificar compatibilidad con el generador y validar output.
7. Activar.
8. La versión anterior queda inactiva con fin de vigencia.

Para Reclamaciones y Devoluciones se carga el PNT DOCX completo, del que el generador extrae el anexo correspondiente.

## W-24 — Administración de catálogo
1. Crear código nuevo cuando aparece una nueva entidad/valor.
2. No reutilizar códigos históricos.
3. Si deja de aplicar, marcar inactivo y opcionalmente fecha fin.
4. Los expedientes existentes conservan su snapshot histórico.

## W-25 — Vencimientos
La bandeja administrativa calcula próximos/vencidos a partir de:
- próximo seguimiento CAPA;
- eficacia CAPA pendiente tras cierre operativo;
- próximo seguimiento de Control de Cambio;
- fecha prevista de ejecución de Control de Cambio;
- próximo seguimiento de Reclamación;
- próximo seguimiento de Devolución.

Las reglas configuran preaviso y severidad. Hito 9 no envía notificaciones.


## Auditorías · alta y apertura R3A

Guardar Borrador admite campos funcionales vacíos. Abrir exige tipo/escenario compatible, objeto, alcance, fecha prevista si no está realizada, áreas y área de codificación para internas, entidad y código entidad para proveedor y al menos un auditor. Con varios auditores se exige exactamente un jefe. Planificación puede preceder a realización. Ediciones conservan UUID de hijos; retirar desactiva, no elimina. No se vuelve a Borrador tras apertura. Cierre definitivo queda reservado a R3B/R3C. Historial operativo registra cambios reales. Anulación conserva expediente y código histórico reservado; AUDIT sin código se puede reactivar.

## Auditorías R3B — tratamiento y seguimiento

Guardar un hallazgo asigna OBS/Rk; editar/reordenar conserva referencia/UUID. Registrar tratamiento y acciones múltiples, sus estados y evidencia textual. Vincular Desviación/CAPA existente mediante buscador UUID; varios hallazgos comparten la misma QmsRelation con atribuciones distintas. Consultar estado vivo y navegar desde ambos extremos. Retirar atribución conserva relación; retirar relación global requiere cero atribuciones activas y motivo. Retirar hallazgo conserva hijos, referencias e historial. Añadir seguimiento general o del hallazgo; timeline descendente con próxima revisión. Reglas derivadas y validaciones en D-065/docs/AUDITS_R3B.md. Cierre definitivo bloqueado hasta R3C.

## Auditorías R3C — informe y cierre

Completar datos de informe, emitir 00, descargar anexos del snapshot, firmar fuera de la aplicación y cargar PDF en la versión exacta. Tratamiento/seguimiento ordinario no modifica snapshot ni emite versión. Revisar contenido y emitir 01+ con motivo; 00/PDF/Review históricos permanecen. Documentos recibidos conservan revisión externa.

QA consulta condiciones calculadas y confirma cierre. Internas: tratamiento/evidencia/verificación y CAPA necesaria cerrada/eficaz. Proveedor: envío final parcial; cierre normal o excepción sin respuesta/no críticos, razón y siguiente auditoría. Cliente/autoridad: acta primaria, acciones/evidencia y respuesta aplicable. Backend valida pertenencia y todas las reglas. closedAt solo definitivo; no reapertura automática. Reglas completas D-066/AUDITS_R3C.md.

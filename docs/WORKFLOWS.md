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


## W-15 — Crear y dictaminar un control de cambio

1. Crear QmsRecord + ChangeControl.
2. Cumplimentar Anexo III lógico: alcance, departamento, solicitante, descripción, justificación y documentos.
3. Registrar aceptación/denegación de la solicitud.
4. Cumplimentar el dictamen: evaluación, Mayor/Menor, fecha prevista, requisitos asociados y plan de ejecución.
5. Registrar resultado del dictamen y responsable de seguimiento.
6. Persistir V00 como estado inicial de solicitud/dictamen.
7. Las ediciones ordinarias actualizan V00 o la versión vigente sin crear una versión funcional nueva.

## W-16 — Seguimiento de un control de cambio

1. El primer seguimiento oficial es 00.
2. Registrar fecha y responsable.
3. Actualizar acciones/evidencias, ejecución y eficacia.
4. Si permanece abierto, exigir motivo y próxima fecha.
5. Si se cierra ejecutado, exigir eficacia Aceptable y conclusión.
6. Si se cierra sin ejecución, registrar expresamente cierre sin implantación y conclusión.
7. Crear ChangeControlFollowup.
8. Congelar la versión funcional anterior.
9. Crear V01 para seguimiento 00, V02 para seguimiento 01, etc.
10. Generar el Anexo V desde el snapshot de ese seguimiento.

## W-17 — Exportaciones e histórico de cambios

1. Anexo VII: exportación anual desde PostgreSQL.
2. Listado simple: exportación completa o con filtros.
3. Importación 2025–2026: dry-run obligatorio por defecto.
4. Detectar códigos duplicados y campos críticos ausentes.
5. No inventar información que no exista en el listado.
6. Crear baseline HISTORICAL_STATE y continuar versionado exacto desde el último seguimiento conocido.

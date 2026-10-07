# Auditorías R3B — hallazgos, CAPA Plan y seguimiento

Base: main 27c82704831c3425d48c0bb229d77e4ede42623d, con R3A validado manualmente. Las reglas funcionales de GC-00/033/03 y GC-00/034/04 son las expresamente comunicadas por el usuario. Sus binarios y anexos oficiales no están instalados/verificados en este bloque; no se inventan reglas GMP ni plazos por criticidad.

## Persistencia y referencias

AuditFinding, AuditFindingAction, AuditFindingRelation y AuditFollowup son hijos con UUID persistentes. Editar y reordenar conserva identidad y referencia. El primer guardado asigna OBS 01… para hallazgos/observaciones y Rk 01… para recomendaciones. Todos los tipos de observación comparten la serie OBS; la serie Rk es independiente. Bloqueo de la fila Audit y constraint auditId/reference evitan colisiones. Se consideran retirados. Cambiar naturaleza no renumera una referencia ya asignada.

Naturaleza y criticidad son dimensiones independientes. No aplica permite información recibida sin clasificación y recomendaciones; se permiten excepciones explícitas, sin conversión silenciosa. Los escenarios sugieren el uso adecuado, sin prohibiciones documentales inventadas.

## Plan y estados

Varias acciones por hallazgo, editadas individualmente por UUID, responsable, fecha objetivo, estado, cierre, evidencia textual, referencia documental y comentario de verificación. Las fechas son DATE UTC. Cerrada requiere fecha y al menos evidencia, referencia o verificación; una fecha sola no cierra. No procede está disponible. No se crea un segundo módulo CAPA ni eficacia GMP local.

El estado del hallazgo se deriva de acciones activas: alguna Abierta/En curso → En curso; restantes pendientes de verificación → Pendiente de verificación; todas Cerradas/No procede → Tratado. Sin acciones: sin tratamiento → Pendiente de tratamiento; con tratamiento, se usa treatmentStatus (AuditActionStatus), permitiendo justificar No procede o tratamiento cerrado con fecha/evidencia. El tratamiento cerrado/no procede exige justificación. Las acciones retiradas no cuentan.

Situación de la auditoría: DRAFT → Borrador; CLOSED técnico → Cerrada; plan registrado en todos los hallazgos activos (tratamiento textual o acción activa) y alguna acción pendiente → Cierre parcial; otros hallazgos/seguimientos → En seguimiento; realizada sin éstos → Realizada · informe pendiente; resto → Planificada. Cierre parcial describe el plan local, no cierre definitivo, informe emitido ni eficacia. CLOSED continúa bloqueado por la validación R3A.

## Relaciones y atribución

Matriz ampliada exclusivamente con AUDIT GENERATES DEVIATION/CAPA. No existen filas inversas de creación. Los selectores de origen CAPA admiten Auditoría creando únicamente la dirección canónica. Solo se vinculan expedientes existentes, operativos y activos; el buscador compartido selecciona UUID, permite atribuir un destino ya vinculado a otro hallazgo y excluye los atribuidos al hallazgo actual. Cliente/autoridad sin código se buscan desde CAPA por objeto/referencia; su etiqueta no se convierte en código QMS.

Una QmsRelation por par; varias AuditFindingRelation únicas por findingId/qmsRelationId. Retirar atribución exige actor/motivo y conserva QmsRelation. Desvincular globalmente exige solicitud explícita y ausencia de atribuciones activas, incluidas las de hallazgos retirados. Retirar hallazgo no retira sus relaciones ni seguimientos. Revincular reactiva los mismos UUID. Los controles se aplican también en el servicio transversal y la sincronización de orígenes CAPA.

CAPA/Desviación muestran Auditoría y referencias atribuidas con enlace por UUID. Auditoría consulta estado actual y eficacia CAPA, incluido Anulado. No se crea automáticamente un vínculo directo para Auditoría → Desviación → CAPA. Los nuevos snapshots CAPA incorporan origen Auditoría y atribuciones; solo se refresca el vigente no congelado. Los snapshots anteriores y la forma serializada de orígenes Desviación/Reclamación permanecen intactos. Auditorías no crean versiones formales en R3B.

## Seguimiento y listado

Seguimiento general (findingId null) o del hallazgo propio. Timeline por followupDate, createdAt, UUID descendente; edición conserva identidad. Se permite conservar el hallazgo retirado al editar su seguimiento histórico. Anchors audit-finding/action/followup-UUID preparados para Review futuro, sin implementarlo.

Listado: agregados e hijos incluidos por lotes, sin N+1. Nuevas columnas opcionales y filtros SQL con/sin hallazgos, criticidad, acciones pendientes, Desviación/CAPA y rango de próxima revisión. Búsqueda SQL incluye referencia/descripción, acciones activas y códigos relacionados. Próxima revisión es el valor de la última entrada cronológica global del timeline; una entrada posterior sin próxima revisión la deja vacía. El filtro usa DISTINCT ON en SQL con esa misma regla. No crea vencimientos ni avisos automáticos.

Historial para alta/edición/retirada, criticidad/tratamiento, acciones/cierre/reapertura, relación/atribución y seguimiento. Reordenar únicamente no crea ruido en ChangeHistory. Retiradas lógicas exigen motivo; referencias reservadas.

## Despliegue y comprobación

Migración 20261007000200_audits_r3b sobre baseline + R3A; desde vacío se aplican las tres. BD con R3A migrado: backup habitual y pnpm db:deploy, pnpm db:generate. BD antigua creada con db push: consultar antes docs/AUDITS_R3A.md para adoptar la baseline; no resetear datos reales.

APP_ENV=test pnpm audits-r3b:smoke en BD aislada comprueba UUID, correlativos/concurrencia, estados/fechas/evidencia, relaciones/atribuciones, seguridad, inversa, snapshots, historial y filtros. APP_ENV=test R3B_UI_BASE_URL=http://127.0.0.1:3000 pnpm audits-r3b:ui:smoke comprueba formularios, conservación tras error, enlaces y responsive 1440/768/390. R3B_UI_CHROMIUM_PATH es opcional para Chromium local. Fixtures ficticios y limpieza limitada a sus propios registros. Los guardados y retiradas de hijos/atribuciones y la desvinculación global navegan al detalle dinámico una vez confirmado el resultado; las pruebas esperan la carga del cliente antes de continuar, sin recarga manual. La navegación de los demás módulos se conserva.

R3C pendiente: documentos/anexos/plantillas, informe oficial y snapshots por emisión/revisión, firmado/adjuntos, Review y política de eficacia/cierre definitivo. Plan Maestro anual y alertas automáticas quedan para bloques posteriores.

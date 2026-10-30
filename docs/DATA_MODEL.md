# Modelo de datos — arquitectura inicial

## Objetivo

Mantener integridad relacional, soportar multirrelaciones N:N, preservar históricos y permitir versionado.

## 1. Entidad común QMS

### QmsRecord

Representa la identidad común de cualquier expediente.

Campos conceptuales:
- `id UUID PK`;
- `recordType` (DEVIATION, CAPA, CHANGE_CONTROL, COMPLAINT, RETURN);
- `businessCode` nullable;
- `year`;
- `createdAt`;
- `updatedAt`;
- `isActive`.

La codificación visible no es la clave primaria. Cuando `businessCode` exista, la unicidad se controla por la combinación `recordType + businessCode`, no como texto global aislado. Esto evita colisiones entre módulos y permite mantener reglas de codificación independientes.

Cada entidad específica tendrá un `qmsRecordId` único y FK a QmsRecord.

Ventaja: QmsRelation puede usar claves foráneas reales sin relaciones polimórficas débiles basadas en texto + ID.

## 2. Relaciones N:N

### QmsRelation

Campos:
- `id UUID PK`;
- `sourceRecordId FK -> QmsRecord`;
- `targetRecordId FK -> QmsRecord`;
- `relationType`;
- `createdAt`;
- `createdByText` en V1;
- `notes` opcional;
- `isActive`.

Tipo de relación: `GENERATES`, único valor del enum `QmsRelationType`.
Los tipos conceptuales iniciales `RELATED_TO`, `IMPLEMENTED_BY` y
`ASSOCIATED_WITH` nunca se habilitaron y se retiraron del enum (D-083 MC-4,
migración `20261016000200_retire_unused_relation_types`). Un tipo nuevo
requiere decisión, regla en el contrato del módulo y migración propias.

Regla operativa vigente de 10.8C3-B1: solo se crea `GENERATES` para
Desviación → CAPA, Reclamación → CAPA y Reclamación → Devolución.

Las relaciones direccionales se almacenan una sola vez en una dirección canónica. La interfaz deriva la etiqueta inversa cuando proceda. Ejemplo: si `Desviación GENERATES CAPA`, desde la CAPA se muestra `ORIGINATES_FROM Desviación` sin crear una segunda fila.

Si en el futuro se aprueba un tipo de relación simétrica, normalizar el orden de los UUID antes de guardar para impedir duplicados invertidos.

No duplicar la misma relación exacta accidentalmente. Definir unicidad para `sourceRecordId + targetRecordId + relationType`; si una relación fue desactivada, reactivar la existente en lugar de insertar un duplicado.

Toda escritura operativa pasa por el servicio común de relaciones, que resuelve
ambos extremos contra `QmsRecord`, aplica la matriz direccional y utiliza la
clave única anterior de forma idempotente. Las consultas inversas se realizan
por `targetRecordId`; no generan una segunda fila.

## 3. Department

Catálogo controlado de departamentos/áreas.

Campos conceptuales:
- `id UUID PK`;
- `code`;
- `name`;
- `isActive`;
- `validFrom` opcional;
- `validTo` opcional.

No dispersar códigos/nombres organizativos como listas hardcodeadas por la aplicación.

## 4. Deviation

Relación 1:1 con QmsRecord.

### Identificación
- id UUID PK;
- qmsRecordId UUID unique;
- departmentId FK -> Department;
- departmentCodeSnapshot;
- departmentNameSnapshot;
- issueDate;
- eventDateTime;
- detectedBy;
- shift: turno del evento, texto libre opcional (D-116);
- formVersionId;
- anexoIIITemplateVersionId.

El `departmentId` permite filtrar y mantener catálogo; los snapshots conservan cómo constaba el departamento en el momento del expediente aunque el catálogo cambie en el futuro.

### Origen
Campos tipados para:
- processEquipmentSystem;
- finishedProductSystem;
- productLot;
- lotSize;
- affectedQuantity;
- client;
- rawOrPackagingMaterial;
- materialLot;
- materialLotSize;
- materialAffectedQuantity;
- supplier;
- supplierLot;
- affectedEquipmentLine;
- otherOrigin;
- affectedDocumentation.

### Descripción
- whatHappened;
- whoInvolved;
- whenHappened;
- whereHappened;
- howHappened.

### Investigación
- investigation;
- investigationConclusive enum YES/NO/NA;
- methodology flags/relación de catálogo;
- rootCause;
- recurrentRootCause enum YES/NO/NA;
- recurrenceDetails.

### Clasificación e impacto
- classification CRITICAL/MAJOR/MINOR;
- validationImpact YES/NO/NA;
- registrationImpact YES/NO/NA;
- stabilityImpact YES/NO/NA;
- otherProcessesImpact YES/NO/NA;
- otherProcessesImpactDetails;
- affectsFinishedProduct YES/NO/NA cuando sea necesario para seguimiento/KPI.

### CAPA
- capaRequired boolean/nullable.

### Cierre
- conclusion;
- disposition;
- dispositionQuantity;
- dispositionComments;
- clientNotification YES/NO/NA;
- closedAt;
- status OPEN/CLOSED.

### Gestión
- internalObservations;
- signedDocumentAvailable nullable;
- dataQualityStatus COMPLETE/INCOMPLETE/REVIEW_REQUIRED;
- extraData JSONB opcional para extensiones futuras no críticas.

Los campos oficiales definitivos se ajustarán contra la plantilla vigente antes de implementar la migración de producción.

## 5. DeviationImmediateAction

1:N desde Deviation:
- id;
- deviationId;
- description;
- executedBy;
- executedAt;
- sortOrder.

## 6. DeviationFollowup

1:N:
- id;
- deviationId;
- followupDate;
- completedByText;
- followupType;
- comment;
- nextFollowupDate;
- evidenceReference;
- createdAt.

## 7. DeviationCapaPlan

1:N:
- id;
- deviationId;
- actionType CORRECTIVE/PREVENTIVE;
- description;
- plannedExecutionDate;
- responsible;
- businessCapaCode nullable;
- linkedCapaRecordId nullable;
- proposalStatus PROPOSED/REGISTERED/CANCELLED.

No sustituye al expediente CAPA real.

## 8. Capa

Se crea en Hito 6, pero su identidad QmsRecord se reserva desde el modelo inicial.

Conceptualmente:
- código;
- tipo;
- descripción del defecto;
- causa raíz;
- acción propuesta;
- responsable;
- fecha prevista;
- estado;
- fecha ejecución/cierre;
- eficacia;
- conclusión.

Seguimientos y eficacia se modelan como entidades propias cuando se implemente el módulo.

## 9. Historial

### ChangeHistory

- id;
- qmsRecordId FK;
- changedAt;
- changedByText;
- fieldPath;
- oldValue JSONB/text;
- newValue JSONB/text;
- reason nullable;
- source (UI/IMPORT/SYSTEM).

V1: historial interno. No afirmar cumplimiento de audit trail.

## 10. Documentos generados

### GeneratedDocument

- id;
- qmsRecordId;
- documentType;
- templateVersionId;
- generatedAt;
- generatedByText;
- optionalChecksum;
- optionalMetadata JSONB.

No es obligatorio almacenar permanentemente el binario en V1.

## 11. Versiones

### FormVersion
- id;
- module;
- versionCode;
- effectiveFrom;
- effectiveTo nullable;
- isActive;
- notes.

### TemplateVersion
- id;
- module;
- documentType;
- versionCode;
- filePath/config reference;
- effectiveFrom;
- effectiveTo;
- isActive;
- checksum opcional.

## 12. Catálogos

Catálogos iniciales:
- Department;
- Origin;
- FollowupType;
- RelationType si no se implementa como enum;
- otros definidos por módulo.

No codificar listas organizativas dispersas en componentes.

## 13. Cálculos derivados

No persistir salvo necesidad:
- días de cierre;
- año/mes derivados;
- con CAPA;
- cierre en plazo;
- métricas KPI.

Calcular desde datos base o materializar únicamente por rendimiento con una estrategia explícita.

Los plazos regulados no deben codificarse hasta confirmar la fuente vigente; deben quedar configurables.


## 14. Versiones funcionales de expediente

### QmsRecordVersion
Entidad transversal asociada a `QmsRecord`.

Campos:
- `id UUID PK`;
- `qmsRecordId FK`;
- `sequenceNumber` (00, 01, 02...);
- `kind`: INITIAL, REOPENING, FOLLOWUP o HISTORICAL_STATE;
- `snapshot JSONB` con el estado estructurado completo de la versión;
- `reason`;
- `sourceEntityId` para vincular, por ejemplo, la versión CAPA con el seguimiento que la originó;
- `createdByText`;
- `source`;
- `frozenAt`.

Unicidad: `qmsRecordId + sequenceNumber`.

La versión vigente puede actualizar su snapshot mientras no exista un evento que deba crear nueva versión. Al crear la siguiente versión, la anterior se congela.

### GeneratedDocument
Puede referenciar opcionalmente `recordVersionId`. Esto permite volver a generar o identificar el documento correspondiente a una versión concreta del expediente.

### Históricos previos al Hito 6.1
No se infiere un estado histórico que no exista en la fuente. Para registros ya presentes se crea un `HISTORICAL_STATE` con la última secuencia conocida cuando sea posible. Los huecos anteriores permanecen sin snapshot en lugar de inventarse.


## 15. Controles de Cambios

### ChangeControl
Un expediente por Control de Cambio, enlazado 1:1 con `QmsRecord`.

Agrupa:
- Solicitud (Anexo III);
- Dictamen (Anexo IV);
- estado de ejecución;
- comprobación de eficacia;
- cierre efectivo;
- referencias a versiones de formulario y plantillas III/IV/V.

### ChangeControlTask
Acciones del plan:
- departamento dinámico;
- descripción;
- responsable;
- fecha prevista;
- `origin = DICTAMEN | FOLLOWUP`;
- `introducedInFollowup` para identificar tareas nuevas detectadas durante un seguimiento.

Las tareas del Dictamen constituyen la línea base aprobada y no se sustituyen después de su aprobación.

### ChangeControlFollowup
Seguimientos formales 00, 01, 02...:
- fecha;
- responsable;
- ejecución y fecha;
- eficacia;
- próxima fecha;
- motivo para permanecer abierto;
- conclusión/cierre;
- aprobación.

### ChangeControlTaskState
Snapshot del estado de cada tarea en cada seguimiento:
- pendiente/completada/no aplica;
- fecha real;
- evidencia/comentario.

Cada seguimiento genera además una `QmsRecordVersion` con el mismo número.


## 16. Reclamaciones

### Complaint
Entidad 1:1 con QmsRecord.
Campos tipados para:
- reclamación a proveedor o de cliente;
- identificación del afectado/producto/lote;
- investigación, impacto y causa raíz;
- clasificación Crítica/Mayor/Menor/Sin impacto GMP;
- líneas de resolución e implicaciones;
- comunicación externa;
- respuesta;
- verificación de eficacia;
- cierre.

### ComplaintCapaPlan
Propuestas CAPA 1:N equivalentes al patrón de Desviaciones. Una propuesta puede convertirse en expediente CAPA real y queda vinculada mediante FK/QmsRelation.

### ComplaintFollowup
Seguimientos operativos 1:N, con fecha, responsable, comentario, próxima fecha y evidencia.

## 17. Devoluciones

### ReturnRecord
Entidad 1:1 con QmsRecord para la devolución completa.

### ReturnProduct
Productos 1:N:
- tipo;
- producto/código;
- formato;
- lote;
- caducidad/reanálisis;
- cantidad/unidad;
- pesos;
- recepción/verificación.

### Evaluación
Los criterios SI/NO/N.A. del Anexo III se almacenan como TriState tipado, incluyendo reintegración a stock y condiciones específicas de termolábiles.

### ReturnFollowup
Seguimientos operativos 1:N.

Reclamaciones y Devoluciones son expedientes independientes. Su relación se implementa mediante QmsRelation; una devolución no es un subtipo de reclamación.


## 18. Administración funcional

### LookupCatalog / LookupCatalogItem
Catálogos auxiliares administrables con:
- clave estable;
- etiqueta;
- módulo opcional;
- vigencia;
- estado activo/inactivo;
- orden;
- notas.

No sustituyen enums GMP estructurales.

### AppParameter
Parámetros no estructurales por ámbito y clave, con tipo TEXT/INTEGER/BOOLEAN/JSON.

### AlertRule
Reglas de preaviso por módulo:
- FOLLOWUP_DUE;
- EFFECTIVENESS_PENDING;
- PLANNED_EXECUTION_DUE.

Cada regla dispone de días de preaviso, severidad y estado.

### ConfigurationChange
Historial operativo de cambios administrativos:
- entidad;
- clave;
- acción;
- valor anterior/nuevo;
- usuario;
- motivo;
- fecha.

No se presenta como audit trail GMP validado.

### TemplateVersion · almacenamiento
Además de metadatos, una plantilla puede conservar:
- fileName;
- mimeType;
- fileData;
- fileSize;
- checksum SHA-256.

Los binarios no se cargan en consultas de administración salvo cuando el generador solicita expresamente una versión documental.

## 19. Revisión transversal

### ReviewThread
Hilo persistente asociado directamente a `QmsRecord` y, opcionalmente, a la `QmsRecordVersion` sobre la que se realizó la revisión.

El objetivo se identifica mediante:
- `targetKind`: expediente, sección, campo o elemento dinámico;
- `tabKey`, `sectionKey` y `fieldPath` para ubicación lógica;
- `targetEntityType` y `targetEntityId` para elementos dinámicos con identidad estable;
- `fieldLabelSnapshot` y `valueSnapshot` como fotografía inmutable de lo visto por el revisor.

El estado conserva por separado creación, aceptación y resolución, con sus autores y fechas. `recordVersionId` puede ser nulo, en particular cuando el módulo no expone versiones funcionales al usuario.

### ReviewMessage
Conversación 1:N del hilo. El comentario inicial es el primer `ReviewMessage`; no se duplica dentro de `ReviewThread`. No existe borrado funcional ni Server Action de eliminación.

Las operaciones transversales crean eventos ligeros en `ChangeHistory` para alta, aceptación y resolución. La conversación completa permanece en `ReviewMessage` y el historial sigue siendo operativo, no un audit trail GMP validado.


## Auditorías R3A

`Audit` se asocia 1:1 a `QmsRecord` de tipo AUDIT. Tipo y escenario nullable para borradores incompletos. Estados técnicos DRAFT/OPEN/CLOSED; cierre no disponible en R3A. `AuditDepartment` y `AuditParticipant` tienen UUID, FK Restrict y retirada lógica. La asociación auditId/departmentId es única y se reactiva con el mismo UUID. Department conserva snapshots. codingDepartmentId es una de las áreas internas auditadas; no limita el alcance. Tipo, escenario y dimensión de codificación se fijan al abrir. Índices por estado/tipo y fecha prevista, fecha realizada, escenario y orden de participantes. No hay AuditFinding, versiones, documentos, Review ni Plan Maestro.

## Auditorías R3B

AuditFinding: UUID, FK Audit, referencia única por auditoría, naturaleza AuditFindingType, criticidad AuditFindingCriticality, contenido/criterio/evidencia, tratamiento y AuditActionStatus para tratamiento sin acciones, cierre DATE, orden y retirada con autor/motivo/fecha. AuditFindingAction: UUID y FK hallazgo, múltiples acciones con responsable, objetivo/cierre DATE, AuditActionStatus, evidencia/referencia/verificación y retirada lógica. AuditFollowup: UUID, Audit y hallazgo opcional propio, fechas DATE, responsable, descripción, próxima revisión/evidencia. AuditFindingRelation: UUID y FKs reales a hallazgo/QmsRelation, unicidad del par, activación/retirada trazable. Detalle e índices en schema y docs/AUDITS_R3B.md. No se modifica estructura base R3A ni se añaden versiones de informe.

AuditCapaPlanVersion (D-110, R5C1): versiones propias del CAPA plan.
- **Identidad y secuencia:** UUID, FK Audit, secuencia 00, 01… única por auditoría, tipo `ESTABLISHED` / `FOLLOWUP`.
- **Datos del seguimiento:** fecha, observaciones y próxima revisión.
- **Idempotencia:** `requestId` y `requestHash`, únicos por auditoría.
- **Contenido congelado:**
  - huella del contenido;
  - foto JSON;
  - plantilla A4.03 con su checksum;
  - archivo XLSX con su checksum;
  - autoría (`generatedBy` y usuario autenticado).
- **Protección:** un trigger impide modificarla o borrarla; captura B2 sin copiar el binario.

## Auditorías R3C

Campos mínimos Audit de informe/conclusión/programa/firmas manuales, Plan externo, fechas de hechos parciales/respuestas y decisión QA/excepción proveedor. AuditFindingAction reutiliza CapaEffectivenessStatus para verificación local más verifiedAt/verifiedBy. GeneratedDocument incorpora bytes opcionales, nombre/MIME; tipos AUDIT_INTERNAL_REPORT, AUDIT_EXTERNAL_REPORT, AUDIT_CAPA_PLAN, AUDIT_EXTERNAL_PLAN y recibido/respuesta/evidencia. No se añaden modelos.

QmsRecordVersion INITIAL/AUDIT_REVISION con snapshot completo congelado; TemplateVersion UUID/hash en snapshot y documento. RecordVersionDocument SIGNED_PDF reutilizado. ReviewThread versionId/targets persistentes sin duplicar infraestructura. Migración aditiva 20261007000300_audits_r3c sobre R3B; detalles y compatibilidad en AUDITS_R3C.md.


## Devoluciones R4B

R4B no cambia Prisma ni añade migraciones: ReturnFollowup y QmsRecordVersion técnico único existentes. extraData.r4b guarda aplicabilidad/destino contextual y conserva otras claves legacy. ReturnProduct conserva UUID al editar/reordenar. GeneratedDocument archiva binarios/checksum y snapshot inmutable para Return; PDF sustituidos también se archivan. Véase RETURNS_R4B.md.

## Audit Trail técnico 4B3-B1

La migración aditiva `20261013000100_audit_engine_b1` añade AuditOperation, AuditOperationTarget y AuditEvent, cursor por raíz AuditAggregateCursor, lease privada AuditRuntimeContext y fixture AuditPilotRecord. Raíces TEXT mediante FKs reales a QmsRecord/ControlledDocument/AuditAnnualPlan; actor AuthUser y operaciones UUID. Eventos tipados, secuencia BIGINT y correlación operación/raíz; referencias opcionales a versiones/documentos con integridad SQL. No se reconstruye historial previo ni se altera ChangeHistory/snapshots/documentos. Captura activa exclusivamente para el piloto sintético aislado, sin política GMP global. Contrato, privilegios, recuperación y límites en [PHASE_4B3_B1.md](PHASE_4B3_B1.md).

## Preparación del requisito 4B3-B2

`AuditPolicyRequirement` registra un requisito técnico durable, con versión fija, referencia, principal SQL y hora de PostgreSQL. La migración `20261013000200_b2_audit_requirement` instala estructura y guardas, sin filas ni activación/aprobación. El rol operativo no puede registrar ni retirar el requisito. Si se registra, se deniegan escrituras mientras no exista la política B2 completa. Es un control de preparación, no evidencia de captura OLD/NEW de los siete módulos; integración y custodia completas pendientes en [PHASE_4B3_B2.md](PHASE_4B3_B2.md).

La migración aditiva `20261013000300_b2_sql_capture` añade la fundación de captura, probada únicamente en bases efímeras: AuditBusinessContext/AuditMutationWitness/AuditRootBinding privados y transitorios; políticas de tablas/campos inmutables; AuditAdministrationRoot con FK/check excluyente del cursor; AuditEventAdditionalTarget para correlacionar un evento con ambas raíces y AuditOperationEvidence con cinco FKs específicas a historiales existentes. No duplica snapshots ni binarios. AuditOperation admite motivo NULL según D03, schemaVersion2 en B2 y conserva módulo/permiso de la operación para revalidar retries; B1 mantiene schemaVersion1 y validación propia. Captura SQL probada no implica que todos los writers estén integrados ni que exista activación corporativa; custodia D05 e integración de los siete módulos pendientes.

## Responsable como usuario de la aplicación (D-101)

La migración aditiva `20261018000300_responsible_users` añade una columna UUID opcional con FK a `AuthUser` (ON DELETE RESTRICT) e índice junto a cada responsable en texto libre: `DeviationImmediateAction.executedByUserId`, `DeviationCapaPlan.responsibleUserId`, `CapaPlannedAction.responsibleUserId`, `ChangeControl.requestDecisionResponsibleUserId`, `ChangeControl.followupResponsibleUserId`, `ChangeControlTask.responsibleUserId`, `ChangeControlFollowup.responsibleUserId`, `ComplaintCapaPlan.responsibleUserId`, `ComplaintDerivedAction.responsibleUserId` y `AuditFindingAction.responsibleUserId`. El texto libre no cambia y sigue siendo lo que se imprime. Las columnas se añaden a la política de captura B2 (contrato `B2_RESPONSIBLE_USERS`).

## Responsables de PNT por función y de la revisión periódica (D-118)

La migración aditiva `20261027000100_pnt_assignments` añade columnas opcionales, sin valores por defecto:

- `ControlledDocument`: `periodicReviewResponsible` (texto) y `periodicReviewResponsibleUserId` (UUID, FK a `AuthUser`).
- `ControlledDocumentRevision`: para cada función (`preparation` = Elabora, `review` = Revisa, `approval` = Aprueba), `…Responsible` (texto), `…ResponsibleUserId` (UUID, FK a `AuthUser`) y `…TargetDate` (DATE).

Las FK son ON DELETE RESTRICT, con índice por cada usuario. Las 11 columnas se añaden a la política de captura B2 (contrato `B2_PNT_ASSIGNMENTS`). No registran quién elaboró, revisó o aprobó el documento aprobado ni cambian el estado de la revisión.

## Modelos de Control de cambios (D-122)

La migración `20261029000100_change_control_models` añade `ChangeControlModel`, configuración que solo prerrellena el alta de un Control de cambios:
- `name`, `purpose`, `isActive`;
- `departmentId` (FK opcional a `Department`), `scope` (`ChangeControlScope[]`), `otherScope`;
- `changeDescription`, `justification`, `providedDocuments`;
- `tasks` (JSONB, lista de textos);
- `version` (sube con cada cambio), `createdByText`, `updatedByText`.

Tiene las mismas guardas y captura B2 que `AlertRule` (raíz de administración/configuración). Cada alta o cambio deja una fila de `ConfigurationChange` con `entityType = ChangeControlModel` y `entityKey` = id del modelo. No hay FK desde `ChangeControl`: el historial de alta guarda el nombre y la versión del modelo usado.

## Herramientas de investigación de Desviaciones (D-123)

La migración `20261029000200_deviation_investigation_tools` añade `Deviation.investigationTools` (JSONB, opcional; un CHECK exige objeto). Contiene:
- `fiveWhys`: `{ problem, whys[≤5], status }` o `null`;
- `causes[≤60]`: `{ method: ISHIKAWA|BRAINSTORMING, category: 6M|null, text, evidence, status }`;
- `fta` (D-124): `{ top, nodes[≤60] }` o `null`; cada nodo `{ depth: 1..4, text, evidence, status, gate: OR|AND }` en orden de esquema (cada nodo cuelga del anterior de un nivel menos).

`status` es `HYPOTHESIS`, `DISCARDED` o `CONFIRMED`. Sin contenido se guarda `null`.

Se valida en servidor (`src/modules/deviations/investigation-tools.ts`), entra en la versión del expediente y la captura B2 lo registra como JSON no crítico. Desde D-124 se imprime como texto en la casilla de causa raíz del Anexo III, debajo de la causa raíz.

## Tablas de los textos largos (D-127)

La migración `20261030000100_deviation_text_tables` añade `Deviation.textTables` (JSONB, opcional; un CHECK exige objeto). Es un objeto por campo de texto largo (`investigation`, `rootCause`, `otherProcessesImpactDetails`…) con una lista de tablas `{ title, columns[1..8], rows[≤50][columns] }`, todo texto (≤500 caracteres por celda, ≤10 tablas por campo). Sin tablas se guarda `null`.

Se valida en servidor (`src/lib/forms/text-tables.ts`), entra en la versión del expediente y la captura B2 lo registra como JSON no crítico (contrato `B2_DEVIATION_TEXT_TABLES`). Las tablas se numeran en el orden de los apartados (`src/modules/deviations/text-tables.ts`) y se escriben en el Anexo III como tablas de Word dentro de la casilla de su apartado. Los demás módulos tendrán su propia columna en PR posteriores.


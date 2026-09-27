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

Tipos conceptuales iniciales:
- GENERATES;
- RELATED_TO;
- IMPLEMENTED_BY;
- ASSOCIATED_WITH.

Las relaciones direccionales se almacenan una sola vez en una dirección canónica. La interfaz deriva la etiqueta inversa cuando proceda. Ejemplo: si `Desviación GENERATES CAPA`, desde la CAPA se muestra `ORIGINATES_FROM Desviación` sin crear una segunda fila.

Para relaciones simétricas como RELATED_TO, normalizar el orden de los UUID antes de guardar para impedir duplicados invertidos.

No duplicar la misma relación exacta accidentalmente. Definir unicidad para `sourceRecordId + targetRecordId + relationType`; si una relación fue desactivada, reactivar la existente en lugar de insertar un duplicado.

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

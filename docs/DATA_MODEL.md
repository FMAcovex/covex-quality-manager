# Modelo de datos — arquitectura inicial

## Objetivo

Mantener integridad relacional, soportar multirrelaciones N:N, preservar históricos y permitir versionado.

## 1. Entidad común QMS

### QmsRecord

Representa la identidad común de cualquier expediente.

Campos conceptuales:
- `id UUID PK`;
- `recordType` (DEVIATION, CAPA, CHANGE_CONTROL, COMPLAINT, RETURN);
- `businessCode` nullable/unique según reglas de módulo;
- `year`;
- `createdAt`;
- `updatedAt`;
- `isActive`.

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

Ejemplos de relationType:
- GENERATES;
- ORIGINATES_FROM;
- RELATED_TO;
- IMPLEMENTED_BY;
- ASSOCIATED_WITH.

No duplicar la misma relación exacta accidentalmente. Definir restricción/validación para source + target + relationType activos.

La interfaz puede mostrar la relación en ambos sentidos aunque se almacene una sola fila.

## 3. Deviation

Relación 1:1 con QmsRecord.

### Identificación
- id UUID PK;
- qmsRecordId UUID unique;
- departmentCode;
- departmentName;
- issueDate;
- eventDateTime;
- detectedBy;
- formVersionId;
- templateVersionId.

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

## 4. DeviationImmediateAction

1:N desde Deviation:
- id;
- deviationId;
- description;
- executedBy;
- executedAt;
- sortOrder.

## 5. DeviationFollowup

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

## 6. DeviationCapaPlan

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

## 7. Capa

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

## 8. Historial

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

## 9. Documentos generados

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

## 10. Versiones

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

## 11. Catálogos

Catálogos iniciales:
- Department;
- Origin;
- FollowupType;
- RelationType si no se implementa como enum;
- otros definidos por módulo.

No codificar listas organizativas dispersas en componentes.

## 12. Cálculos derivados

No persistir salvo necesidad:
- días de cierre;
- año/mes derivados;
- con CAPA;
- cierre en plazo;
- métricas KPI.

Calcular desde datos base o materializar únicamente por rendimiento con una estrategia explícita.

Los plazos regulados no deben codificarse hasta confirmar la fuente vigente; deben quedar configurables.

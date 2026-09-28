export type ReturnFormState={error:string|null;fieldErrors?:string[]};
export type ReturnProductInput={
  id?:string; departmentId:string; productType:"API"|"INTERMEDIATE"|"MEDICINE"|"SUPPLEMENT"|"IMPORTED_PRODUCT"|"MEDICAL_DEVICE"|"COSMETIC"|"OTHER";
  otherProductType:string; productNameCode:string; format:string; lot:string; expiryReanalysis:string; quantity:string; unit:string;
  netWeight:string; grossWeight:string; receptionObservations:string; receivedBy:string; receivedByDate:string; verifiedBy:string; verifiedByDate:string;
};
export type ReturnFormDefaults={
  businessCode?:string;departmentId?:string;communicationDate?:string;receivedAt?:string;createdByText?:string;
  returnType?:"COMMERCIAL"|"COMPLAINT"|"RECALL"|"EXPIRY"|"TRANSPORT"|"OTHER";otherReturnType?:string;customerEntity?:string;country?:string;
  address?:string;relatedDocument?:string;conservationConditions?:string;deliveryNote?:string;reasonObservations?:string;
  attachedDocumentation?:string;withinAcceptedReturnPeriod?:string;roomTemperatureWithinTenDays?:string;coldChainWithinFortyEightHours?:string;
  uniqueIdentifierActive?:string;tamperEvidenceIntact?:string;packagingIntegrityOk?:string;customerDeclarationAvailable?:string;
  customerDeclarationSignatoryName?:string;customerDeclarationSignatoryRole?:string;customerDeclarationSignedAt?:string;customerDeclarationObservations?:string;
  storageTransportConditionsOk?:string;noUseDamageContamination?:string;noRecallAlertBlock?:string;expiryAcceptable?:string;
  qcAssessmentCompleted?:string;storageTemperatureRecord?:string;returnTransportTempEvidence?:string;transportPackagingSuitable?:string;
  receiptTemperatureAcceptable?:string;temperatureExcursionEvaluated?:string;coldChainReturnSystemValidated?:string;
  decision?:"PENDING"|"ACCEPTED"|"REJECTED";finalDestination?:string;decisionObservations?:string;qaApprovalName?:string;
  technicalApprovalName?:string;decisionDate?:string;destructionManagedBy?:string;destructionCertificate?:string;traceabilityUpdated?:string;
  closedAt?:string;status?:"OPEN"|"CLOSED";internalObservations?:string;signedDocumentAvailable?:string;
  dataQualityStatus?:"COMPLETE"|"INCOMPLETE"|"REVIEW_REQUIRED";products?:ReturnProductInput[];
};
export type DepartmentOption={id:string;code:string;name:string};

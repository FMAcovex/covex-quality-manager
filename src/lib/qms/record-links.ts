export type RelatedQmsRecord = {
  id: string;
  recordType: string;
  businessCode: string | null;
};

export type QmsRelationCarrier = {
  sourceRelations?: Array<{ targetRecord: RelatedQmsRecord }>;
  targetRelations?: Array<{ sourceRecord: RelatedQmsRecord }>;
};

export function qmsRecordHref(record: RelatedQmsRecord) {
  switch (record.recordType) {
    case "DEVIATION":
      return `/deviations/${record.id}`;
    case "CAPA":
      return `/capa/${record.id}`;
    case "CHANGE_CONTROL":
      return `/changes/${record.id}`;
    case "COMPLAINT":
      return `/complaints/${record.id}`;
    case "RETURN":
      return `/returns/${record.id}`;
    default:
      return null;
  }
}

export function qmsRecordTypeLabel(recordType: string) {
  switch (recordType) {
    case "DEVIATION":
      return "Desviación";
    case "CAPA":
      return "CAPA";
    case "CHANGE_CONTROL":
      return "Control de cambio";
    case "COMPLAINT":
      return "Reclamación";
    case "RETURN":
      return "Devolución";
    default:
      return recordType;
  }
}

export function collectRelatedRecords(carrier: QmsRelationCarrier): RelatedQmsRecord[] {
  const records = [
    ...(carrier.sourceRelations ?? []).map((relation) => relation.targetRecord),
    ...(carrier.targetRelations ?? []).map((relation) => relation.sourceRecord),
  ];
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

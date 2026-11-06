/**
 * D-133: código de un expediente relacionado tal como se imprime en un anexo. Un anulado conserva
 * su código histórico, que ya puede tener otro expediente: se marca «(anulado)» para no confundirlos.
 */
export function documentRecordCode(record: { businessCode?: string | null; annulledBusinessCode?: string | null }) {
  if (record.businessCode) return record.businessCode;
  return record.annulledBusinessCode ? `${record.annulledBusinessCode} (anulado)` : null;
}

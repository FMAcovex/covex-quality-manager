/**
 * Versión del Anexo IV de una reclamación cuando no tiene plantilla asignada: la del Anexo III (mismo PNT) o «03».
 * La usan la generación y la ficha (TPL1), para que la ficha compruebe la misma plantilla que se usará.
 */
export function complaintAnnexIVDefaultVersion(r: { annexIIITemplateVersion?: { versionCode: string } | null }) {
  return r.annexIIITemplateVersion?.versionCode ?? "03";
}

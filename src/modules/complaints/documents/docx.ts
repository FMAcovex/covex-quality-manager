import { DocumentType } from "@prisma/client";
import { getZipEntryText, readZip, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import { replaceWordRowWithCopies, setWordCellTextBalanced } from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { ComplaintTemplateUnavailableError, loadComplaintTemplate } from "@/modules/complaints/documents/templates";

type Capa = {
  actionType: string;
  description: string;
  plannedExecutionDate: Date | null;
  responsible: string | null;
  businessCapaCode?: string | null;
  linkedCapaRecord?: { businessCode: string | null } | null;
};
type Followup = {
  followupDate: Date;
  comment: string;
  nextFollowupDate: Date | null;
  evidenceReference: string | null;
};

export type ComplaintDocumentRecord = {
  qmsRecord: { businessCode: string | null };
  openedAt: Date | null;
  detectionDate: Date | null;
  receptionDate: Date | null;
  detectedBy: string | null;
  complaintType: string;
  triggerSources: string[];
  triggerOther: string | null;
  partyName: string | null;
  contact: string | null;
  scopeCategories: string[];
  scopeOther: string | null;
  affectedObjectTypes: string[];
  affectedObjectOther: string | null;
  affectedScope: string | null;
  reference: string | null;
  lotReference: string | null;
  quantity: string | null;
  expiryReanalysis: string | null;
  purchaseDeliveryReference: string | null;
  complaintCategories: string[];
  complaintCategoryOther: string | null;
  description: string | null;
  recurrent: boolean | null;
  recurrenceReference: string | null;
  attachedDocumentation: string | null;
  emittedBy: string | null;
  qaValidatedBy: string | null;
  qualityGmpImpact: string | null;
  safetyEfficacyImpact: string | null;
  regulatoryComplianceImpact: string | null;
  environmentImpact: string | null;
  similarSituationsImpact: string | null;
  containmentActions: string[];
  containmentOther: string | null;
  riskJustification: string | null;
  investigation: string | null;
  impactAssessment: string | null;
  investigationResult: string | null;
  rootCause: string | null;
  classification: string | null;
  withdrawalPotential: string | null;
  recallProcedureRequired: string | null;
  authorityNotification: string | null;
  responsiblePartyCommunication: string | null;
  regulatoryJustification: string | null;
  resolutionLines: string | null;
  resolutionActions: string[];
  immediateActionDetails: string | null;
  otherResolutionDetails: string | null;
  externalCommunicationDate: Date | null;
  externalCommunicationMedium: string | null;
  externalCommunicationParties: string | null;
  externalCommunication: string | null;
  continueToPartII: boolean | null;
  conclusion: string | null;
  effectivenessRequired: boolean | null;
  approvalNames: string | null;
  responseDate: Date | null;
  responseMedium: string | null;
  responseSummary: string | null;
  responseSufficient: boolean | null;
  followupActionStatus: string | null;
  followupReferences: string | null;
  effectivenessStatus: string;
  effectivenessAssessment: string | null;
  closeConclusion: string | null;
  closeApprovalNames: string | null;
  closedAt: Date | null;
  status: string;
  internalObservations: string | null;
  capaPlans: Capa[];
  followups: Followup[];
  annexIIITemplateVersion?: { versionCode: string } | null;
  annexVTemplateVersion?: { versionCode: string } | null;
};

const date = (v: Date | null | undefined) => v ? new Intl.DateTimeFormat("es-ES").format(v) : "";
const text = (v: string | null | undefined) => v ?? "";
const box = (on: boolean, label: string) => `${on ? "☒" : "☐"} ${label}`;
const tri = (value: string | null, label = "") =>
  [box(value === "YES", `Sí${label ? ` · ${label}` : ""}`), box(value === "NO", "No"), box(value === "NA", "N/A")].join("   ");

function checks(values: string[], options: Array<[string, string]>, other?: string | null) {
  const selected = new Set(values);
  const lines = options.map(([key, label]) => box(selected.has(key), label));
  if (other !== undefined) lines.push(`${box(Boolean(other), "Otro")}${other ? `: ${other}` : ""}`);
  return lines.join("   ");
}

function classification(v: string | null) {
  return [
    box(v === "CRITICAL", "Crítica"),
    box(v === "MAJOR", "Mayor"),
    box(v === "MINOR", "Menor"),
    box(v === "NO_GMP_IMPACT", "Sin impacto GMP"),
  ].join("\n");
}

function derivedActions(r: ComplaintDocumentRecord) {
  const s = new Set(r.resolutionActions);
  return [
    box(s.has("RETURN"), "DEVOLUCIÓN"),
    box(s.has("CORRECTIVE_ACTION"), "ACC. CORRECTORA"),
    box(s.has("PREVENTIVE_ACTION"), "ACC. PREVENTIVA"),
    box(s.has("IMMEDIATE_ACTION"), `ACC. INMEDIATA${r.immediateActionDetails ? `: ${r.immediateActionDetails}` : ""}`),
    box(s.has("RECALL"), "RETIRADA DEL MERCADO"),
    box(s.has("CREDIT"), "ABONO"),
    box(s.has("REPLACEMENT"), "REPOSICIÓN"),
    box(s.has("OTHER"), `OTROS${r.otherResolutionDetails ? `: ${r.otherResolutionDetails}` : ""}`),
  ].join("\n");
}

export async function generateComplaintAnnexIII(r: ComplaintDocumentRecord) {
  const version = r.annexIIITemplateVersion?.versionCode ?? "03";
  const entries = readZip(await loadComplaintTemplate(DocumentType.COMPLAINT_ANNEX_III, version));
  let xml = getZipEntryText(entries, "word/document.xml");

  xml = setWordCellTextBalanced(xml, 0, 1, 1, text(r.qmsRecord.businessCode));
  xml = setWordCellTextBalanced(xml, 0, 1, 3, date(r.openedAt));
  xml = setWordCellTextBalanced(xml, 0, 1, 4, version);

  xml = setWordCellTextBalanced(xml, 1, 1, 1, date(r.detectionDate));
  xml = setWordCellTextBalanced(xml, 1, 1, 3, date(r.receptionDate));
  xml = setWordCellTextBalanced(xml, 1, 2, 1, box(r.complaintType === "PROVIDER", "A PROVEEDOR / SUBCONTRATA"));
  xml = setWordCellTextBalanced(xml, 1, 2, 2, box(r.complaintType === "CUSTOMER", "DE CLIENTE / AGENTE EXTERNO"));
  xml = setWordCellTextBalanced(xml, 1, 3, 1, checks(r.triggerSources, [
    ["CLIENT","Cliente"],["DISTRIBUTOR","Distribuidor"],["MAH","Titular / MAH"],["CONSUMER","Consumidor / usuario"],
    ["AUTHORITY","Autoridad / entidad sanitaria"],["SUPPLIER","Proveedor"],["LOGISTICS","Transportista / operador logístico"],
    ["SUBCONTRACTOR","Subcontrata"],["INTERNAL","Detección interna"],["RECALL","Retirada"],
  ], r.triggerOther));
  xml = setWordCellTextBalanced(xml, 1, 4, 1, text(r.triggerOther || r.partyName));
  xml = setWordCellTextBalanced(xml, 1, 5, 1, text(r.contact));
  xml = setWordCellTextBalanced(xml, 1, 6, 1, checks(r.scopeCategories, [
    ["MEDICINE","Medicamento"],["API","API"],["SUPPLEMENT","Complemento alimenticio"],["COSMETIC","Cosmética"],
    ["MEDICAL_DEVICE","Producto sanitario"],["ENVIRONMENT","Medio ambiente"],
  ], r.scopeOther));
  xml = setWordCellTextBalanced(xml, 1, 7, 1, checks(r.affectedObjectTypes, [
    ["PRODUCT","Producto / material"],["SERVICE","Servicio"],["EQUIPMENT","Equipo / sistema"],
    ["TRANSPORT","Transporte"],["SUBCONTRACTED","Actividad subcontratada"],
  ], r.affectedObjectOther));
  xml = setWordCellTextBalanced(xml, 1, 8, 1, text(r.reference || r.affectedScope));
  xml = setWordCellTextBalanced(xml, 1, 8, 3, text(r.lotReference));
  xml = setWordCellTextBalanced(xml, 1, 9, 3, text(r.quantity));
  xml = setWordCellTextBalanced(xml, 1, 10, 3, text(r.expiryReanalysis));
  xml = setWordCellTextBalanced(xml, 1, 12, 0, [
    checks(r.complaintCategories, [
      ["PRODUCT_QUALITY","Calidad del producto"],["SPECIFICATIONS","Especificaciones / análisis"],["PACKAGING","Acondicionamiento / envase"],
      ["LABELING","Etiquetado / documentación"],["QUANTITY","Cantidad / contenido"],["TRANSPORT_STORAGE","Transporte / almacenamiento"],
      ["SERVICE_SUPPLY","Servicio / suministro"],["EQUIPMENT_SYSTEM","Equipo / sistema"],["ENVIRONMENT","Medio ambiente"],
    ], r.complaintCategoryOther),
    text(r.description),
  ].filter(Boolean).join("\n\n"));
  xml = setWordCellTextBalanced(xml, 1, 14, 1, `${box(r.recurrent === true, "Sí")}   ${box(r.recurrent === false, "No")}`);
  xml = setWordCellTextBalanced(xml, 1, 14, 3, text(r.recurrenceReference));
  xml = setWordCellTextBalanced(xml, 1, 15, 1, text(r.attachedDocumentation));
  xml = setWordCellTextBalanced(xml, 1, 16, 1, text(r.emittedBy));
  xml = setWordCellTextBalanced(xml, 1, 17, 1, text(r.qaValidatedBy));

  const impacts = [
    r.qualityGmpImpact, r.safetyEfficacyImpact, r.regulatoryComplianceImpact,
    r.environmentImpact, r.similarSituationsImpact,
  ];
  [20,21,22,23,24].forEach((row, index) => { xml = setWordCellTextBalanced(xml, 1, row, 1, tri(impacts[index])); });
  xml = setWordCellTextBalanced(xml, 1, 26, 0, checks(r.containmentActions, [
    ["BLOCK_QUARANTINE","Bloqueo / cuarentena"],["SUSPEND","Suspender uso / distribución"],
    ["NOTICE","Aviso a cliente / proveedor / titular / Autoridad"],["NONE","Ninguna"],
  ], r.containmentOther));
  xml = setWordCellTextBalanced(xml, 1, 27, 0, text(r.riskJustification));
  xml = setWordCellTextBalanced(xml, 1, 30, 0, [text(r.investigation), text(r.impactAssessment)].filter(Boolean).join("\n\n"));
  xml = setWordCellTextBalanced(xml, 1, 32, 1, [
    box(r.investigationResult === "PROCEDENT","Procedente"),
    box(r.investigationResult === "NOT_PROCEDENT","No procedente"),
    box(r.investigationResult === "INCONCLUSIVE","No concluyente"),
  ].join("   "));
  xml = setWordCellTextBalanced(xml, 1, 34, 0, text(r.rootCause));
  xml = setWordCellTextBalanced(xml, 1, 37, 0, classification(r.classification));

  [
    [43,r.withdrawalPotential],[44,r.recallProcedureRequired],[45,r.authorityNotification],[46,r.responsiblePartyCommunication],
  ].forEach(([row,value]) => { xml = setWordCellTextBalanced(xml, 1, Number(row), 1, tri(value as string | null)); });
  xml = setWordCellTextBalanced(xml, 1, 47, 0, text(r.regulatoryJustification));
  xml = setWordCellTextBalanced(xml, 1, 49, 0, text(r.resolutionLines));
  xml = setWordCellTextBalanced(xml, 1, 52, 0, derivedActions(r));

  if (r.capaPlans.length) {
    xml = replaceWordRowWithCopies(xml, 1, 55, r.capaPlans.map((plan) => [
      plan.businessCapaCode || plan.linkedCapaRecord?.businessCode || plan.actionType,
      plan.description,
      text(plan.responsible),
      date(plan.plannedExecutionDate),
    ]));
  }

  xml = setWordCellTextBalanced(xml, 1, 57, 1, [date(r.externalCommunicationDate), text(r.externalCommunicationMedium)].filter(Boolean).join(" · "));
  xml = setWordCellTextBalanced(xml, 1, 57, 3, text(r.externalCommunicationParties));
  xml = setWordCellTextBalanced(xml, 1, 58, 0, text(r.externalCommunication));
  xml = setWordCellTextBalanced(xml, 1, 61, 0, `${box(r.continueToPartII === true, "Continúa en Parte II")}   ${box(r.continueToPartII === false, "Cierre en Parte I")}`);
  xml = setWordCellTextBalanced(xml, 1, 62, 0, text(r.conclusion));

  xml = setWordCellTextBalanced(xml, 2, 4, 0, text(r.approvalNames));

  xml = setWordCellTextBalanced(xml, 3, 3, 0, [r.responseDate ? `Fecha: ${date(r.responseDate)}` : "", r.responseMedium ? `Medio: ${r.responseMedium}` : "", text(r.responseSummary)].filter(Boolean).join("\n"));
  xml = setWordCellTextBalanced(xml, 3, 5, 1, `${box(r.responseSufficient === true, "Sí")}   ${box(r.responseSufficient === false, "No")}`);
  xml = setWordCellTextBalanced(xml, 3, 7, 0, box(r.effectivenessStatus === "ACCEPTABLE", "Conforme"));
  xml = setWordCellTextBalanced(xml, 3, 7, 1, box(r.effectivenessStatus === "NOT_ACCEPTABLE", "No Conforme"));
  xml = setWordCellTextBalanced(xml, 3, 7, 2, box(r.effectivenessStatus === "PENDING", "Pendiente"));
  xml = setWordCellTextBalanced(xml, 3, 7, 3, box(r.effectivenessStatus === "NOT_REQUIRED", "N/A"));
  xml = setWordCellTextBalanced(xml, 3, 10, 0, [
    `Estado de acciones: ${text(r.followupActionStatus)}`,
    r.followupReferences ? `Referencias / responsable: ${r.followupReferences}` : "",
  ].filter(Boolean).join("\n"));
  xml = setWordCellTextBalanced(xml, 3, 11, 0, [text(r.effectivenessAssessment), text(r.closeConclusion)].filter(Boolean).join("\n\n"));
  xml = setWordCellTextBalanced(xml, 3, 13, 1, `${box(r.status === "CLOSED", "Cerrada")}   ${box(r.status === "OPEN", "Abierta / en seguimiento")}`);
  xml = setWordCellTextBalanced(xml, 3, 13, 3, date(r.closedAt));
  const next = r.followups.find((item) => item.nextFollowupDate)?.nextFollowupDate ?? null;
  xml = setWordCellTextBalanced(xml, 3, 14, 1, date(next));
  xml = setWordCellTextBalanced(xml, 4, 1, 0, text(r.closeApprovalNames));

  updateZipEntry(entries, "word/document.xml", xml);
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}

export async function generateComplaintAnnexIV() {
  throw new ComplaintTemplateUnavailableError("La respuesta al cliente (Anexo IV) no se genera desde la aplicación.");
}

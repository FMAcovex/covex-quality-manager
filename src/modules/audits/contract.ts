import type { QmsRecordModuleContract } from "@/modules/contract";

export const auditModule: QmsRecordModuleContract = {
  contractVersion: 1,
  key: "AUDIT",
  recordType: "AUDIT",
  labels: { singular: "Auditoría", plural: "Auditorías" },
  href: "/audits",
  indicatorsHref: null,
  permissions: [
    "READ",
    "CREATE",
    "EDIT",
    "FOLLOWUP",
    "REVIEW",
    "CLOSE",
    "ANNUL",
    "DOWNLOAD",
    "ATTACH_DOCUMENT",
    "GENERATE_DOCUMENT",
    "AUDIT_ISSUE_REPORT",
    "AUDIT_ISSUE_PROGRAMME",
  ],
  relations: {
    outgoing: [
      { target: "DEVIATION", type: "GENERATES", label: "Auditoría → Desviación" },
      { target: "CAPA", type: "GENERATES", label: "Auditoría → CAPA" },
    ],
  },
  lifecycle: {
    field: "Audit.status",
    states: ["DRAFT", "OPEN", "CLOSED"],
    transitions: [
      { operation: "save", label: "Alta y edición de la ficha", from: [null, "DRAFT"], to: ["DRAFT", "OPEN"] },
      { operation: "close", label: "Informe y cierre", from: ["OPEN"], to: ["CLOSED"] },
    ],
    notes: [
      "El cierre solo se registra con Informe y cierre, tras la lista de comprobación de cierre.",
      "Una auditoría cerrada no se reabre.",
      "Una auditoría anulada no se puede modificar; la anulación no cambia este estado.",
    ],
  },
};

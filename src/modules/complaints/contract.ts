import type { QmsRecordModuleContract } from "@/modules/contract";

export const complaintModule: QmsRecordModuleContract = {
  contractVersion: 1,
  key: "COMPLAINT",
  recordType: "COMPLAINT",
  labels: { singular: "Reclamación", plural: "Reclamaciones" },
  href: "/complaints",
  indicatorsHref: "/complaints/indicators",
  permissions: [
    "READ",
    "CREATE",
    "EDIT",
    "FOLLOWUP",
    "REVIEW",
    "CLOSE",
    "ANNUL",
    "DOWNLOAD",
    "EXPORT",
    "ATTACH_DOCUMENT",
    "GENERATE_DOCUMENT",
    "MANAGE_CONFIGURATION",
  ],
  relations: {
    outgoing: [
      { target: "CAPA", type: "GENERATES", label: "Reclamación → CAPA" },
      { target: "RETURN", type: "GENERATES", label: "Reclamación → Devolución" },
    ],
  },
  lifecycle: {
    field: "Complaint.status",
    states: ["DRAFT", "OPEN", "CLOSED"],
    transitions: [
      { operation: "save", label: "Alta y edición de la ficha", from: [null, "DRAFT"], to: ["DRAFT", "OPEN", "CLOSED"] },
      { operation: "save", label: "Alta y edición de la ficha", from: ["OPEN", "CLOSED"], to: ["OPEN", "CLOSED"] },
    ],
    notes: [
      "Pasar a Cerrada exige el permiso de cierre, fecha de cierre, conclusión y, si procede, la Parte II resuelta.",
      "Cerrada → Abierta (reapertura) crea una versión de reapertura solo si se guarda como nueva versión.",
      "La anulación del expediente (`QmsRecord`) no cambia este estado.",
    ],
  },
};

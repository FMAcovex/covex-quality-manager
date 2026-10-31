import type { QmsRecordModuleContract } from "@/modules/contract";

export const returnModule: QmsRecordModuleContract = {
  contractVersion: 1,
  key: "RETURN",
  recordType: "RETURN",
  labels: { singular: "Devolución", plural: "Devoluciones" },
  href: "/returns",
  indicatorsHref: "/returns/indicators",
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
  // Devolución solo es destino desde Reclamación.
  relations: { outgoing: [] },
  lifecycle: {
    field: "ReturnRecord.status",
    states: ["DRAFT", "OPEN", "CLOSED"],
    transitions: [
      { operation: "save", label: "Alta y edición de la ficha", from: [null, "DRAFT"], to: ["DRAFT", "OPEN", "CLOSED"] },
      { operation: "save", label: "Alta y edición de la ficha", from: ["OPEN", "CLOSED"], to: ["OPEN", "CLOSED"] },
    ],
    notes: [
      "Pasar a Cerrada exige el permiso de cierre, decisión, destino final y trazabilidad actualizada.",
      "Una devolución anulada no se puede modificar; la anulación no cambia este estado.",
    ],
  },
};

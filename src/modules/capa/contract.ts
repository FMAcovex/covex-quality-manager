import type { QmsRecordModuleContract } from "@/modules/contract";

export const capaModule: QmsRecordModuleContract = {
  contractVersion: 1,
  key: "CAPA",
  recordType: "CAPA",
  labels: { singular: "CAPA", plural: "CAPA" },
  href: "/capa",
  indicatorsHref: "/capa/indicators",
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
  ],
  // CAPA solo es destino; sus orígenes se declaran en Desviación, Reclamación y Auditoría.
  relations: { outgoing: [] },
  lifecycle: {
    field: "Capa.status",
    states: ["DRAFT", "OPEN", "CLOSED", "CANCELLED"],
    transitions: [
      { operation: "save", label: "Alta y edición de la ficha", from: [null, "DRAFT"], to: ["DRAFT", "OPEN", "CLOSED", "CANCELLED"] },
      { operation: "save", label: "Alta y edición de la ficha", from: ["OPEN", "CLOSED", "CANCELLED"], to: ["OPEN", "CLOSED", "CANCELLED"] },
      { operation: "followup", label: "Seguimiento", from: ["OPEN", "CLOSED", "CANCELLED"], to: ["OPEN", "CLOSED", "CANCELLED"] },
      { operation: "import", label: "Importación histórica", from: [null], to: ["OPEN", "CLOSED", "CANCELLED"] },
    ],
    notes: [
      "Cerrada exige el permiso de cierre y fecha de cierre operativo; Cancelada exige el permiso de anulación.",
      "El seguimiento exige motivo para cancelar y evidencia para un cierre operativo nuevo; su formulario no está enlazado hoy en la interfaz.",
      "Cerrada → Abierta no crea versión de reapertura.",
      "La anulación del expediente (`QmsRecord`) no cambia este estado.",
    ],
  },
};

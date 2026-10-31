import type { QmsRecordModuleContract } from "@/modules/contract";

export const deviationModule: QmsRecordModuleContract = {
  contractVersion: 1,
  key: "DEVIATION",
  recordType: "DEVIATION",
  labels: { singular: "Desviación", plural: "Desviaciones" },
  href: "/deviations",
  indicatorsHref: "/deviations/indicators",
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
      { target: "CAPA", type: "GENERATES", label: "Desviación → CAPA" },
    ],
  },
  lifecycle: {
    field: "Deviation.status",
    states: ["DRAFT", "OPEN", "CLOSED"],
    transitions: [
      { operation: "save", label: "Alta y edición de la ficha", from: [null, "DRAFT"], to: ["DRAFT", "OPEN", "CLOSED"] },
      { operation: "save", label: "Alta y edición de la ficha", from: ["OPEN", "CLOSED"], to: ["OPEN", "CLOSED"] },
      { operation: "import", label: "Importación histórica", from: [null], to: ["OPEN", "CLOSED"] },
    ],
    notes: [
      "Pasar a Cerrada exige el permiso de cierre e investigación, causa raíz, clasificación, conclusión y fecha de cierre.",
      "Cerrada → Abierta (reapertura) crea una versión de reapertura solo si se guarda como nueva versión.",
      "La anulación del expediente (`QmsRecord`) no cambia este estado.",
    ],
  },
};

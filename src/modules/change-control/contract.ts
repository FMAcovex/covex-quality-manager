import type { QmsRecordModuleContract } from "@/modules/contract";

export const changeControlModule: QmsRecordModuleContract = {
  contractVersion: 1,
  key: "CHANGE_CONTROL",
  recordType: "CHANGE_CONTROL",
  labels: { singular: "Control de Cambio", plural: "Controles de cambios" },
  href: "/changes",
  indicatorsHref: "/changes/indicators",
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
  // Sin relaciones operativas en V1 (D-018, D-047, D-083 MC-2).
  relations: { outgoing: [] },
  lifecycle: {
    field: "ChangeControl.finalStatus",
    states: ["DRAFT", "OPEN", "CLOSED"],
    transitions: [
      { operation: "save", label: "Alta y edición de la ficha", from: [null, "DRAFT"], to: ["DRAFT", "OPEN", "CLOSED"] },
      { operation: "save", label: "Alta y edición de la ficha", from: ["OPEN", "CLOSED"], to: ["OPEN", "CLOSED"] },
      { operation: "followup", label: "Seguimiento", from: ["OPEN", "CLOSED"], to: ["OPEN", "CLOSED"] },
      { operation: "followup-edit", label: "Corrección del último seguimiento", from: ["OPEN", "CLOSED"], to: ["OPEN", "CLOSED"] },
    ],
    notes: [
      "En la interfaz el cierre se registra con un seguimiento: exige Dictamen aprobado, eficacia Aceptable si se ejecutó (No aplica si no), conclusión y aprobación del cierre.",
      "Seguir abierto con un seguimiento exige motivo y próxima fecha.",
      "La anulación del expediente (`QmsRecord`) no cambia este estado.",
    ],
  },
};

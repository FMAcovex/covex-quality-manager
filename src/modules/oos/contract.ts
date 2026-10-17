import type { QmsRecordModuleContract } from "@/modules/contract";

export const oosModule: QmsRecordModuleContract = {
  contractVersion: 1,
  key: "OOS",
  recordType: "OOS",
  labels: { singular: "OOS", plural: "OOS" },
  href: "/oos",
  indicatorsHref: null,
  permissions: ["READ", "CREATE", "EDIT", "REVIEW", "CLOSE", "ANNUL", "DOWNLOAD"],
  // D-088: el OOS origina CAPA y, en casos poco habituales, una desviación.
  relations: {
    outgoing: [
      { target: "CAPA", type: "GENERATES", label: "OOS → CAPA" },
      { target: "DEVIATION", type: "GENERATES", label: "OOS → Desviación" },
    ],
  },
  lifecycle: {
    field: "OosRecord.status",
    states: ["DRAFT", "OPEN", "CLOSED"],
    transitions: [
      { operation: "save", label: "Alta y edición de la ficha", from: [null, "DRAFT"], to: ["DRAFT", "OPEN", "CLOSED"] },
      { operation: "save", label: "Alta y edición de la ficha", from: ["OPEN", "CLOSED"], to: ["OPEN", "CLOSED"] },
    ],
    notes: [
      "La fase es un campo aparte: la disposición de la Fase I decide si el OOS se cierra por error de laboratorio o pasa a la Fase II (Anexo V del PNT GC-10/014/04).",
      "Pasar a Cerrado exige el permiso de cierre, fecha de cierre, resultado de la investigación y dictamen de la fase de cierre.",
      "La anulación del expediente (`QmsRecord`) no cambia este estado.",
    ],
  },
};

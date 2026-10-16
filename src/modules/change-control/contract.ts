import type { QmsRecordModuleContract } from "@/modules/contract";

export const changeControlModule: QmsRecordModuleContract = {
  contractVersion: 1,
  key: "CHANGE_CONTROL",
  recordType: "CHANGE_CONTROL",
  labels: { singular: "Control de Cambio", plural: "Controles de cambios" },
  href: "/changes",
  indicatorsHref: "/changes/indicators",
  // Sin relaciones operativas en V1 (D-018, D-047, D-083 MC-2).
  relations: { outgoing: [] },
};

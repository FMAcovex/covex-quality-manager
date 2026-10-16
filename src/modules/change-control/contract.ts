import { QmsRecordType } from "@prisma/client";
import type { QmsModuleContract } from "@/modules/contract";

export const changeControlModule: QmsModuleContract = {
  contractVersion: 1,
  key: "CHANGE_CONTROL",
  recordType: QmsRecordType.CHANGE_CONTROL,
  labels: { singular: "Control de Cambio", plural: "Controles de cambios" },
  href: "/changes",
  // Sin relaciones operativas en V1 (D-018, D-047, D-083 MC-2).
  relations: { outgoing: [] },
};

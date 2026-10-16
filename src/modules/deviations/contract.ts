import { QmsRecordType, QmsRelationType } from "@prisma/client";
import type { QmsModuleContract } from "@/modules/contract";

export const deviationModule: QmsModuleContract = {
  contractVersion: 1,
  key: "DEVIATION",
  recordType: QmsRecordType.DEVIATION,
  labels: { singular: "Desviación", plural: "Desviaciones" },
  href: "/deviations",
  relations: {
    outgoing: [
      { target: QmsRecordType.CAPA, type: QmsRelationType.GENERATES, label: "Desviación → CAPA" },
    ],
  },
};

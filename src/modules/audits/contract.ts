import { QmsRecordType, QmsRelationType } from "@prisma/client";
import type { QmsModuleContract } from "@/modules/contract";

export const auditModule: QmsModuleContract = {
  contractVersion: 1,
  key: "AUDIT",
  recordType: QmsRecordType.AUDIT,
  labels: { singular: "Auditoría", plural: "Auditorías" },
  href: "/audits",
  relations: {
    outgoing: [
      { target: QmsRecordType.DEVIATION, type: QmsRelationType.GENERATES, label: "Auditoría → Desviación" },
      { target: QmsRecordType.CAPA, type: QmsRelationType.GENERATES, label: "Auditoría → CAPA" },
    ],
  },
};

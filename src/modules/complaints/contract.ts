import { QmsRecordType, QmsRelationType } from "@prisma/client";
import type { QmsModuleContract } from "@/modules/contract";

export const complaintModule: QmsModuleContract = {
  contractVersion: 1,
  key: "COMPLAINT",
  recordType: QmsRecordType.COMPLAINT,
  labels: { singular: "Reclamación", plural: "Reclamaciones" },
  href: "/complaints",
  relations: {
    outgoing: [
      { target: QmsRecordType.CAPA, type: QmsRelationType.GENERATES, label: "Reclamación → CAPA" },
      { target: QmsRecordType.RETURN, type: QmsRelationType.GENERATES, label: "Reclamación → Devolución" },
    ],
  },
};

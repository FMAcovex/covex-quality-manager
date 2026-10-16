import { QmsRecordType } from "@prisma/client";
import type { QmsModuleContract } from "@/modules/contract";

export const returnModule: QmsModuleContract = {
  contractVersion: 1,
  key: "RETURN",
  recordType: QmsRecordType.RETURN,
  labels: { singular: "Devolución", plural: "Devoluciones" },
  href: "/returns",
  // Devolución solo es destino desde Reclamación.
  relations: { outgoing: [] },
};

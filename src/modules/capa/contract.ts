import { QmsRecordType } from "@prisma/client";
import type { QmsModuleContract } from "@/modules/contract";

export const capaModule: QmsModuleContract = {
  contractVersion: 1,
  key: "CAPA",
  recordType: QmsRecordType.CAPA,
  labels: { singular: "CAPA", plural: "CAPA" },
  href: "/capa",
  // CAPA solo es destino; sus orígenes se declaran en Desviación, Reclamación y Auditoría.
  relations: { outgoing: [] },
};

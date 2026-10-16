import type { QmsRecordModuleContract } from "@/modules/contract";

export const capaModule: QmsRecordModuleContract = {
  contractVersion: 1,
  key: "CAPA",
  recordType: "CAPA",
  labels: { singular: "CAPA", plural: "CAPA" },
  href: "/capa",
  indicatorsHref: "/capa/indicators",
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
  ],
  // CAPA solo es destino; sus orígenes se declaran en Desviación, Reclamación y Auditoría.
  relations: { outgoing: [] },
};

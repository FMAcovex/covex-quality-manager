import type { QmsRecordModuleContract } from "@/modules/contract";

export const returnModule: QmsRecordModuleContract = {
  contractVersion: 1,
  key: "RETURN",
  recordType: "RETURN",
  labels: { singular: "Devolución", plural: "Devoluciones" },
  href: "/returns",
  indicatorsHref: "/returns/indicators",
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
  // Devolución solo es destino desde Reclamación.
  relations: { outgoing: [] },
};

import type { QmsRecordModuleContract } from "@/modules/contract";

export const deviationModule: QmsRecordModuleContract = {
  contractVersion: 1,
  key: "DEVIATION",
  recordType: "DEVIATION",
  labels: { singular: "Desviación", plural: "Desviaciones" },
  href: "/deviations",
  indicatorsHref: "/deviations/indicators",
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
  relations: {
    outgoing: [
      { target: "CAPA", type: "GENERATES", label: "Desviación → CAPA" },
    ],
  },
};

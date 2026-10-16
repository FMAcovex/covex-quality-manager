import type { QmsRecordModuleContract } from "@/modules/contract";

export const complaintModule: QmsRecordModuleContract = {
  contractVersion: 1,
  key: "COMPLAINT",
  recordType: "COMPLAINT",
  labels: { singular: "Reclamación", plural: "Reclamaciones" },
  href: "/complaints",
  indicatorsHref: "/complaints/indicators",
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
      { target: "CAPA", type: "GENERATES", label: "Reclamación → CAPA" },
      { target: "RETURN", type: "GENERATES", label: "Reclamación → Devolución" },
    ],
  },
};

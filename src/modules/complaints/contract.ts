import type { QmsRecordModuleContract } from "@/modules/contract";

export const complaintModule: QmsRecordModuleContract = {
  contractVersion: 1,
  key: "COMPLAINT",
  recordType: "COMPLAINT",
  labels: { singular: "Reclamación", plural: "Reclamaciones" },
  href: "/complaints",
  indicatorsHref: "/complaints/indicators",
  relations: {
    outgoing: [
      { target: "CAPA", type: "GENERATES", label: "Reclamación → CAPA" },
      { target: "RETURN", type: "GENERATES", label: "Reclamación → Devolución" },
    ],
  },
};

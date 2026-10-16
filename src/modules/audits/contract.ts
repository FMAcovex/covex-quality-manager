import type { QmsRecordModuleContract } from "@/modules/contract";

export const auditModule: QmsRecordModuleContract = {
  contractVersion: 1,
  key: "AUDIT",
  recordType: "AUDIT",
  labels: { singular: "Auditoría", plural: "Auditorías" },
  href: "/audits",
  indicatorsHref: null,
  relations: {
    outgoing: [
      { target: "DEVIATION", type: "GENERATES", label: "Auditoría → Desviación" },
      { target: "CAPA", type: "GENERATES", label: "Auditoría → CAPA" },
    ],
  },
};

import type { QmsRecordType } from "@prisma/client";
import type { QmsModuleContract, QmsRelationRule } from "@/modules/contract";
import { auditModule } from "@/modules/audits/contract";
import { capaModule } from "@/modules/capa/contract";
import { changeControlModule } from "@/modules/change-control/contract";
import { complaintModule } from "@/modules/complaints/contract";
import { deviationModule } from "@/modules/deviations/contract";
import { returnModule } from "@/modules/returns/contract";

/**
 * Registro único de módulos QMS con expediente `QmsRecord`. El orden es
 * significativo: determina el orden de la matriz de relaciones derivada.
 */
export const qmsModules: readonly QmsModuleContract[] = [
  deviationModule,
  capaModule,
  changeControlModule,
  complaintModule,
  returnModule,
  auditModule,
];

export type RegisteredRelationRule = QmsRelationRule & Readonly<{ source: QmsRecordType }>;

export const registeredRelationRules: readonly RegisteredRelationRule[] = qmsModules.flatMap(
  (contract) => contract.relations.outgoing.map((rule) => ({ source: contract.recordType, ...rule })),
);

export function qmsModuleByRecordType(recordType: QmsRecordType | string) {
  return qmsModules.find((contract) => contract.recordType === recordType);
}

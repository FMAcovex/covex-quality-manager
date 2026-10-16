import type { QmsRecordType } from "@prisma/client";
import type { ModuleRelationHooks } from "@/modules/contract";
import { auditRelationHooks } from "@/modules/audits/relation-hooks";
import { complaintRelationHooks } from "@/modules/complaints/relation-hooks";
import { returnRelationHooks } from "@/modules/returns/relation-hooks";

/**
 * Lógica de servidor de los módulos al crear o desactivar relaciones. Se
 * mantiene separada de src/modules/registry.ts para que los contratos
 * declarativos no arrastren dependencias de servidor.
 */
export const qmsRelationHooks: Readonly<Partial<Record<QmsRecordType, ModuleRelationHooks>>> = {
  AUDIT: auditRelationHooks,
  COMPLAINT: complaintRelationHooks,
  RETURN: returnRelationHooks,
};

export function relationHooksFor(recordType: QmsRecordType | string) {
  return qmsRelationHooks[recordType as QmsRecordType];
}

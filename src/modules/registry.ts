import type { QmsRecordType } from "@prisma/client";
import type { AccessModule, AccessPermission } from "@/lib/auth/context";
import type { QmsModuleContract, QmsModuleKey, QmsRecordModuleContract, QmsRelationRule } from "@/modules/contract";
import { auditModule } from "@/modules/audits/contract";
import { capaModule } from "@/modules/capa/contract";
import { changeControlModule } from "@/modules/change-control/contract";
import { complaintModule } from "@/modules/complaints/contract";
import { pntModule } from "@/modules/controlled-documents/contract";
import { deviationModule } from "@/modules/deviations/contract";
import { oosModule } from "@/modules/oos/contract";
import { returnModule } from "@/modules/returns/contract";

/**
 * Registro único de módulos QMS. Solo datos: se importa también desde
 * componentes de cliente. El orden es significativo: determina el orden del
 * menú, del dashboard, del audit trail y de la matriz de relaciones derivada.
 */
export const qmsModules: readonly QmsModuleContract[] = [
  deviationModule,
  capaModule,
  changeControlModule,
  complaintModule,
  returnModule,
  auditModule,
  oosModule,
  pntModule,
];

/** Módulos cuyos expedientes son `QmsRecord` y participan en relaciones. */
export const qmsRecordModules: readonly QmsRecordModuleContract[] = qmsModules.filter(
  (contract): contract is QmsRecordModuleContract => contract.recordType !== null,
);

export const qmsModuleKeys: readonly QmsModuleKey[] = qmsModules.map((contract) => contract.key);
export const qmsRecordModuleKeys: readonly QmsModuleKey[] = qmsRecordModules.map((contract) => contract.key);
export const qmsRecordTypes: readonly QmsRecordType[] = qmsRecordModules.map((contract) => contract.recordType);

export type RegisteredRelationRule = QmsRelationRule & Readonly<{ source: QmsRecordType }>;

export const registeredRelationRules: readonly RegisteredRelationRule[] = qmsRecordModules.flatMap(
  (contract) => contract.relations.outgoing.map((rule) => ({ source: contract.recordType, ...rule })),
);

export function qmsModuleByRecordType(recordType: QmsRecordType | string) {
  return qmsRecordModules.find((contract) => contract.recordType === recordType);
}

export function qmsModuleByKey(key: string) {
  return qmsModules.find((contract) => contract.key === key);
}

/** Permisos transversales del módulo de autorización SYSTEM (configuración, usuarios y audit trail). */
export const systemPermissions: readonly AccessPermission[] = [
  "READ",
  "DOWNLOAD",
  "MANAGE_CONFIGURATION",
  "MANAGE_USERS",
  "AUDIT_TRAIL_REVIEW",
  "AUDIT_TRAIL_EXPORT",
  "AUDIT_TRAIL_SENSITIVE_READ",
];

/** Permisos que admite un módulo de autorización según su contrato. */
export function permissionsForModule(module: AccessModule): readonly AccessPermission[] {
  return module === "SYSTEM" ? systemPermissions : qmsModuleByKey(module)?.permissions ?? [];
}

/** Segmento de ruta de primer nivel → módulo de autorización, derivado de `href`. */
export const qmsModuleByPathSegment: Readonly<Record<string, QmsModuleKey>> = Object.fromEntries(
  qmsModules.map((contract) => [contract.href.replace(/^\//, ""), contract.key]),
);

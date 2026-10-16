import type { QmsRecordType, QmsRelationType } from "@prisma/client";
import type { AccessModule } from "@/lib/auth/context";
import type { QmsRelationClient } from "@/lib/qms/relation-service";

/**
 * Contrato declarativo de un módulo QMS (v1). Ver docs/MODULE_CONTRACT.md.
 *
 * Solo datos: se puede importar desde cualquier capa. La lógica de servidor
 * asociada a relaciones vive en `ModuleRelationHooks` (relation-hooks.ts de
 * cada módulo) y se registra en src/modules/relation-hooks-registry.ts.
 */
export type QmsModuleContract = {
  contractVersion: 1;
  key: AccessModule;
  recordType: QmsRecordType;
  labels: Readonly<{ singular: string; plural: string }>;
  href: string;
  relations: Readonly<{ outgoing: readonly QmsRelationRule[] }>;
};

/** Relación admitida en dirección canónica, declarada en el módulo de origen. */
export type QmsRelationRule = Readonly<{
  target: QmsRecordType;
  type: QmsRelationType;
  label: string;
}>;

export type QmsRelationEndpoint = Readonly<{ id: string; recordType: QmsRecordType }>;

export type QmsRelationCreateContext = Readonly<{
  client: QmsRelationClient;
  source: QmsRelationEndpoint;
  target: QmsRelationEndpoint;
  /** Mismo criterio que createQmsRelation usa para decidir bloqueos y snapshots. */
  transactional: boolean;
}>;

export type QmsRelationDeactivateContext = Readonly<{
  client: QmsRelationClient;
  relationId: string;
  sourceRecordId: string;
  targetRecordId: string;
}>;

export type QmsRelationLifecycleHooks = Readonly<{
  beforeCreate?: (context: QmsRelationCreateContext) => Promise<void>;
  afterCreate?: (context: QmsRelationCreateContext) => Promise<void>;
  beforeDeactivate?: (context: QmsRelationDeactivateContext) => Promise<void>;
  afterDeactivate?: (context: QmsRelationDeactivateContext) => Promise<void>;
}>;

/**
 * Precondiciones, bloqueos y refresco de snapshots propios de un módulo cuando
 * participa como origen o destino de una relación. Se ejecutan dentro del
 * servicio común: primero los del origen y después los del destino.
 */
export type ModuleRelationHooks = Readonly<{
  asSource?: QmsRelationLifecycleHooks;
  asTarget?: QmsRelationLifecycleHooks;
}>;

import type { QmsRecordType, QmsRelationType } from "@prisma/client";
import type { AccessModule } from "@/lib/auth/context";
import type { QmsRelationClient } from "@/lib/qms/relation-service";

/**
 * Contrato declarativo de un módulo QMS (v1). Ver docs/MODULE_CONTRACT.md.
 *
 * Solo datos y solo imports de tipos: se puede importar desde cualquier capa,
 * incluidos componentes de cliente. La lógica de servidor
 * asociada a relaciones vive en `ModuleRelationHooks` (relation-hooks.ts de
 * cada módulo) y se registra en src/modules/relation-hooks-registry.ts.
 */
export type QmsModuleKey = Exclude<AccessModule, "SYSTEM">;

export type QmsModuleContract = {
  contractVersion: 1;
  key: QmsModuleKey;
  /** null cuando el módulo no usa expediente `QmsRecord` (PNT, D-083 MC-3). */
  recordType: QmsRecordType | null;
  /** `plural` es el nombre del módulo en el menú principal y el dashboard. */
  labels: Readonly<{ singular: string; plural: string }>;
  href: string;
  indicatorsHref: string | null;
  relations: Readonly<{ outgoing: readonly QmsRelationRule[] }>;
};

export type QmsRecordModuleContract = QmsModuleContract & Readonly<{ recordType: QmsRecordType }>;

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

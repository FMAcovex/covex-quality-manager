import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import b1Contract from "../../../ops/backup/audit-contract.json";
import b2Contract from "../../../ops/backup/audit-contract-b2.json";
import captureContract from "../../../ops/backup/audit-contract-b2-capture.json";
import integrationContract from "../../../ops/backup/audit-contract-b2-integration.json";
import documentContract from "../../../ops/backup/audit-contract-b2-documents.json";
import stagingContract from "../../../ops/backup/audit-contract-b2-staging.json";
import criticalContract from "../../../ops/backup/audit-contract-b2-critical.json";
import cContract from "../../../ops/backup/audit-contract-c.json";
import oosContract from "../../../ops/backup/audit-contract-oos.json";
import oosDocumentsContract from "../../../ops/backup/audit-contract-oos-documents.json";
import oosSignedContract from "../../../ops/backup/audit-contract-oos-signed.json";
import rootCauseContract from "../../../ops/backup/audit-contract-root-cause.json";
import additionalLotsContract from "../../../ops/backup/audit-contract-additional-lots.json";
import responsibleUsersContract from "../../../ops/backup/audit-contract-responsible-users.json";
import capaPlanContract from "../../../ops/backup/audit-contract-capa-plan.json";
import deviationShiftContract from "../../../ops/backup/audit-contract-deviation-shift.json";
import pntAssignmentsContract from "../../../ops/backup/audit-contract-pnt-assignments.json";
import changeModelsContract from "../../../ops/backup/audit-contract-change-control-models.json";
import deviationToolsContract from "../../../ops/backup/audit-contract-deviation-investigation-tools.json";
import deviationTextTablesContract from "../../../ops/backup/audit-contract-deviation-text-tables.json";
import capaChangeTextTablesContract from "../../../ops/backup/audit-contract-capa-change-text-tables.json";
import { AuditEngineError } from "./domain";
import { canonicalAuditJson } from "./canonical-json";

export async function assertAuditProtection(tx: Prisma.TransactionClient) {
  const [version] = await tx.$queryRaw<{ present: boolean; capture: boolean; composition: boolean; documents: boolean; staging: boolean; migrations: boolean }[]>`SELECT to_regclass('public."AuditPolicyRequirement"') IS NOT NULL AS present,to_regclass('public."AuditBusinessContext"') IS NOT NULL AS capture,to_regclass('public."AuditCommandResult"') IS NOT NULL AS composition,to_regclass('public."SignedDocumentCustody"') IS NOT NULL AS documents,to_regclass('public."AuditTechnicalEvent"') IS NOT NULL AS staging,to_regclass('public._prisma_migrations') IS NOT NULL AS migrations`;
  if (!version?.staging && version?.migrations) {
    const [installed] = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261013000600_b2_staging_channel' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  if (!version?.documents && version?.migrations) {
    const [installed] = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261013000500_b2_signed_originals' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  if (!version?.composition && version?.migrations) {
    const [installed] = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261013000400_b2_command_composition' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  if (!version?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261013000200_b2_audit_requirement' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  if (!version?.capture && version?.migrations) {
    const [installed] = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261013000300_b2_sql_capture' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  const [critical] = await tx.$queryRaw<{present:boolean}[]>`SELECT to_regclass('public."AuditOperationAssessment"') IS NOT NULL AS present`;
  if (!critical?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261013000700_b2_critical_integrity' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  const [review] = await tx.$queryRaw<{present:boolean}[]>`SELECT to_regclass('public."AuditTrailReview"') IS NOT NULL AS present`;
  if (!review?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261014000100_c_audit_review_export' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  // D-088, OOS-2b: additive OosRecord capture has triggers/policy, no new table.
  const [oos] = await tx.$queryRaw<{present:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='OosRecord' AND t.tgname='audit_b2_capture') AS present`;
  if (!oos?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261017000200_b2_oos_capture' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  // D-088, OOS-3: OO06 only widens covex_b2_begin; recognised by its published code range.
  const [oosDocuments] = await tx.$queryRaw<{present:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='covex_b2_begin' AND p.prosrc LIKE '%OO0[1-6]%') AS present`;
  if (!oosDocuments?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261017000400_b2_oos_documents' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  // D-088, OOS-4: OOS signed PDFs only widen covex_b2_retain_signed_original.
  const [oosSigned] = await tx.$queryRaw<{present:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='covex_b2_retain_signed_original' AND p.prosrc LIKE '%OOS_ANNEX_III_SIGNED%') AS present`;
  if (!oosSigned?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261017000600_b2_oos_signed_documents' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  // Categoría de causa raíz (6M): solo amplía la política de captura con rootCauseCategories.
  const [rootCause] = version?.capture
    ? await tx.$queryRaw<{present:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "AuditCaptureFieldPolicy" WHERE "entityType"='Deviation' AND "fieldPath"='rootCauseCategories') AS present`
    : [{ present: false }];
  if (!rootCause?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261017000700_root_cause_categories' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  // D-094: otros lotes afectados; solo amplía la política de captura con additionalLots.
  const [additionalLots] = version?.capture
    ? await tx.$queryRaw<{present:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "AuditCaptureFieldPolicy" WHERE "entityType"='Deviation' AND "fieldPath"='additionalLots') AS present`
    : [{ present: false }];
  if (!additionalLots?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261018000100_additional_lots' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  // D-101: usuario de la aplicación junto a cada responsable; solo amplía la política de captura.
  const [responsibleUsers] = version?.capture
    ? await tx.$queryRaw<{present:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "AuditCaptureFieldPolicy" WHERE "entityType"='CapaPlannedAction' AND "fieldPath"='responsibleUserId') AS present`
    : [{ present: false }];
  if (!responsibleUsers?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261018000300_responsible_users' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  // D-110 (R5C1): tabla nueva AuditCapaPlanVersion con captura B2; la reconoce su trigger de captura.
  const [capaPlan] = await tx.$queryRaw<{present:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='AuditCapaPlanVersion' AND t.tgname='audit_b2_capture') AS present`;
  if (!capaPlan?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261019000100_audit_capa_plan_versions' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  // D-116: turno del evento en Desviaciones; solo amplía la política de captura.
  const [deviationShift] = version?.capture
    ? await tx.$queryRaw<{present:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "AuditCaptureFieldPolicy" WHERE "entityType"='Deviation' AND "fieldPath"='shift') AS present`
    : [{ present: false }];
  if (!deviationShift?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261020000100_deviation_shift' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  // D-118: responsables de las funciones de PNT; solo amplía la política de captura.
  const [pntAssignments] = version?.capture
    ? await tx.$queryRaw<{present:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "AuditCaptureFieldPolicy" WHERE "entityType"='ControlledDocumentRevision' AND "fieldPath"='preparationResponsibleUserId') AS present`
    : [{ present: false }];
  if (!pntAssignments?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261027000100_pnt_assignments' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  // D-122: modelos de Control de cambios, tabla de configuración capturada como AlertRule.
  const [changeModels] = version?.capture
    ? await tx.$queryRaw<{present:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "AuditCaptureTablePolicy" WHERE "entityType"='ChangeControlModel') AS present`
    : [{ present: false }];
  if (!changeModels?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261029000100_change_control_models' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  // D-123: herramientas de investigación de Desviaciones; solo amplía la política de captura.
  const [deviationTools] = version?.capture
    ? await tx.$queryRaw<{present:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "AuditCaptureFieldPolicy" WHERE "entityType"='Deviation' AND "fieldPath"='investigationTools') AS present`
    : [{ present: false }];
  if (!deviationTools?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261029000200_deviation_investigation_tools' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  // D-127: tablas de los textos largos de Desviaciones; solo amplía la política de captura.
  const [deviationTextTables] = version?.capture
    ? await tx.$queryRaw<{present:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "AuditCaptureFieldPolicy" WHERE "entityType"='Deviation' AND "fieldPath"='textTables') AS present`
    : [{ present: false }];
  if (!deviationTextTables?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261030000100_deviation_text_tables' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  // D-127: tablas de los textos largos de CAPA y Controles de cambios; solo amplía la política de captura.
  const [capaChangeTextTables] = version?.capture
    ? await tx.$queryRaw<{present:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "AuditCaptureFieldPolicy" WHERE "entityType"='ChangeControl' AND "fieldPath"='textTables') AS present`
    : [{ present: false }];
  if (!capaChangeTextTables?.present && version?.migrations) {
    const [installed] = await tx.$queryRaw<{count:bigint}[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE migration_name='20261031000100_capa_change_text_tables' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    if (installed?.count) throw new AuditEngineError("PROTECTION");
  }
  const contract = capaChangeTextTables?.present ? capaChangeTextTablesContract : deviationTextTables?.present ? deviationTextTablesContract : deviationTools?.present ? deviationToolsContract : changeModels?.present ? changeModelsContract : pntAssignments?.present ? pntAssignmentsContract : deviationShift?.present ? deviationShiftContract : capaPlan?.present ? capaPlanContract : responsibleUsers?.present ? responsibleUsersContract : additionalLots?.present ? additionalLotsContract : rootCause?.present ? rootCauseContract : oosSigned?.present ? oosSignedContract : oosDocuments?.present ? oosDocumentsContract : oos?.present ? oosContract : review?.present ? cContract : critical?.present ? criticalContract : version?.staging ? stagingContract : version?.documents ? documentContract : version?.composition ? integrationContract : version?.capture ? captureContract : version?.present ? b2Contract : b1Contract;
  const guardTables = version?.present && "guardTables" in contract ? contract.guardTables : [];
  const tables = await tx.$queryRaw<{ name: string; owner: string }[]>`SELECT c.relname AS name,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(${contract.tables}::text[])`;
  if (tables.length !== contract.tables.length || new Set(tables.map(t=>t.owner)).size !== 1) throw new AuditEngineError("PROTECTION");
  const functions = await tx.$queryRaw<{ name: string; body: string; definer: boolean; config: string[] | null; owner: string; publicExecute: boolean; arguments:string }[]>`SELECT p.proname AS name,p.prosrc AS body,p.prosecdef AS definer,p.proconfig AS config,pg_get_userbyid(p.proowner) AS owner,oidvectortypes(p.proargtypes) AS arguments,EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS "publicExecute" FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE 'covex_audit_%' OR p.proname LIKE 'covex_b2_%' OR p.proname LIKE 'covex_c_%')`;
  if (functions.length !== Object.keys(contract.functions).length) throw new AuditEngineError("PROTECTION");
  for (const [name, expected] of Object.entries(contract.functions)) {
    const actual = functions.find(f=>f.name===name);
    if (!actual || createHash("sha256").update(actual.body).digest("hex")!==expected.sha256 || actual.definer!==expected.definer || actual.owner!==tables[0].owner || actual.publicExecute || actual.config?.join()!=="search_path=pg_catalog, public") throw new AuditEngineError("PROTECTION");
    if ("arguments" in expected && actual.arguments!==expected.arguments) throw new AuditEngineError("PROTECTION");
  }
  const triggers = await tx.$queryRaw<{ name: string; table: string; function: string; enabled: string; type: number; deferred: boolean; deferrable: boolean }[]>`SELECT t.tgname AS name,c.relname AS "table",p.proname AS function,t.tgenabled::text AS enabled,t.tgtype::integer AS type,t.tginitdeferred AS deferred,t.tgdeferrable AS deferrable FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid WHERE n.nspname='public' AND (c.relname=ANY(${contract.tables}::text[]) OR c.relname=ANY(${guardTables}::text[]) AND t.tgname LIKE 'audit_b2_%') AND NOT t.tgisinternal`;
  if (triggers.length!==contract.triggers.length) throw new AuditEngineError("PROTECTION");
  for (const expected of contract.triggers) {
    const actual = triggers.find(t=>t.name===expected.name && t.table===expected.table);
    if (!actual || actual.enabled!=="O" || actual.function!==expected.function || actual.type!==expected.type || actual.deferred!==expected.deferred || actual.deferrable!==expected.deferred) throw new AuditEngineError("PROTECTION");
  }
  if (version?.capture) {
    const [metadata] = await tx.$queryRaw<{ policy: unknown }[]>`SELECT jsonb_agg(jsonb_build_object('entityType',t."entityType",'primaryKey',t."primaryKey",'rootPaths',t."rootPaths",'captureMode',t."captureMode",'fields',
      (SELECT jsonb_agg(jsonb_build_object('fieldPath',f."fieldPath",'valueType',f."valueType",'transform',f.transform,'critical',f.critical) ORDER BY f."fieldPath") FROM "AuditCaptureFieldPolicy" f WHERE f."entityType"=t."entityType")) ORDER BY t."entityType") AS policy FROM "AuditCaptureTablePolicy" t`;
    const metadataContract = capaChangeTextTables?.present ? capaChangeTextTablesContract : deviationTextTables?.present ? deviationTextTablesContract : deviationTools?.present ? deviationToolsContract : changeModels?.present ? changeModelsContract : pntAssignments?.present ? pntAssignmentsContract : deviationShift?.present ? deviationShiftContract : capaPlan?.present ? capaPlanContract : responsibleUsers?.present ? responsibleUsersContract : additionalLots?.present ? additionalLotsContract : rootCause?.present ? rootCauseContract : oosSigned?.present ? oosSignedContract : oosDocuments?.present ? oosDocumentsContract : oos?.present ? oosContract : version?.staging ? stagingContract : version?.documents ? documentContract : captureContract;
    if (createHash("sha256").update(canonicalAuditJson(metadata?.policy)).digest("hex")!==metadataContract.capturePolicySha256) throw new AuditEngineError("PROTECTION");
  }
}

export async function assertAuditApplicationRole(tx: Prisma.TransactionClient) {
  const protectedTables = cContract.tables.filter(table => table!=="AuditPilotRecord");
  const [result] = await tx.$queryRaw<{ unsafe: boolean }[]>`SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolcreaterole)) OR has_schema_privilege(current_user,'public','CREATE') OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(${protectedTables}::text[]) AND (pg_has_role(current_user,c.relowner,'USAGE') OR has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE') OR has_any_column_privilege(current_user,c.oid,'INSERT') OR has_any_column_privilege(current_user,c.oid,'UPDATE') OR c.relname=ANY(${criticalContract.privateTables}::text[]) AND has_any_column_privilege(current_user,c.oid,'SELECT'))) AS unsafe`;
  if (!result || result.unsafe) throw new AuditEngineError("PROTECTION");
}

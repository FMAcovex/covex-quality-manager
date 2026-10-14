BEGIN;
-- A row's confirmed business receipt is relevant persisted data, not a secret.
INSERT INTO "AuditCaptureFieldPolicy" VALUES ('ControlledDocumentImportRow','result','JSON','VALUE',false);
-- Bounded technical staging cleanup, separate from successful business events.
-- No retention period, corporate acceptance or technical account is installed.
CREATE TABLE "AuditTechnicalContext" (
 "transactionId" BIGINT PRIMARY KEY, "backendPid" INTEGER NOT NULL,
 "databasePrincipal" TEXT NOT NULL, "batchId" TEXT NOT NULL,
 "triggeredByUserId" UUID NOT NULL, "triggeredByName" TEXT NOT NULL,
 cutoff TIMESTAMPTZ(6) NOT NULL, "retainedConfirmedRows" INTEGER NOT NULL
);
CREATE TABLE "AuditTechnicalEvent" (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), channel TEXT NOT NULL CHECK(channel='PNT_STAGING'),
 operation TEXT NOT NULL CHECK(operation='EXPIRED'), "actorKind" TEXT NOT NULL CHECK("actorKind"='SYSTEM'),
 "triggeredByUserId" UUID NOT NULL REFERENCES "AuthUser"(id) ON DELETE RESTRICT,
 "triggeredByName" TEXT NOT NULL, "batchId" TEXT NOT NULL REFERENCES "ControlledDocumentImportBatch"(id) ON DELETE RESTRICT,
 "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
 "deletedPendingRows" INTEGER NOT NULL CHECK("deletedPendingRows">=0),
 "retainedConfirmedRows" INTEGER NOT NULL CHECK("retainedConfirmedRows">=0)
);
CREATE INDEX ON "AuditTechnicalEvent"("occurredAt",id);
CREATE INDEX ON "AuditTechnicalEvent"("batchId");

CREATE FUNCTION covex_b2_staging_mutation(entity_type TEXT, verb TEXT, before_value JSONB, after_value JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE context public."AuditTechnicalContext";
BEGIN
 SELECT * INTO context FROM public."AuditTechnicalContext" WHERE "transactionId"=txid_current()
 AND "backendPid"=pg_backend_pid() AND "databasePrincipal"=session_user;
 IF NOT FOUND THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current()) THEN RAISE EXCEPTION 'Technical/business contexts cannot overlap'; END IF;
 IF entity_type='ControlledDocumentImportRow' AND verb='DELETE' AND before_value->>'batchId'=context."batchId"
 AND before_value->'result'='null'::jsonb THEN RETURN true; END IF;
 IF entity_type='ControlledDocumentImportBatch' AND verb='UPDATE' AND before_value->>'id'=context."batchId"
 AND before_value->>'state' IN ('PENDING','PARTIAL') AND (before_value->>'expiresAt')::timestamptz<=context.cutoff
 AND after_value->>'state'='EXPIRED' AND (after_value->>'version')::integer=(before_value->>'version')::integer+1
 AND before_value-'state'-'version'=after_value-'state'-'version' THEN RETURN true; END IF;
 IF entity_type='ControlledDocumentImportEvent' AND verb='INSERT' AND after_value->>'batchId'=context."batchId"
 AND after_value->>'action'='EXPIRED' AND after_value->>'actor'='Retención de staging'
 AND after_value->'authenticatedUserId'='null'::jsonb
 AND after_value->'detail'=jsonb_build_object('retainedConfirmedRows',context."retainedConfirmedRows") THEN RETURN true; END IF;
 RAISE EXCEPTION 'Technical staging mutation outside exact scope';
END;
$$;

CREATE FUNCTION covex_b2_technical_event_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public."AuditTechnicalContext" c WHERE c."transactionId"=txid_current()
 AND c."backendPid"=pg_backend_pid() AND c."databasePrincipal"=session_user AND c."batchId"=NEW."batchId"
 AND c."triggeredByUserId"=NEW."triggeredByUserId" AND c."triggeredByName"=NEW."triggeredByName"
 AND c."retainedConfirmedRows"=NEW."retainedConfirmedRows" AND NEW."occurredAt">=c.cutoff) THEN RAISE EXCEPTION 'Private technical lease required'; END IF;
 RETURN NEW;
END;
$$;
CREATE FUNCTION covex_b2_technical_context_complete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public."AuditTechnicalContext" WHERE "transactionId"=NEW."transactionId") THEN RAISE EXCEPTION 'Technical context must be closed before commit'; END IF;
 RETURN NULL;
END;
$$;
CREATE FUNCTION covex_b2_expire_staging(triggered_by UUID) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE batch public."ControlledDocumentImportBatch"; actor_name TEXT; cutoff TIMESTAMPTZ:=clock_timestamp();
 retained INTEGER; removed INTEGER; expired INTEGER:=0;
BEGIN
 IF EXISTS(SELECT 1 FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current())
 OR EXISTS(SELECT 1 FROM public."AuditTechnicalContext" WHERE "transactionId"=txid_current()) THEN RAISE EXCEPTION 'Independent technical operation required'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND (rolsuper OR rolcreaterole))
 OR has_schema_privilege(session_user,'public','CREATE') OR EXISTS(
 SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 AND c.relname IN ('AuditTechnicalContext','AuditTechnicalEvent') AND
 (pg_has_role(session_user,c.relowner,'USAGE') OR has_table_privilege(session_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
 OR has_any_column_privilege(session_user,c.oid,'INSERT') OR has_any_column_privilege(session_user,c.oid,'UPDATE')
 OR c.relname='AuditTechnicalContext' AND has_any_column_privilege(session_user,c.oid,'SELECT')))
 THEN RAISE EXCEPTION 'Separate minimal technical caller required'; END IF;
 SELECT "displayName" INTO actor_name FROM public."AuthUser" WHERE id=triggered_by AND active AND "authorizedAt" IS NOT NULL FOR SHARE;
 IF actor_name IS NULL THEN RAISE EXCEPTION 'Active admitted triggering user required'; END IF;
 FOR batch IN SELECT * FROM public."ControlledDocumentImportBatch" WHERE state IN ('PENDING','PARTIAL')
 AND "expiresAt"<=cutoff ORDER BY id FOR UPDATE LOOP
   SELECT count(*) INTO retained FROM public."ControlledDocumentImportRow" WHERE "batchId"=batch.id AND result IS NOT NULL;
   INSERT INTO public."AuditTechnicalContext" VALUES(txid_current(),pg_backend_pid(),session_user,batch.id,triggered_by,actor_name,cutoff,retained);
   DELETE FROM public."ControlledDocumentImportRow" WHERE "batchId"=batch.id AND result IS NULL;
   GET DIAGNOSTICS removed=ROW_COUNT;
   UPDATE public."ControlledDocumentImportBatch" SET state='EXPIRED',version=version+1 WHERE id=batch.id;
   INSERT INTO public."ControlledDocumentImportEvent"(id,"batchId",action,actor,detail)
    VALUES(gen_random_uuid()::text,batch.id,'EXPIRED','Retención de staging',jsonb_build_object('retainedConfirmedRows',retained));
   INSERT INTO public."AuditTechnicalEvent"(channel,operation,"actorKind","triggeredByUserId","triggeredByName","batchId","deletedPendingRows","retainedConfirmedRows")
    VALUES('PNT_STAGING','EXPIRED','SYSTEM',triggered_by,actor_name,batch.id,removed,retained);
   DELETE FROM public."AuditTechnicalContext" WHERE "transactionId"=txid_current();
   expired:=expired+1;
 END LOOP;
 RETURN expired;
END;
$$;

-- BUSINESS_MINIMAL_ROLE_EXTENSION
CREATE OR REPLACE FUNCTION covex_b2_begin(actor_id UUID, request_id UUID, request_digest TEXT, operation_code TEXT, access_module TEXT, access_permission TEXT, operation_reason TEXT)
RETURNS TABLE(operation_id UUID,replayed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous public."AuditOperation"; actor_name TEXT; target RECORD;
BEGIN
  -- Deliberate preparation boundary, not a deploy-time/HTTP feature flag.
  IF current_database() !~ '^covex_phase4b1_test_[a-z0-9_]+$' THEN RAISE EXCEPTION 'Complete corporate policy is not prepared and active'; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND (rolsuper OR rolcreaterole)) OR has_schema_privilege(session_user,'public','CREATE') OR EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('AuditOperation','AuditEvent','AuditBusinessContext','AuditMutationWitness','AuditCaptureTablePolicy','AuditCaptureFieldPolicy','AuditRootBinding','AuditAdministrationRoot','AuditEventAdditionalTarget','AuditAggregateCursor','AuditOperationTarget','AuditRuntimeContext','AuditPolicyRequirement','AuditOperationEvidence','AuditCommandResult','SignedDocumentCustody','AuditTechnicalContext','AuditTechnicalEvent') AND
    (pg_has_role(session_user,c.relowner,'USAGE') OR has_table_privilege(session_user,c.oid,'DELETE,TRUNCATE') OR has_any_column_privilege(session_user,c.oid,'INSERT') OR has_any_column_privilege(session_user,c.oid,'UPDATE') OR c.relname IN ('AuditRuntimeContext','AuditBusinessContext','AuditMutationWitness','AuditRootBinding','AuditTechnicalContext') AND has_any_column_privilege(session_user,c.oid,'SELECT'))
  ) THEN RAISE EXCEPTION 'Separate minimal application role required'; END IF;
  IF EXISTS(SELECT 1 FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current()) OR EXISTS(SELECT 1 FROM public."AuditRuntimeContext" WHERE "transactionId"=txid_current()) THEN RAISE EXCEPTION 'Nested business operation refused'; END IF;
  IF actor_id IS NULL OR request_id IS NULL OR request_digest IS NULL OR request_digest !~ '^[a-f0-9]{64}$' OR operation_code IS NULL OR operation_code !~ '^(DV0[1-8]|CA0[1-8]|CC0[1-7]|RC0[1-7]|DE0[1-7]|AU0[1-9]|PN0[1-6]|TR0[1-57])$' OR
    access_module IS NULL OR NOT EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='AccessModule' AND e.enumlabel=access_module) OR
    access_permission IS NULL OR access_permission IN ('READ','DOWNLOAD','EXPORT') OR NOT EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='AccessPermission' AND e.enumlabel=access_permission) OR
    operation_reason IS NOT NULL AND length(btrim(operation_reason)) NOT BETWEEN 1 AND 20000 THEN RAISE EXCEPTION 'Invalid business command'; END IF;
  IF substring(operation_code FROM 1 FOR 2)<>'TR' AND access_module<>(CASE substring(operation_code FROM 1 FOR 2)
    WHEN 'DV' THEN 'DEVIATION' WHEN 'CA' THEN 'CAPA' WHEN 'CC' THEN 'CHANGE_CONTROL' WHEN 'RC' THEN 'COMPLAINT' WHEN 'DE' THEN 'RETURN' WHEN 'AU' THEN 'AUDIT' WHEN 'PN' THEN 'PNT' END) THEN RAISE EXCEPTION 'Policy module mismatch'; END IF;
  SELECT "displayName" INTO actor_name FROM public."AuthUser" WHERE id=actor_id AND active AND "authorizedAt" IS NOT NULL FOR SHARE;
  IF actor_name IS NULL THEN RAISE EXCEPTION 'Active admitted actor required'; END IF;
  -- Scope is resolved from persisted roots at commit, never a client claim.
  IF NOT EXISTS(SELECT 1 FROM public."AuthRolePermission" p JOIN public."AuthRole" r ON r.id=p."roleId" JOIN public."AuthUserRole" u ON u."roleId"=r.id WHERE u."userId"=actor_id AND r."qaAcceptedAt" IS NOT NULL AND p.module::text=access_module AND p.permission::text=access_permission) THEN RAISE EXCEPTION 'Business grant required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('COVEX-B2:'||actor_id::text||':'||request_id::text,0));
  SELECT * INTO previous FROM public."AuditOperation" WHERE "actorUserId"=actor_id AND origin='QMS_SERVER' AND "requestId"=request_id;
  IF FOUND THEN
    IF previous."requestDigest"<>request_digest OR previous.operation<>operation_code OR previous."accessModule"<>access_module OR previous."accessPermission"<>access_permission THEN RAISE EXCEPTION 'Business request conflict'; END IF;
    FOR target IN SELECT "rootKey" FROM public."AuditOperationTarget" WHERE "operationId"=previous.id ORDER BY "rootKey" LOOP
      PERFORM public.covex_b2_authorize_root(actor_id,access_module,access_permission,target."rootKey");
    END LOOP;
    RETURN QUERY SELECT previous.id,true; RETURN;
  END IF;
  INSERT INTO public."AuditBusinessContext" VALUES(txid_current(),pg_backend_pid(),session_user,actor_id,actor_name,request_id,request_digest,operation_code,access_module,access_permission,operation_reason,NULL);
  RETURN QUERY SELECT NULL::uuid,false;
END;
$$;

-- REQUIRED_GUARD_REPLACEMENT
CREATE OR REPLACE FUNCTION covex_b2_required_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE operation_id UUID;
BEGIN
  IF public.covex_b2_staging_mutation(TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END) THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF current_database() ~ '^covex_phase4b1_test_[a-z0-9_]+$' AND EXISTS(
    SELECT 1 FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current() AND "backendPid"=pg_backend_pid() AND "databasePrincipal"=session_user) THEN
    PERFORM public.covex_b2_before(TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public."AuditPolicyRequirement" WHERE "policyVersion"='QMS_B2_V1') THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  -- Corporate profile discovery/refresh is technical; admission/disable is not.
  IF TG_TABLE_NAME='AuthUser' THEN
    IF TG_OP='INSERT' AND NEW."authorizedAt" IS NULL THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' AND NEW.active IS NOT DISTINCT FROM OLD.active AND NEW."authorizedAt" IS NOT DISTINCT FROM OLD."authorizedAt" THEN RETURN NEW; END IF;
    IF TG_OP='DELETE' AND OLD."authorizedAt" IS NULL THEN RETURN OLD; END IF;
  END IF;
  -- A failed import marker does not report a successful GMP mutation.
  IF TG_TABLE_NAME='ControlledDocumentImportEvent' THEN
    IF TG_OP='INSERT' AND NEW.action='ERROR' AND NEW.detail='{"category":"CONFIRMATION_REJECTED_OR_ROLLED_BACK"}'::jsonb THEN RETURN NEW; END IF;
  END IF;
  -- Keep the isolated B1 pilot operational without admitting business writes.
  IF TG_TABLE_NAME='ChangeHistory' THEN
    IF TG_OP='INSERT' AND NEW."fieldPath"='__synthetic_audit_pilot__' AND current_database() ~ '^covex_phase4b1_test_[a-z0-9_]+$' THEN
      operation_id:=public.covex_audit_context();
      IF EXISTS(SELECT 1 FROM public."AuditOperation" o JOIN public."AuditOperationTarget" t ON t."operationId"=o.id
        WHERE o.id=operation_id AND o.origin='SYNTHETIC_PILOT' AND o."policyVersion"='SYNTHETIC_PILOT_V1' AND t."rootKey"='QMS_RECORD:'||NEW."qmsRecordId") THEN RETURN NEW; END IF;
    END IF;
  END IF;
  -- A later complete B2 policy must explicitly replace this preparation guard.
  -- There is no flag/GUC/context-only escape and no partially active GMP policy.
  RAISE EXCEPTION USING ERRCODE='P4001',MESSAGE='Required business audit policy is not prepared and active';
END;
$$;

CREATE TRIGGER audit_b2_technical_event_guard BEFORE INSERT ON "AuditTechnicalEvent" FOR EACH ROW EXECUTE FUNCTION covex_b2_technical_event_guard();
CREATE TRIGGER audit_b2_technical_event_immutable BEFORE UPDATE OR DELETE ON "AuditTechnicalEvent" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_technical_event_no_truncate BEFORE TRUNCATE ON "AuditTechnicalEvent" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
CREATE CONSTRAINT TRIGGER audit_b2_technical_context_complete AFTER INSERT ON "AuditTechnicalContext" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION covex_b2_technical_context_complete();
DO $$
DECLARE owner_role TEXT:=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public."AuditOperation"'::regclass)); function_id regprocedure;
BEGIN
 REVOKE ALL ON "AuditTechnicalContext","AuditTechnicalEvent" FROM PUBLIC;
 EXECUTE format('ALTER TABLE public."AuditTechnicalContext" OWNER TO %I',owner_role);
 EXECUTE format('ALTER TABLE public."AuditTechnicalEvent" OWNER TO %I',owner_role);
 EXECUTE format('GRANT SELECT,UPDATE,DELETE ON public."ControlledDocumentImportBatch",public."ControlledDocumentImportRow" TO %I',owner_role);
 EXECUTE format('GRANT INSERT ON public."ControlledDocumentImportEvent" TO %I',owner_role);
 FOR function_id IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'covex_b2_%' LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',function_id);
   EXECUTE format('ALTER FUNCTION %s OWNER TO %I',function_id,owner_role);
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='covex_app') THEN
   REVOKE ALL ON "AuditTechnicalContext","AuditTechnicalEvent" FROM covex_app;
   GRANT SELECT ON "AuditTechnicalEvent" TO covex_app;
   GRANT EXECUTE ON FUNCTION covex_b2_expire_staging(UUID) TO covex_app;
 END IF;
END;
$$;
COMMIT;

BEGIN;
ALTER TABLE "AuditOperation" DROP CONSTRAINT "AuditOperation_reason_check";
ALTER TABLE "AuditOperation" ADD CONSTRAINT "AuditOperation_reason_check" CHECK (
 ("schemaVersion"=1 AND reason IS NOT NULL AND length(btrim(reason)) BETWEEN 1 AND 500) OR
 ("schemaVersion"=2 AND (reason IS NULL OR length(btrim(reason)) BETWEEN 1 AND 20000))
);
CREATE OR REPLACE FUNCTION covex_b2_begin(actor_id UUID, request_id UUID, request_digest TEXT, operation_code TEXT, access_module TEXT, access_permission TEXT, operation_reason TEXT)
RETURNS TABLE(operation_id UUID,replayed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous public."AuditOperation"; actor_name TEXT; target RECORD;
BEGIN
  -- Deliberate preparation boundary, not a deploy-time/HTTP feature flag.
  IF current_database() !~ '^covex_phase4b1_test_[a-z0-9_]+$' THEN RAISE EXCEPTION 'Complete corporate policy is not prepared and active'; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND (rolsuper OR rolcreaterole)) OR has_schema_privilege(session_user,'public','CREATE') OR EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('AuditOperation','AuditEvent','AuditBusinessContext','AuditMutationWitness','AuditCaptureTablePolicy','AuditCaptureFieldPolicy','AuditRootBinding','AuditAdministrationRoot','AuditEventAdditionalTarget','AuditAggregateCursor','AuditOperationTarget','AuditRuntimeContext','AuditPolicyRequirement','AuditOperationEvidence') AND
    (pg_has_role(session_user,c.relowner,'USAGE') OR has_table_privilege(session_user,c.oid,'DELETE,TRUNCATE') OR has_any_column_privilege(session_user,c.oid,'INSERT') OR has_any_column_privilege(session_user,c.oid,'UPDATE'))
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
-- No activation or retrospective outcome is inserted.
ALTER TABLE "AuditBusinessContext" ADD COLUMN "authorizationClaims" JSONB NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN "commandOutcome" JSONB;
CREATE TABLE "AuditCommandResult" (
 "operationId" UUID PRIMARY KEY REFERENCES "AuditOperation"(id) ON DELETE RESTRICT,
 outcome JSONB NOT NULL CHECK (jsonb_typeof(outcome)='object' AND octet_length(outcome::text)<=65536),
 "authorizationClaims" JSONB NOT NULL CHECK(jsonb_typeof("authorizationClaims")='array'),
 "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION covex_b2_check_claims(actor_id UUID, claims JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE claim JSONB; department_ids TEXT[];
BEGIN
 IF jsonb_typeof(claims)<>'array' OR jsonb_array_length(claims)>512 THEN RAISE EXCEPTION 'Invalid authorization claims'; END IF;
 -- Lock observed authorization rows. A revoked row in a SERIALIZABLE snapshot
 -- cannot silently validate; PostgreSQL aborts that transaction instead.
 PERFORM p.id FROM public."AuthRolePermission" p JOIN public."AuthRole" r ON r.id=p."roleId"
 JOIN public."AuthUserRole" u ON u."roleId"=r.id WHERE u."userId"=actor_id FOR SHARE OF p,r,u;
 PERFORM "userId" FROM public."AuthUserDepartment" WHERE "userId"=actor_id FOR SHARE;
 PERFORM id FROM public."AuthRecordAssignment" WHERE "userId"=actor_id FOR SHARE;
 FOR claim IN SELECT value FROM jsonb_array_elements(claims) LOOP
   IF jsonb_typeof(claim)<>'object' OR claim->>'module' IS NULL OR claim->>'permission' IS NULL OR
    NOT EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='AccessModule' AND e.enumlabel=claim->>'module') OR
    NOT EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='AccessPermission' AND e.enumlabel=claim->>'permission') OR
    jsonb_typeof(coalesce(claim->'resource','{}'::jsonb))<>'object' THEN RAISE EXCEPTION 'Invalid authorization claim'; END IF;
   SELECT coalesce(array_agg(value),'{}'::text[]) INTO department_ids FROM jsonb_array_elements_text(coalesce(claim->'resource'->'departmentIds','[]'::jsonb));
   PERFORM public.covex_b2_permission(actor_id,claim->>'module',claim->>'permission',claim->'resource'->>'id',department_ids);
 END LOOP;
END;
$$;
CREATE FUNCTION covex_b2_command_outcome(command_outcome JSONB, claims JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE context public."AuditBusinessContext";
BEGIN
 SELECT * INTO context FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current()
 AND "backendPid"=pg_backend_pid() AND "databasePrincipal"=session_user;
 IF NOT FOUND OR context."commandOutcome" IS NOT NULL OR jsonb_typeof(command_outcome)<>'object'
 OR command_outcome->>'kind' NOT IN ('RETURN','REDIRECT') OR octet_length(command_outcome::text)>65536 THEN RAISE EXCEPTION 'Invalid command outcome'; END IF;
 PERFORM public.covex_b2_check_claims(context."actorUserId",claims);
 UPDATE public."AuditBusinessContext" SET "commandOutcome"=command_outcome,"authorizationClaims"=claims WHERE "transactionId"=txid_current();
END;
$$;
CREATE OR REPLACE FUNCTION covex_b2_finish() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE context public."AuditBusinessContext"; witness public."AuditMutationWitness"; actual JSONB; count_events INTEGER; target RECORD; root TEXT;
BEGIN
  SELECT * INTO context FROM public."AuditBusinessContext" WHERE "transactionId"=NEW."transactionId";
  IF NOT FOUND OR context."transactionId"<>txid_current() OR context."backendPid"<>pg_backend_pid() OR context."databasePrincipal"<>session_user THEN RAISE EXCEPTION 'Business context lost'; END IF;
  PERFORM public.covex_b2_check_claims(context."actorUserId",context."authorizationClaims");
  FOR witness IN SELECT * FROM public."AuditMutationWitness" WHERE "transactionId"=context."transactionId" LOOP
    IF NOT witness.completed OR witness.expected IS NULL THEN RAISE EXCEPTION 'Independent capture witness incomplete'; END IF;
    -- A no-op still requires the actual write scope, even though no business
    -- event/sequence is emitted. Technical timestamps are not an access bypass.
    FOREACH root IN ARRAY witness."beforeRoots" LOOP
      PERFORM public.covex_b2_authorize_root(context."actorUserId",context."accessModule",context."accessPermission",root);
    END LOOP;
    SELECT coalesce(jsonb_agg(jsonb_build_object('fieldPath',e."fieldPath",'oldValue',e."oldValue",'newValue',e."newValue",'roots',
      (SELECT jsonb_agg(key ORDER BY key) FROM (SELECT e."rootKey" AS key UNION ALL SELECT a."rootKey" FROM public."AuditEventAdditionalTarget" a WHERE a."eventId"=e.id) r)) ORDER BY e."fieldPath"),'[]'::jsonb)
      INTO actual FROM public."AuditEvent" e WHERE e."mutationId"=witness.id AND e."operationId"=context."operationId" AND e."entityType"=witness."entityType" AND e."entityId"=witness."entityKey";
    IF actual IS DISTINCT FROM witness.expected THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Mandatory OLD/NEW capture mismatch'; END IF;
  END LOOP;
  IF context."operationId" IS NOT NULL THEN
    SELECT count(*) INTO count_events FROM public."AuditEvent" WHERE "operationId"=context."operationId";
    IF count_events=0 OR count_events<>(SELECT coalesce(sum(jsonb_array_length(expected)),0) FROM public."AuditMutationWitness" WHERE "transactionId"=context."transactionId") OR
      (SELECT max("eventOrdinal") FROM public."AuditEvent" WHERE "operationId"=context."operationId")<>count_events OR
      EXISTS(SELECT 1 FROM public."AuditEvent" e WHERE e."operationId"=context."operationId" AND NOT EXISTS(SELECT 1 FROM public."AuditMutationWitness" w WHERE w.id=e."mutationId" AND w."transactionId"=context."transactionId")) THEN RAISE EXCEPTION 'Business capture coverage missing'; END IF;
    IF public.covex_audit_context()<>context."operationId" THEN RAISE EXCEPTION 'Business operation lease lost'; END IF;
    FOR target IN SELECT "rootKey" FROM public."AuditOperationTarget" WHERE "operationId"=context."operationId" ORDER BY "rootKey" LOOP
      PERFORM public.covex_b2_authorize_root(context."actorUserId",context."accessModule",context."accessPermission",target."rootKey");
    END LOOP;
    -- Keep source snapshots/history once, through actual typed foreign keys.
    FOR witness IN SELECT w.* FROM public."AuditMutationWitness" w JOIN public."AuditCaptureTablePolicy" p ON p."entityType"=w."entityType" WHERE w."transactionId"=context."transactionId" AND p."captureMode"='EVIDENCE' AND w.verb='INSERT' LOOP
      INSERT INTO public."AuditOperationEvidence" VALUES(gen_random_uuid(),context."operationId",
        CASE WHEN witness."entityType"='ChangeHistory' THEN witness."entityKey" END,
        CASE WHEN witness."entityType"='ConfigurationChange' THEN witness."entityKey" END,
        CASE WHEN witness."entityType"='AuthAuthorizationChange' THEN witness."entityKey"::uuid END,
        CASE WHEN witness."entityType"='AuditPlanChange' THEN witness."entityKey" END,
        CASE WHEN witness."entityType"='ControlledDocumentChange' THEN witness."entityKey" END);
    END LOOP;
    IF context."commandOutcome" IS NOT NULL THEN
      INSERT INTO public."AuditCommandResult"("operationId",outcome,"authorizationClaims") VALUES(context."operationId",context."commandOutcome",context."authorizationClaims");
    END IF;
    DELETE FROM public."AuditRuntimeContext" WHERE "operationId"=context."operationId";
  END IF;
  DELETE FROM public."AuditMutationWitness" WHERE "transactionId"=context."transactionId";
  DELETE FROM public."AuditRootBinding" WHERE "transactionId"=context."transactionId";
  DELETE FROM public."AuditBusinessContext" WHERE "transactionId"=context."transactionId";
  RETURN NULL;
END;
$$;


CREATE TRIGGER audit_b2_immutable BEFORE UPDATE OR DELETE ON "AuditCommandResult" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE OR REPLACE FUNCTION covex_b2_before(entity_type TEXT, verb TEXT, before_value JSONB, after_value JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE context public."AuditBusinessContext"; roots TEXT[]; entity_key TEXT; critical_change BOOLEAN; draft BOOLEAN:=false; root TEXT; parent_status TEXT; domain_table TEXT;
BEGIN
  SELECT * INTO context FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current() AND "backendPid"=pg_backend_pid() AND "databasePrincipal"=session_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Private business context required'; END IF;
  IF after_value->'fileData' IS NOT NULL AND after_value->'fileData'<>'null'::jsonb THEN
    IF coalesce(after_value->>'checksum',after_value->>'sha256') IS DISTINCT FROM encode(sha256((after_value->>'fileData')::bytea),'hex') THEN RAISE EXCEPTION 'Original document checksum mismatch'; END IF;
  END IF;
  -- While D05 supersession is unfinished, an audited operation must not destroy
  -- an existing original. Unrequired legacy behavior is not changed by install.
  IF before_value->'fileData' IS NOT NULL AND before_value->'fileData'<>'null'::jsonb AND before_value->'fileData' IS DISTINCT FROM after_value->'fileData' THEN RAISE EXCEPTION 'Original documentary supersession is not yet available'; END IF;
  IF verb<>'INSERT' AND EXISTS(SELECT 1 FROM public."AuditCaptureTablePolicy" WHERE "entityType"=entity_type AND "captureMode"='EVIDENCE') THEN RAISE EXCEPTION 'Existing operational evidence is immutable in audited scope'; END IF;
  -- Authorize the observed old scope before any department or relationship
  -- mutation, as well as the final targets/extra claims checked at commit.
  IF before_value IS NOT NULL THEN
    FOREACH root IN ARRAY public.covex_b2_roots(entity_type,before_value) LOOP
      PERFORM public.covex_b2_authorize_root(context."actorUserId",context."accessModule",context."accessPermission",root);
    END LOOP;
  END IF;
  entity_key:=public.covex_b2_entity_key(entity_type,coalesce(before_value,after_value));
  IF verb='UPDATE' AND entity_key<>public.covex_b2_entity_key(entity_type,after_value) THEN RAISE EXCEPTION 'Business primary key is immutable'; END IF;
  roots:=public.covex_b2_roots(entity_type,before_value)||public.covex_b2_roots(entity_type,after_value);
  SELECT coalesce(array_agg(DISTINCT key ORDER BY key),ARRAY[]::text[]) INTO roots FROM unnest(roots) key;
  IF cardinality(roots)=0 THEN RAISE EXCEPTION 'Business roots required'; END IF;
  INSERT INTO public."AuditRootBinding" VALUES(txid_current(),entity_type,entity_key,roots) ON CONFLICT("transactionId","entityType","entityKey") DO UPDATE SET roots=EXCLUDED.roots;
  IF verb='UPDATE' THEN
    draft:=before_value->>'status'='DRAFT' OR before_value->>'administrativeStatus'='DRAFT';
    IF draft IS NULL THEN draft:=false; END IF;
    IF entity_type='FormFieldConfig' THEN SELECT status='DRAFT' INTO draft FROM public."FormVersion" WHERE id=before_value->>'formVersionId'; END IF;
    FOR root IN SELECT key FROM unnest(roots) key WHERE key LIKE 'QMS_RECORD:%' LOOP
      SELECT CASE "recordType" WHEN 'DEVIATION' THEN 'Deviation' WHEN 'CAPA' THEN 'Capa' WHEN 'CHANGE_CONTROL' THEN 'ChangeControl' WHEN 'COMPLAINT' THEN 'Complaint' WHEN 'RETURN' THEN 'ReturnRecord' WHEN 'AUDIT' THEN 'Audit' END INTO domain_table FROM public."QmsRecord" WHERE id=substring(root FROM 12);
      IF domain_table IS NOT NULL THEN
        EXECUTE format('SELECT to_jsonb(t)->>''status'' FROM public.%I t WHERE "qmsRecordId"=$1',domain_table) INTO parent_status USING substring(root FROM 12);
        draft:=draft OR parent_status='DRAFT';
      END IF;
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public."AuditCaptureFieldPolicy" p WHERE p."entityType"=entity_type AND p.critical AND (entity_type<>'AppParameter' OR before_value->>'key'='ALLOW_CLOSED_RECORD_EDIT') AND before_value->p."fieldPath" IS DISTINCT FROM after_value->p."fieldPath" AND
      before_value->p."fieldPath" IS NOT NULL AND before_value->p."fieldPath"<>'null'::jsonb AND coalesce(before_value->>p."fieldPath",'') NOT IN ('','UNKNOWN','PENDING','NOT_ASSESSED','NOT_EVALUATED','UNDETERMINED','UNVERIFIED')) INTO critical_change;
    IF critical_change AND NOT coalesce(draft,false) AND context.reason IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Reason required for established critical correction'; END IF;
    IF entity_type IN ('FormVersion','TemplateVersion') AND before_value->'isActive' IS DISTINCT FROM after_value->'isActive' AND context.reason IS NULL THEN RAISE EXCEPTION 'Reason required for official version activation/retirement'; END IF;
  END IF;
  INSERT INTO public."AuditMutationWitness" VALUES(gen_random_uuid(),txid_current(),entity_type,entity_key,verb,roots,NULL,false);
END;
$$;
CREATE TRIGGER audit_b2_no_truncate BEFORE TRUNCATE ON "AuditCommandResult" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
DO $$
DECLARE owner_role TEXT:=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public."AuditOperation"'::regclass)); function_id regprocedure;
BEGIN
 REVOKE ALL ON "AuditCommandResult" FROM PUBLIC;
 EXECUTE format('ALTER TABLE public."AuditCommandResult" OWNER TO %I',owner_role);
 -- PostgreSQL row locks require UPDATE on at least one column. Only the
 -- private NOLOGIN journal owner receives this; application grants are unchanged.
 EXECUTE format('GRANT UPDATE(id) ON public."AuthRolePermission",public."AuthRecordAssignment" TO %I',owner_role);
 EXECUTE format('GRANT UPDATE("userId") ON public."AuthUserRole",public."AuthUserDepartment" TO %I',owner_role);
 FOR function_id IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('covex_b2_check_claims','covex_b2_command_outcome','covex_b2_finish') LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',function_id);
   EXECUTE format('ALTER FUNCTION %s OWNER TO %I',function_id,owner_role);
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='covex_app') THEN
  REVOKE ALL ON "AuditCommandResult" FROM covex_app;
  GRANT SELECT ON "AuditCommandResult" TO covex_app;
  GRANT EXECUTE ON FUNCTION covex_b2_command_outcome(JSONB,JSONB),covex_b2_check_claims(UUID,JSONB) TO covex_app;
 END IF;
END;
$$;
COMMIT;

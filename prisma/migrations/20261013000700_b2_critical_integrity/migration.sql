BEGIN;
ALTER TABLE "AuditMutationWitness" ADD COLUMN "requiresReason" BOOLEAN NOT NULL DEFAULT false;
-- Technical D03 proposal, not a formal GMP acceptance or activation.
CREATE TABLE "AuditRootMaturity" (
 "transactionId" BIGINT NOT NULL REFERENCES "AuditBusinessContext"("transactionId") ON DELETE RESTRICT,
 "rootKey" TEXT NOT NULL, module TEXT NOT NULL, "isDraft" BOOLEAN NOT NULL,
 PRIMARY KEY("transactionId","rootKey")
);
CREATE TABLE "AuditOperationAssessment" (
 "operationId" UUID PRIMARY KEY REFERENCES "AuditOperation"(id) ON DELETE RESTRICT,
 "policyVersion" TEXT NOT NULL CHECK("policyVersion"='QMS_B2_CRITICAL_TECHNICAL_V1'),
 "proposedCritical" BOOLEAN NOT NULL, "reasonRequired" BOOLEAN NOT NULL,
 "assessedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ON "AuditOperationAssessment"("proposedCritical","operationId");

CREATE FUNCTION covex_b2_observe_maturity(roots TEXT[], entity_type TEXT, row_value JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE root TEXT; root_module TEXT; domain_table TEXT; state TEXT;
BEGIN
 FOREACH root IN ARRAY roots LOOP
   IF EXISTS(SELECT 1 FROM public."AuditRootMaturity" WHERE "transactionId"=txid_current() AND "rootKey"=root) THEN CONTINUE; END IF;
   state:=NULL; root_module:=NULL;
   IF root LIKE 'QMS_RECORD:%' THEN
     SELECT "recordType"::text INTO root_module FROM public."QmsRecord" WHERE id=substring(root FROM 12);
     IF root_module IS NULL AND entity_type='QmsRecord' THEN root_module:=row_value->>'recordType'; END IF;
     domain_table:=CASE root_module WHEN 'DEVIATION' THEN 'Deviation' WHEN 'CAPA' THEN 'Capa' WHEN 'CHANGE_CONTROL' THEN 'ChangeControl' WHEN 'COMPLAINT' THEN 'Complaint' WHEN 'RETURN' THEN 'ReturnRecord' WHEN 'AUDIT' THEN 'Audit' END;
     IF domain_table IS NOT NULL THEN EXECUTE format('SELECT coalesce(to_jsonb(t)->>''status'',to_jsonb(t)->>''finalStatus'') FROM public.%I t WHERE "qmsRecordId"=$1',domain_table) INTO state USING substring(root FROM 12); END IF;
   ELSIF root LIKE 'PNT:%' THEN
     root_module:='PNT'; SELECT "administrativeStatus"::text INTO state FROM public."ControlledDocument" WHERE id=substring(root FROM 5);
   ELSE root_module:='SYSTEM'; state:='OPERATIONAL'; END IF;
   INSERT INTO public."AuditRootMaturity" VALUES(txid_current(),root,coalesce(root_module,'UNKNOWN'),coalesce(state='DRAFT',true));
 END LOOP;
END;
$$;
CREATE FUNCTION covex_b2_critical_mutation(entity_type TEXT, before_value JSONB, after_value JSONB, roots TEXT[]) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE old_state TEXT:=coalesce(before_value->>'status',before_value->>'finalStatus',before_value->>'treatmentStatus');
 new_state TEXT:=coalesce(after_value->>'status',after_value->>'finalStatus',after_value->>'treatmentStatus');
 draft BOOLEAN:=coalesce(old_state='DRAFT',false); policy public."AuditCaptureFieldPolicy"; field TEXT;
BEGIN
 -- Actual transitions, not submitted UI flags. Review/comment status is not a
 -- GMP approval and is deliberately outside this closure classification.
 IF entity_type IN ('Deviation','Capa','ChangeControl','Complaint','ReturnRecord','Audit','AuditFinding','AuditFindingAction')
 AND old_state IS DISTINCT FROM new_state AND (new_state IN ('CLOSED','CANCELLED','NOT_APPLICABLE') OR old_state IN ('CLOSED','CANCELLED','NOT_APPLICABLE') AND new_state IN ('OPEN','IN_PROGRESS','PENDING_VERIFICATION')) THEN RETURN true; END IF;
 IF entity_type='ChangeControlFollowup' AND after_value->>'closeChange'='true' AND before_value->>'closeChange' IS DISTINCT FROM 'true' THEN RETURN true; END IF;
 IF entity_type IN ('SignedDocumentCustody','ControlledRevisionDocument') AND after_value->>'replacesId' IS NOT NULL AND before_value->>'replacesId' IS DISTINCT FROM after_value->>'replacesId' THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM public."AuditRootMaturity" WHERE "transactionId"=txid_current() AND "rootKey"=ANY(roots) AND "isDraft") THEN draft:=true; END IF;
 IF entity_type='FormFieldConfig' THEN SELECT status='DRAFT' INTO draft FROM public."FormVersion" WHERE id=before_value->>'formVersionId'; END IF;
 IF draft THEN RETURN false; END IF;
 IF entity_type IN ('Deviation','Capa','ChangeControl','Complaint','ReturnRecord','Audit','AuditFinding','AuditFindingAction') THEN
   FOREACH field IN ARRAY ARRAY['closedAt','operationalClosedAt','effectiveClosedAt','decisionDate','verifiedAt'] LOOP
     IF before_value->field IS NOT NULL AND before_value->field<>'null'::jsonb AND before_value->field IS DISTINCT FROM after_value->field THEN RETURN true; END IF;
   END LOOP;
 END IF;
 field:=NULL;
 IF entity_type='Capa' THEN field:='effectivenessStatus';
 ELSIF entity_type='ReturnRecord' THEN field:='decision';
 ELSIF entity_type='ChangeControlFollowup' THEN field:='effectivenessStatus';
 ELSIF entity_type='AuditFindingAction' THEN field:='verificationResult'; END IF;
 IF field IS NOT NULL AND before_value->field IS DISTINCT FROM after_value->field AND after_value->>field IN ('CONFORMING','NONCONFORMING','ACCEPTED','REJECTED','ACCEPTABLE','NOT_ACCEPTABLE') THEN RETURN true; END IF;
 FOR policy IN SELECT * FROM public."AuditCaptureFieldPolicy" WHERE "entityType"=entity_type AND critical LOOP
   IF entity_type='AppParameter' AND before_value->>'key'<>'ALLOW_CLOSED_RECORD_EDIT' THEN CONTINUE; END IF;
   IF before_value->policy."fieldPath" IS DISTINCT FROM after_value->policy."fieldPath"
   AND before_value->policy."fieldPath" IS NOT NULL AND before_value->policy."fieldPath"<>'null'::jsonb
   AND coalesce(before_value->>policy."fieldPath",'') NOT IN ('','UNKNOWN','PENDING','NOT_ASSESSED','NOT_EVALUATED','UNDETERMINED','UNVERIFIED') THEN RETURN true; END IF;
 END LOOP;
 RETURN false;
END;
$$;
CREATE FUNCTION covex_b2_child_signature(changes JSONB, side TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
 SELECT coalesce(jsonb_object_agg(value->>'fieldPath',value->side),'{}'::jsonb) FROM jsonb_array_elements(changes)
 WHERE value->>'fieldPath' NOT IN ('id','createdAt','updatedAt','createdByText','updatedByText','authenticatedUserId');
$$;
CREATE FUNCTION covex_b2_assess_critical() RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE witness public."AuditMutationWitness"; critical BOOLEAN:=false; child RECORD; missing INTEGER; restored INTEGER;
BEGIN
 SELECT EXISTS(SELECT 1 FROM public."AuditMutationWitness" WHERE "transactionId"=txid_current() AND "requiresReason") INTO critical;
 -- Compare the exact persisted contents as a multiset. Equivalent regeneration
 -- of child IDs is still captured, but does not invent a blanket-save motive.
 FOR child IN SELECT w."entityType",w."beforeRoots",public.covex_b2_child_signature(w.expected,'oldValue') AS signature,
   CASE WHEN w."entityType" LIKE 'Deviation%' THEN 'DEVIATION' WHEN w."entityType" LIKE 'Capa%' THEN 'CAPA' WHEN w."entityType" LIKE 'ChangeControl%' THEN 'CHANGE_CONTROL'
   WHEN w."entityType" LIKE 'Complaint%' THEN 'COMPLAINT' WHEN w."entityType"='ReturnProduct' THEN 'RETURN' ELSE 'AUDIT' END AS module
   FROM public."AuditMutationWitness" w WHERE w."transactionId"=txid_current() AND w.verb='DELETE'
   AND w."entityType" IN ('DeviationImmediateAction','DeviationCapaPlan','CapaPlannedAction','CapaActionFollowup','ChangeControlTask','ComplaintCapaPlan','ComplaintReturnPlan','ReturnProduct','AuditFinding','AuditFindingAction')
   GROUP BY w."entityType",w."beforeRoots",public.covex_b2_child_signature(w.expected,'oldValue') LOOP
   IF NOT EXISTS(SELECT 1 FROM public."AuditRootMaturity" WHERE "transactionId"=txid_current() AND "rootKey"=ANY(child."beforeRoots") AND module=child.module AND NOT "isDraft") THEN CONTINUE; END IF;
   SELECT count(*) INTO missing FROM public."AuditMutationWitness" w WHERE w."transactionId"=txid_current() AND w."entityType"=child."entityType" AND w.verb='DELETE' AND w."beforeRoots"=child."beforeRoots" AND public.covex_b2_child_signature(w.expected,'oldValue')=child.signature;
   SELECT count(*) INTO restored FROM public."AuditMutationWitness" w WHERE w."transactionId"=txid_current() AND w."entityType"=child."entityType" AND w.verb='INSERT' AND w."beforeRoots"=child."beforeRoots" AND public.covex_b2_child_signature(w.expected,'newValue')=child.signature;
   IF missing>restored THEN critical:=true; END IF;
 END LOOP;
 RETURN critical;
END;
$$;
CREATE FUNCTION covex_b2_assessment_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current() AND "backendPid"=pg_backend_pid() AND "databasePrincipal"=session_user AND "operationId"=NEW."operationId") THEN RAISE EXCEPTION 'Private assessment context required'; END IF;
 RETURN NEW;
END;
$$;
CREATE FUNCTION covex_b2_frozen_version_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public."AuditPolicyRequirement" WHERE "policyVersion"='QMS_B2_V1') AND OLD."frozenAt" IS NOT NULL
 AND (TG_OP='DELETE' OR to_jsonb(OLD)-'updatedAt' IS DISTINCT FROM to_jsonb(NEW)-'updatedAt') THEN RAISE EXCEPTION 'Frozen operational version is immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE FUNCTION covex_b2_original_document_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public."AuditPolicyRequirement" WHERE "policyVersion"='QMS_B2_V1') AND OLD."fileData" IS NOT NULL
 AND (TG_OP='DELETE' OR to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW)) THEN RAISE EXCEPTION 'Retained original document is immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE TRIGGER audit_b2_original_document BEFORE UPDATE OR DELETE ON "GeneratedDocument" FOR EACH ROW EXECUTE FUNCTION covex_b2_original_document_guard();

-- CRITICAL_CAPTURE_REPLACEMENTS
CREATE OR REPLACE FUNCTION covex_b2_before(entity_type TEXT, verb TEXT, before_value JSONB, after_value JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE context public."AuditBusinessContext"; roots TEXT[]; entity_key TEXT; critical_change BOOLEAN; draft BOOLEAN:=false; root TEXT; parent_status TEXT; domain_table TEXT; requires_reason BOOLEAN;
BEGIN
  SELECT * INTO context FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current() AND "backendPid"=pg_backend_pid() AND "databasePrincipal"=session_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Private business context required'; END IF;
  IF after_value->'fileData' IS NOT NULL AND after_value->'fileData'<>'null'::jsonb THEN
    IF coalesce(after_value->>'checksum',after_value->>'sha256') IS DISTINCT FROM encode(sha256((after_value->>'fileData')::bytea),'hex') THEN RAISE EXCEPTION 'Original document checksum mismatch'; END IF;
  END IF;
  -- An existing original is replaceable only through the exact immutable
  -- custody chain. Other archived binaries cannot be overwritten in scope.
  IF before_value->'fileData' IS NOT NULL AND before_value->'fileData'<>'null'::jsonb AND before_value->'fileData' IS DISTINCT FROM after_value->'fileData' THEN
    IF entity_type<>'RecordVersionDocument' OR verb<>'UPDATE' OR NOT EXISTS (
      SELECT 1 FROM public."SignedDocumentCustody" current_c JOIN public."GeneratedDocument" current_g ON current_g.id=current_c."originalDocumentId"
      JOIN public."SignedDocumentCustody" previous_c ON previous_c.id=current_c."replacesId"
      JOIN public."GeneratedDocument" previous_g ON previous_g.id=previous_c."originalDocumentId"
      WHERE current_c.id::text=after_value->>'custodyId' AND current_c."recordVersionId"=after_value->>'recordVersionId'
        AND current_c.kind::text=after_value->>'kind' AND current_c."retainedByUserId"=context."actorUserId"
        AND current_c.reason=context.reason AND context.reason IS NOT NULL
        AND previous_c."recordVersionId"=before_value->>'recordVersionId' AND previous_c.kind::text=before_value->>'kind'
        AND (before_value->>'custodyId' IS NULL OR previous_c.id::text=before_value->>'custodyId')
        AND previous_g."fileData"=(before_value->>'fileData')::bytea AND previous_g.checksum=before_value->>'checksum'
        AND current_g."fileData"=(after_value->>'fileData')::bytea AND current_g.checksum=after_value->>'checksum'
    ) THEN RAISE EXCEPTION 'Original documentary supersession incomplete'; END IF;
  END IF;
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
  PERFORM public.covex_b2_observe_maturity(roots,entity_type,coalesce(before_value,after_value));
  requires_reason:=public.covex_b2_critical_mutation(entity_type,before_value,after_value,roots);
  IF requires_reason AND context.reason IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Reason required for critical operational decision';
  END IF;
  INSERT INTO public."AuditRootBinding" VALUES(txid_current(),entity_type,entity_key,roots) ON CONFLICT("transactionId","entityType","entityKey") DO UPDATE SET roots=EXCLUDED.roots;
  IF verb='UPDATE' THEN
    draft:=before_value->>'status'='DRAFT' OR before_value->>'finalStatus'='DRAFT' OR before_value->>'administrativeStatus'='DRAFT';
    IF draft IS NULL THEN draft:=false; END IF;
    IF entity_type='FormFieldConfig' THEN SELECT status='DRAFT' INTO draft FROM public."FormVersion" WHERE id=before_value->>'formVersionId'; END IF;
    FOR root IN SELECT key FROM unnest(roots) key WHERE key LIKE 'QMS_RECORD:%' LOOP
      SELECT CASE "recordType" WHEN 'DEVIATION' THEN 'Deviation' WHEN 'CAPA' THEN 'Capa' WHEN 'CHANGE_CONTROL' THEN 'ChangeControl' WHEN 'COMPLAINT' THEN 'Complaint' WHEN 'RETURN' THEN 'ReturnRecord' WHEN 'AUDIT' THEN 'Audit' END INTO domain_table FROM public."QmsRecord" WHERE id=substring(root FROM 12);
      IF domain_table IS NOT NULL THEN
        EXECUTE format('SELECT coalesce(to_jsonb(t)->>''status'',to_jsonb(t)->>''finalStatus'') FROM public.%I t WHERE "qmsRecordId"=$1',domain_table) INTO parent_status USING substring(root FROM 12);
        draft:=draft OR parent_status='DRAFT';
      END IF;
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public."AuditCaptureFieldPolicy" p WHERE p."entityType"=entity_type AND p.critical AND (entity_type<>'AppParameter' OR before_value->>'key'='ALLOW_CLOSED_RECORD_EDIT') AND before_value->p."fieldPath" IS DISTINCT FROM after_value->p."fieldPath" AND
      before_value->p."fieldPath" IS NOT NULL AND before_value->p."fieldPath"<>'null'::jsonb AND coalesce(before_value->>p."fieldPath",'') NOT IN ('','UNKNOWN','PENDING','NOT_ASSESSED','NOT_EVALUATED','UNDETERMINED','UNVERIFIED')) INTO critical_change;
    IF critical_change AND NOT coalesce(draft,false) AND context.reason IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Reason required for established critical correction'; END IF;
    IF entity_type IN ('FormVersion','TemplateVersion') AND before_value->'isActive' IS DISTINCT FROM after_value->'isActive' AND context.reason IS NULL THEN RAISE EXCEPTION 'Reason required for official version activation/retirement'; END IF;
  END IF;
  INSERT INTO public."AuditMutationWitness" VALUES(gen_random_uuid(),txid_current(),entity_type,entity_key,verb,roots,NULL,false,requires_reason);
END;
$$;
CREATE OR REPLACE FUNCTION covex_b2_finish() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE context public."AuditBusinessContext"; witness public."AuditMutationWitness"; actual JSONB; count_events INTEGER; target RECORD; root TEXT; critical BOOLEAN;
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
  critical:=public.covex_b2_assess_critical();
  IF critical AND context.reason IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Reason required for critical operational decision'; END IF;
  IF context."operationId" IS NOT NULL THEN
    INSERT INTO public."AuditOperationAssessment"("operationId","policyVersion","proposedCritical","reasonRequired") VALUES(context."operationId",'QMS_B2_CRITICAL_TECHNICAL_V1',critical,critical);
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
  DELETE FROM public."AuditRootMaturity" WHERE "transactionId"=context."transactionId";
  DELETE FROM public."AuditRootBinding" WHERE "transactionId"=context."transactionId";
  DELETE FROM public."AuditBusinessContext" WHERE "transactionId"=context."transactionId";
  RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION covex_b2_begin(actor_id UUID, request_id UUID, request_digest TEXT, operation_code TEXT, access_module TEXT, access_permission TEXT, operation_reason TEXT)
RETURNS TABLE(operation_id UUID,replayed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous public."AuditOperation"; actor_name TEXT; target RECORD;
BEGIN
  -- Deliberate preparation boundary, not a deploy-time/HTTP feature flag.
  IF current_database() !~ '^covex_phase4b1_test_[a-z0-9_]+$' THEN RAISE EXCEPTION 'Complete corporate policy is not prepared and active'; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND (rolsuper OR rolcreaterole)) OR has_schema_privilege(session_user,'public','CREATE') OR EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('AuditOperation','AuditEvent','AuditBusinessContext','AuditMutationWitness','AuditCaptureTablePolicy','AuditCaptureFieldPolicy','AuditRootBinding','AuditAdministrationRoot','AuditEventAdditionalTarget','AuditAggregateCursor','AuditOperationTarget','AuditRuntimeContext','AuditPolicyRequirement','AuditOperationEvidence','AuditCommandResult','SignedDocumentCustody','AuditTechnicalContext','AuditTechnicalEvent','AuditRootMaturity','AuditOperationAssessment') AND
    (pg_has_role(session_user,c.relowner,'USAGE') OR has_table_privilege(session_user,c.oid,'DELETE,TRUNCATE') OR has_any_column_privilege(session_user,c.oid,'INSERT') OR has_any_column_privilege(session_user,c.oid,'UPDATE') OR c.relname IN ('AuditRuntimeContext','AuditBusinessContext','AuditMutationWitness','AuditRootBinding','AuditTechnicalContext','AuditRootMaturity') AND has_any_column_privilege(session_user,c.oid,'SELECT'))
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

CREATE TRIGGER audit_b2_assessment_guard BEFORE INSERT ON "AuditOperationAssessment" FOR EACH ROW EXECUTE FUNCTION covex_b2_assessment_guard();
CREATE TRIGGER audit_b2_assessment_immutable BEFORE UPDATE OR DELETE ON "AuditOperationAssessment" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_assessment_no_truncate BEFORE TRUNCATE ON "AuditOperationAssessment" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_frozen_version BEFORE UPDATE OR DELETE ON "QmsRecordVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_frozen_version_guard();
DO $$
DECLARE owner_role TEXT:=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public."AuditOperation"'::regclass)); function_id regprocedure;
BEGIN
 REVOKE ALL ON "AuditRootMaturity","AuditOperationAssessment" FROM PUBLIC;
 EXECUTE format('ALTER TABLE public."AuditRootMaturity" OWNER TO %I',owner_role);
 EXECUTE format('ALTER TABLE public."AuditOperationAssessment" OWNER TO %I',owner_role);
 FOR function_id IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'covex_b2_%' LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',function_id);
   EXECUTE format('ALTER FUNCTION %s OWNER TO %I',function_id,owner_role);
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='covex_app') THEN
   REVOKE ALL ON "AuditRootMaturity","AuditOperationAssessment" FROM covex_app;
   GRANT SELECT ON "AuditOperationAssessment" TO covex_app;
 END IF;
END;
$$;
COMMIT;

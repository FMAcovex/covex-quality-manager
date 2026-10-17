BEGIN;
-- D-088, OOS-2b: additive B2 capture of OOS operations (OO01-OO05). Technical
-- proposal pending formal QA/DT acceptance; it activates nothing by itself.
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "OosRecord" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "OosRecord" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
INSERT INTO "AuditCaptureTablePolicy" VALUES ('OosRecord',ARRAY['id'],'[{"kind":"QMS_RECORD","field":"qmsRecordId"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('OosRecord','affectedQuantity','STRING','VALUE',false),
('OosRecord','area','STRING','VALUE',false),
('OosRecord','batchSize','STRING','VALUE',false),
('OosRecord','closedAt','DATE','VALUE',false),
('OosRecord','createdByText','STRING','VALUE',false),
('OosRecord','departmentCodeSnapshot','STRING','VALUE',false),
('OosRecord','departmentId','STRING','VALUE',false),
('OosRecord','departmentNameSnapshot','STRING','VALUE',false),
('OosRecord','detectedBy','STRING','VALUE',false),
('OosRecord','detectionDescription','STRING','VALUE',false),
('OosRecord','extraData','JSON','VALUE',false),
('OosRecord','id','STRING','VALUE',false),
('OosRecord','internalObservations','STRING','VALUE',false),
('OosRecord','investigationResult','STRING','VALUE',true),
('OosRecord','issueDate','DATE','VALUE',false),
('OosRecord','lotNumber','STRING','VALUE',false),
('OosRecord','materialKind','STRING','VALUE',false),
('OosRecord','materialName','STRING','VALUE',false),
('OosRecord','oosDate','DATE','VALUE',false),
('OosRecord','oosTime','STRING','VALUE',false),
('OosRecord','phaseIApprovedAt','DATE','VALUE',false),
('OosRecord','phaseIApprovedBy','STRING','VALUE',false),
('OosRecord','phaseIConclusion','STRING','VALUE',true),
('OosRecord','phaseIDestroyQuantity','STRING','VALUE',false),
('OosRecord','phaseIDisposition','STRING','VALUE',true),
('OosRecord','phaseIEvaluation','JSON','VALUE',false),
('OosRecord','phaseIIAffectedDepartments','STRING','VALUE',false),
('OosRecord','phaseIIConclusion','STRING','VALUE',true),
('OosRecord','phaseIIDestroyQuantity','STRING','VALUE',false),
('OosRecord','phaseIIIssueDate','DATE','VALUE',false),
('OosRecord','phaseIIIssuedAt','DATE','VALUE',false),
('OosRecord','phaseIIIssuedBy','STRING','VALUE',false),
('OosRecord','phaseIIProductionReview','STRING','VALUE',true),
('OosRecord','phaseIIResampling','STRING','VALUE',false),
('OosRecord','phaseIIRetesting','STRING','VALUE',false),
('OosRecord','phaseIIReturnQuantity','STRING','VALUE',false),
('OosRecord','phaseIIVerdict','STRING','VALUE',true),
('OosRecord','phaseIIVerdictOther','STRING','VALUE',false),
('OosRecord','phaseIIVerdictQuantity','STRING','VALUE',false),
('OosRecord','phaseIInvestigation','STRING','VALUE',true),
('OosRecord','phaseIIssuedAt','DATE','VALUE',false),
('OosRecord','phaseIIssuedBy','STRING','VALUE',false),
('OosRecord','phaseIReturnQuantity','STRING','VALUE',false),
('OosRecord','phaseIVerdict','STRING','VALUE',true),
('OosRecord','phaseIVerdictOther','STRING','VALUE',false),
('OosRecord','phaseIVerdictQuantity','STRING','VALUE',false),
('OosRecord','process','STRING','VALUE',false),
('OosRecord','qmsRecordId','STRING','VALUE',false),
('OosRecord','shift','STRING','VALUE',false),
('OosRecord','status','STRING','VALUE',false),
('OosRecord','supplier','STRING','VALUE',false),
('OosRecord','supplierLot','STRING','VALUE',false);

-- OOS_CAPTURE_REPLACEMENTS: latest published bodies, extended only with the
-- OO operation prefix, the OOS module and its OosRecord domain table.
CREATE OR REPLACE FUNCTION covex_b2_authorize_root(actor_id UUID, access_module TEXT, access_permission TEXT, root_key TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE kind TEXT:=split_part(root_key,':',1); identifier TEXT:=substring(root_key FROM position(':' IN root_key)+1);
  module TEXT; departments TEXT[]:=ARRAY[]::text[]; domain_table TEXT;
BEGIN
  IF kind='QMS_RECORD' THEN
    SELECT "recordType"::text INTO module FROM public."QmsRecord" WHERE id=identifier;
    domain_table:=CASE module WHEN 'DEVIATION' THEN 'Deviation' WHEN 'CAPA' THEN 'Capa' WHEN 'CHANGE_CONTROL' THEN 'ChangeControl' WHEN 'COMPLAINT' THEN 'Complaint' WHEN 'RETURN' THEN 'ReturnRecord' WHEN 'OOS' THEN 'OosRecord' WHEN 'AUDIT' THEN 'Audit' END;
    IF domain_table IS NULL THEN RAISE EXCEPTION 'Business root missing'; END IF;
    IF module='AUDIT' THEN SELECT coalesce(array_agg(d."departmentId" ORDER BY d."departmentId"),ARRAY[]::text[]) INTO departments FROM public."AuditDepartment" d JOIN public."Audit" a ON a.id=d."auditId" WHERE a."qmsRecordId"=identifier AND d."isActive";
    ELSE EXECUTE format('SELECT array_remove(ARRAY["departmentId"],NULL) FROM public.%I WHERE "qmsRecordId"=$1',domain_table) INTO departments USING identifier;
    END IF;
  ELSIF kind='PNT' THEN
    module:='PNT'; SELECT array_remove(ARRAY["departmentId"],NULL) INTO departments FROM public."ControlledDocument" WHERE id=identifier;
    IF NOT FOUND THEN RAISE EXCEPTION 'Controlled root missing'; END IF;
  ELSIF kind='AUDIT_PLAN' THEN
    module:='AUDIT'; IF NOT EXISTS(SELECT 1 FROM public."AuditAnnualPlan" WHERE id=identifier) THEN RAISE EXCEPTION 'Plan root missing'; END IF;
  ELSIF kind='ADMINISTRATION' THEN
    IF identifier='AUTHORIZATION' THEN module:='SYSTEM'; IF access_permission<>'MANAGE_USERS' THEN RAISE EXCEPTION 'Administrative operation mismatch'; END IF;
    ELSIF identifier='CONFIGURATION' THEN module:=access_module; IF access_permission<>'MANAGE_CONFIGURATION' THEN RAISE EXCEPTION 'Configuration operation mismatch'; END IF;
    ELSIF identifier='PNT_IMPORT' THEN module:='PNT'; IF access_permission<>'IMPORT' THEN RAISE EXCEPTION 'Import operation mismatch'; END IF;
    ELSIF identifier='HISTORICAL_IMPORT' THEN module:=access_module; IF access_permission<>'IMPORT' THEN RAISE EXCEPTION 'Historical operation mismatch'; END IF;
    ELSE RAISE EXCEPTION 'Administrative root refused'; END IF;
    identifier:=NULL;
  ELSE RAISE EXCEPTION 'Root kind refused'; END IF;
  PERFORM public.covex_b2_permission(actor_id,module,CASE WHEN module=access_module THEN access_permission ELSE 'EDIT' END,identifier,coalesce(departments,ARRAY[]::text[]));
END;
$$;
CREATE OR REPLACE FUNCTION covex_b2_observe_maturity(roots TEXT[], entity_type TEXT, row_value JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE root TEXT; root_module TEXT; domain_table TEXT; state TEXT;
BEGIN
 FOREACH root IN ARRAY roots LOOP
   IF EXISTS(SELECT 1 FROM public."AuditRootMaturity" WHERE "transactionId"=txid_current() AND "rootKey"=root) THEN CONTINUE; END IF;
   state:=NULL; root_module:=NULL;
   IF root LIKE 'QMS_RECORD:%' THEN
     SELECT "recordType"::text INTO root_module FROM public."QmsRecord" WHERE id=substring(root FROM 12);
     IF root_module IS NULL AND entity_type='QmsRecord' THEN root_module:=row_value->>'recordType'; END IF;
     domain_table:=CASE root_module WHEN 'DEVIATION' THEN 'Deviation' WHEN 'CAPA' THEN 'Capa' WHEN 'CHANGE_CONTROL' THEN 'ChangeControl' WHEN 'COMPLAINT' THEN 'Complaint' WHEN 'RETURN' THEN 'ReturnRecord' WHEN 'OOS' THEN 'OosRecord' WHEN 'AUDIT' THEN 'Audit' END;
     IF domain_table IS NOT NULL THEN EXECUTE format('SELECT coalesce(to_jsonb(t)->>''status'',to_jsonb(t)->>''finalStatus'') FROM public.%I t WHERE "qmsRecordId"=$1',domain_table) INTO state USING substring(root FROM 12); END IF;
   ELSIF root LIKE 'PNT:%' THEN
     root_module:='PNT'; SELECT "administrativeStatus"::text INTO state FROM public."ControlledDocument" WHERE id=substring(root FROM 5);
   ELSE root_module:='SYSTEM'; state:='OPERATIONAL'; END IF;
   INSERT INTO public."AuditRootMaturity" VALUES(txid_current(),root,coalesce(root_module,'UNKNOWN'),coalesce(state='DRAFT',true));
 END LOOP;
END;
$$;
CREATE OR REPLACE FUNCTION covex_b2_critical_mutation(entity_type TEXT, before_value JSONB, after_value JSONB, roots TEXT[]) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE old_state TEXT:=coalesce(before_value->>'status',before_value->>'finalStatus',before_value->>'treatmentStatus');
 new_state TEXT:=coalesce(after_value->>'status',after_value->>'finalStatus',after_value->>'treatmentStatus');
 draft BOOLEAN:=coalesce(old_state='DRAFT',false); policy public."AuditCaptureFieldPolicy"; field TEXT;
BEGIN
 -- Actual transitions, not submitted UI flags. Review/comment status is not a
 -- GMP approval and is deliberately outside this closure classification.
 IF entity_type IN ('Deviation','Capa','ChangeControl','Complaint','ReturnRecord','OosRecord','Audit','AuditFinding','AuditFindingAction')
 AND old_state IS DISTINCT FROM new_state AND (new_state IN ('CLOSED','CANCELLED','NOT_APPLICABLE') OR old_state IN ('CLOSED','CANCELLED','NOT_APPLICABLE') AND new_state IN ('OPEN','IN_PROGRESS','PENDING_VERIFICATION')) THEN RETURN true; END IF;
 IF entity_type='ChangeControlFollowup' AND after_value->>'closeChange'='true' AND before_value->>'closeChange' IS DISTINCT FROM 'true' THEN RETURN true; END IF;
 IF entity_type IN ('SignedDocumentCustody','ControlledRevisionDocument') AND after_value->>'replacesId' IS NOT NULL AND before_value->>'replacesId' IS DISTINCT FROM after_value->>'replacesId' THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM public."AuditRootMaturity" WHERE "transactionId"=txid_current() AND "rootKey"=ANY(roots) AND "isDraft") THEN draft:=true; END IF;
 IF entity_type='FormFieldConfig' THEN SELECT status='DRAFT' INTO draft FROM public."FormVersion" WHERE id=before_value->>'formVersionId'; END IF;
 IF draft THEN RETURN false; END IF;
 IF entity_type IN ('Deviation','Capa','ChangeControl','Complaint','ReturnRecord','OosRecord','Audit','AuditFinding','AuditFindingAction') THEN
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
      SELECT CASE "recordType" WHEN 'DEVIATION' THEN 'Deviation' WHEN 'CAPA' THEN 'Capa' WHEN 'CHANGE_CONTROL' THEN 'ChangeControl' WHEN 'COMPLAINT' THEN 'Complaint' WHEN 'RETURN' THEN 'ReturnRecord' WHEN 'OOS' THEN 'OosRecord' WHEN 'AUDIT' THEN 'Audit' END INTO domain_table FROM public."QmsRecord" WHERE id=substring(root FROM 12);
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
  IF actor_id IS NULL OR request_id IS NULL OR request_digest IS NULL OR request_digest !~ '^[a-f0-9]{64}$' OR operation_code IS NULL OR operation_code !~ '^(DV0[1-8]|CA0[1-8]|CC0[1-7]|RC0[1-7]|DE0[1-7]|OO0[1-5]|AU0[1-9]|PN0[1-6]|TR0[1-57])$' OR
    access_module IS NULL OR NOT EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='AccessModule' AND e.enumlabel=access_module) OR
    access_permission IS NULL OR access_permission IN ('READ','DOWNLOAD','EXPORT') OR NOT EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='AccessPermission' AND e.enumlabel=access_permission) OR
    operation_reason IS NOT NULL AND length(btrim(operation_reason)) NOT BETWEEN 1 AND 20000 THEN RAISE EXCEPTION 'Invalid business command'; END IF;
  IF substring(operation_code FROM 1 FOR 2)<>'TR' AND access_module<>(CASE substring(operation_code FROM 1 FOR 2)
    WHEN 'DV' THEN 'DEVIATION' WHEN 'CA' THEN 'CAPA' WHEN 'CC' THEN 'CHANGE_CONTROL' WHEN 'RC' THEN 'COMPLAINT' WHEN 'DE' THEN 'RETURN' WHEN 'OO' THEN 'OOS' WHEN 'AU' THEN 'AUDIT' WHEN 'PN' THEN 'PNT' END) THEN RAISE EXCEPTION 'Policy module mismatch'; END IF;
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

CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "OosRecord" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "OosRecord" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
DO $$
DECLARE owner_role TEXT:=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public."AuditOperation"'::regclass)); function_id regprocedure;
BEGIN
 -- Root resolution reads the new versioned business table.
 EXECUTE format('GRANT SELECT ON public."OosRecord" TO %I',owner_role);
 FOR function_id IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'covex_b2_%' LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',function_id);
   EXECUTE format('ALTER FUNCTION %s OWNER TO %I',function_id,owner_role);
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='covex_app') THEN
   GRANT EXECUTE ON FUNCTION covex_b2_begin(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT) TO covex_app;
 END IF;
END;
$$;
COMMIT;

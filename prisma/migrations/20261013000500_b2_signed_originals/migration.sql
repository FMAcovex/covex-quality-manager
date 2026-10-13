BEGIN;
CREATE TABLE "SignedDocumentCustody" (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 "originalDocumentId" TEXT NOT NULL UNIQUE REFERENCES "GeneratedDocument"(id) ON DELETE RESTRICT,
 "recordVersionId" TEXT NOT NULL REFERENCES "QmsRecordVersion"(id) ON DELETE RESTRICT,
 kind "RecordVersionDocumentKind" NOT NULL,
 "sourceKind" TEXT NOT NULL CHECK ("sourceKind" IN ('RECEIVED_SIGNED_PDF','OBSERVED_LEGACY_SIGNED_PDF')),
 "identitySource" TEXT NOT NULL CHECK ("identitySource" IN ('AUTHENTICATED_SERVER_SESSION','UNVERIFIED_LEGACY_CONTEXT')),
 "retainedByUserId" UUID REFERENCES "AuthUser"(id) ON DELETE RESTRICT,
 "retainedByName" TEXT,
 "retainedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
 "replacesId" UUID UNIQUE REFERENCES "SignedDocumentCustody"(id) ON DELETE RESTRICT,
 reason TEXT,
 CHECK ("replacesId" IS NULL OR reason IS NOT NULL AND length(btrim(reason)) BETWEEN 1 AND 20000),
 CHECK (("identitySource"='AUTHENTICATED_SERVER_SESSION')=("retainedByUserId" IS NOT NULL))
);
CREATE INDEX ON "SignedDocumentCustody"("recordVersionId","retainedAt",id);
ALTER TABLE "RecordVersionDocument" ADD COLUMN "custodyId" UUID UNIQUE REFERENCES "SignedDocumentCustody"(id) ON DELETE RESTRICT;
-- DOCUMENT_POLICY_ROWS
INSERT INTO "AuditCaptureTablePolicy" VALUES ('SignedDocumentCustody',ARRAY['id'],'[{"via":"recordVersionId","table":"QmsRecordVersion"}]'::jsonb,'EVENT');
INSERT INTO "AuditCaptureFieldPolicy" VALUES
('SignedDocumentCustody','id','STRING','VALUE',false),
('SignedDocumentCustody','identitySource','STRING','VALUE',false),
('SignedDocumentCustody','kind','STRING','VALUE',false),
('SignedDocumentCustody','originalDocumentId','STRING','VALUE',false),
('SignedDocumentCustody','reason','STRING','VALUE',false),
('SignedDocumentCustody','recordVersionId','STRING','VALUE',false),
('SignedDocumentCustody','replacesId','STRING','VALUE',false),
('SignedDocumentCustody','retainedAt','INSTANT','VALUE',false),
('SignedDocumentCustody','retainedByName','STRING','VALUE',false),
('SignedDocumentCustody','retainedByUserId','STRING','VALUE',false),
('SignedDocumentCustody','sourceKind','STRING','VALUE',false);
INSERT INTO "AuditCaptureFieldPolicy" VALUES ('RecordVersionDocument','custodyId','STRING','VALUE',false);

CREATE FUNCTION covex_b2_retain_signed_original(actor_id UUID, actor_label TEXT, version_id TEXT, document_kind TEXT,
 file_bytes BYTEA, file_name TEXT, expected_checksum TEXT, replacement_reason TEXT, chosen_document_type TEXT)
RETURNS TABLE(custody_id UUID, original_document_id TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE context public."AuditBusinessContext"; root public."QmsRecord"; version public."QmsRecordVersion";
 old_slot public."RecordVersionDocument"; previous_custody UUID; old_document TEXT; new_document TEXT:=gen_random_uuid()::text;
 new_custody UUID:=gen_random_uuid(); actor_name TEXT; document_type TEXT; file_checksum TEXT; previous_checksum TEXT;
BEGIN
 SELECT * INTO context FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current()
  AND "backendPid"=pg_backend_pid() AND "databasePrincipal"=session_user;
 IF context."actorUserId" IS NOT NULL THEN
   IF actor_id IS NOT NULL AND actor_id<>context."actorUserId" THEN RAISE EXCEPTION 'Documentary actor mismatch'; END IF;
   actor_id:=context."actorUserId";
   IF context."accessPermission"<>'ATTACH_DOCUMENT' THEN RAISE EXCEPTION 'Documentary operation mismatch'; END IF;
 ELSIF EXISTS(SELECT 1 FROM public."AuditPolicyRequirement" WHERE "policyVersion"='QMS_B2_V1') THEN
   RAISE EXCEPTION 'Mandatory documentary context unavailable';
 END IF;
 SELECT q.* INTO root FROM public."QmsRecord" q JOIN public."QmsRecordVersion" v ON v."qmsRecordId"=q.id WHERE v.id=version_id FOR UPDATE OF q;
 IF NOT FOUND THEN RAISE EXCEPTION 'Documentary version/root missing'; END IF;
 SELECT * INTO version FROM public."QmsRecordVersion" WHERE id=version_id;
 IF actor_id IS NOT NULL THEN
   SELECT "displayName" INTO actor_name FROM public."AuthUser" WHERE id=actor_id AND active AND "authorizedAt" IS NOT NULL FOR SHARE;
   IF actor_name IS NULL THEN RAISE EXCEPTION 'Active documentary actor required'; END IF;
   PERFORM public.covex_b2_authorize_root(actor_id,root."recordType"::text,'ATTACH_DOCUMENT','QMS_RECORD:'||root.id);
 ELSE actor_name:=nullif(btrim(actor_label),''); END IF;
 IF file_bytes IS NULL OR octet_length(file_bytes) NOT BETWEEN 5 AND 15728640 OR substring(file_bytes FROM 1 FOR 5)<>decode('255044462d','hex')
   OR file_name IS NULL OR length(file_name)=0 OR document_kind IS NULL OR
   NOT EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='RecordVersionDocumentKind' AND e.enumlabel=document_kind) THEN RAISE EXCEPTION 'Invalid received PDF'; END IF;
 IF root."recordType"<>'RETURN' AND document_kind<>'SIGNED_PDF' THEN RAISE EXCEPTION 'Document kind/module mismatch'; END IF;
 document_type:=CASE root."recordType"::text WHEN 'DEVIATION' THEN 'DEVIATION_ANNEX_III' WHEN 'CAPA' THEN 'CAPA_ANNEX_III'
 WHEN 'CHANGE_CONTROL' THEN 'CHANGE_ANNEX_III' WHEN 'COMPLAINT' THEN 'COMPLAINT_ANNEX_III'
 WHEN 'RETURN' THEN CASE WHEN document_kind='RETURN_ANNEX_V_SIGNED' THEN 'RETURN_ANNEX_V' ELSE 'RETURN_ANNEX_III' END
 WHEN 'AUDIT' THEN CASE WHEN EXISTS(SELECT 1 FROM public."Audit" WHERE "qmsRecordId"=root.id AND "auditType"='INTERNAL') THEN 'AUDIT_INTERNAL_REPORT' ELSE 'AUDIT_EXTERNAL_REPORT' END END;
 IF document_type IS NULL OR chosen_document_type IS NOT NULL AND chosen_document_type<>document_type THEN RAISE EXCEPTION 'Document type/module mismatch'; END IF;
 SELECT * INTO old_slot FROM public."RecordVersionDocument" WHERE "recordVersionId"=version_id AND kind::text=document_kind;
 previous_checksum:=old_slot.checksum;
 IF previous_checksum IS DISTINCT FROM expected_checksum THEN RAISE EXCEPTION 'Received PDF changed; reload before replacement'; END IF;
 IF old_slot.id IS NOT NULL THEN
   IF replacement_reason IS NULL OR length(btrim(replacement_reason)) NOT BETWEEN 1 AND 20000 THEN RAISE EXCEPTION 'Document replacement reason required'; END IF;
   IF context."actorUserId" IS NOT NULL AND context.reason IS DISTINCT FROM btrim(replacement_reason) THEN RAISE EXCEPTION 'Documentary reason mismatch'; END IF;
   IF encode(sha256(old_slot."fileData"),'hex')<>old_slot.checksum OR octet_length(old_slot."fileData")<>old_slot."fileSize" THEN RAISE EXCEPTION 'Previous PDF integrity unavailable'; END IF;
   previous_custody:=old_slot."custodyId";
   IF previous_custody IS NULL THEN
     -- Observe a genuinely stored legacy original now; do not invent its snapshot
     -- or authenticated historical uploader. Custodian/time are separate below.
     SELECT g.id INTO old_document FROM public."GeneratedDocument" g WHERE g."qmsRecordId"=root.id
       AND g."recordVersionId"=version_id AND g."documentType"::text=document_type
       AND g."mimeType"='application/pdf' AND g.checksum=old_slot.checksum AND g."fileData"=old_slot."fileData"
       AND NOT EXISTS(SELECT 1 FROM public."SignedDocumentCustody" c WHERE c."originalDocumentId"=g.id) ORDER BY g."generatedAt",g.id LIMIT 1;
     IF old_document IS NULL THEN
       old_document:=gen_random_uuid()::text;
       INSERT INTO public."GeneratedDocument"(id,"qmsRecordId","recordVersionId","documentType","fileData","fileName","mimeType",checksum,"generatedByText","generatedAt","authenticatedUserId",metadata)
       VALUES(old_document,root.id,version_id,document_type::public."DocumentType",old_slot."fileData",old_slot."fileName",'application/pdf',old_slot.checksum,old_slot."uploadedByText",old_slot."uploadedAt",NULL,
        jsonb_build_object('source','legacy-signed-upload','kind',document_kind,'originalSnapshotKnown',false,'officialReceivedOriginal',true));
     END IF;
     previous_custody:=gen_random_uuid();
     INSERT INTO public."SignedDocumentCustody"(id,"originalDocumentId","recordVersionId",kind,"sourceKind","identitySource","retainedByUserId","retainedByName")
       VALUES(previous_custody,old_document,version_id,document_kind::public."RecordVersionDocumentKind",'OBSERVED_LEGACY_SIGNED_PDF',
       CASE WHEN actor_id IS NULL THEN 'UNVERIFIED_LEGACY_CONTEXT' ELSE 'AUTHENTICATED_SERVER_SESSION' END,actor_id,actor_name);
   END IF;
   IF EXISTS(SELECT 1 FROM public."SignedDocumentCustody" WHERE "replacesId"=previous_custody) THEN RAISE EXCEPTION 'Original already superseded'; END IF;
 END IF;
 file_checksum:=encode(sha256(file_bytes),'hex');
 INSERT INTO public."GeneratedDocument"(id,"qmsRecordId","recordVersionId","documentType","fileData","fileName","mimeType",checksum,"generatedByText","authenticatedUserId",metadata)
 VALUES(new_document,root.id,version_id,document_type::public."DocumentType",file_bytes,file_name,'application/pdf',file_checksum,actor_name,actor_id,
   jsonb_build_object('source','signed-upload','kind',document_kind,'replacementReason',replacement_reason,'observedSnapshot',version.snapshot,'officialReceivedOriginal',true));
 INSERT INTO public."SignedDocumentCustody"(id,"originalDocumentId","recordVersionId",kind,"sourceKind","identitySource","retainedByUserId","retainedByName","replacesId",reason)
 VALUES(new_custody,new_document,version_id,document_kind::public."RecordVersionDocumentKind",'RECEIVED_SIGNED_PDF',
 CASE WHEN actor_id IS NULL THEN 'UNVERIFIED_LEGACY_CONTEXT' ELSE 'AUTHENTICATED_SERVER_SESSION' END,actor_id,actor_name,previous_custody,nullif(btrim(replacement_reason),''));
 RETURN QUERY SELECT new_custody,new_document;
END;
$$;

CREATE FUNCTION covex_b2_signed_slot_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE custody public."SignedDocumentCustody"; original public."GeneratedDocument"; previous public."GeneratedDocument";
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Received original cannot be deleted'; END IF;
 IF TG_OP='UPDATE' AND OLD."custodyId" IS NOT NULL AND NEW."custodyId" IS NULL THEN RAISE EXCEPTION 'Custody binding cannot be removed'; END IF;
 IF NEW."custodyId" IS NULL THEN
   IF EXISTS(SELECT 1 FROM public."AuditPolicyRequirement" WHERE "policyVersion"='QMS_B2_V1') THEN RAISE EXCEPTION 'Mandatory original custody unavailable'; END IF;
   IF TG_OP='UPDATE' AND OLD."fileData" IS DISTINCT FROM NEW."fileData" THEN RAISE EXCEPTION 'Documentary supersession requires retained originals'; END IF;
   -- Legacy first uploads stay readable; their service integration can explicitly
   -- retain them. No fictional historical identity is inferred here.
   RETURN NEW;
 END IF;
 SELECT * INTO custody FROM public."SignedDocumentCustody" WHERE id=NEW."custodyId";
 SELECT * INTO original FROM public."GeneratedDocument" WHERE id=custody."originalDocumentId";
 IF custody."recordVersionId" IS DISTINCT FROM NEW."recordVersionId" OR custody.kind IS DISTINCT FROM NEW.kind OR
  original."recordVersionId" IS DISTINCT FROM NEW."recordVersionId" OR original."fileData" IS DISTINCT FROM NEW."fileData" OR
  original.checksum IS DISTINCT FROM NEW.checksum OR original."fileName" IS DISTINCT FROM NEW."fileName" OR
  original."mimeType" IS DISTINCT FROM NEW."mimeType" OR NEW."fileSize"<>octet_length(NEW."fileData") THEN RAISE EXCEPTION 'Original/slot binding mismatch'; END IF;
 NEW."uploadedByText":=original."generatedByText";
 IF TG_OP='UPDATE' AND OLD."fileData" IS DISTINCT FROM NEW."fileData" THEN
   IF OLD."custodyId" IS NOT NULL AND custody."replacesId" IS DISTINCT FROM OLD."custodyId" THEN RAISE EXCEPTION 'Documentary predecessor mismatch'; END IF;
   SELECT g.* INTO previous FROM public."GeneratedDocument" g JOIN public."SignedDocumentCustody" c ON c."originalDocumentId"=g.id WHERE c.id=custody."replacesId" AND c."recordVersionId"=OLD."recordVersionId" AND c.kind=OLD.kind;
   IF previous."fileData" IS DISTINCT FROM OLD."fileData" OR previous.checksum IS DISTINCT FROM OLD.checksum THEN RAISE EXCEPTION 'Previous exact bytes unavailable'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE FUNCTION covex_b2_signed_original_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public."SignedDocumentCustody" WHERE "originalDocumentId"=OLD.id) THEN RAISE EXCEPTION 'Retained original is immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- DOCUMENT_CAPTURE_REPLACEMENTS
CREATE OR REPLACE FUNCTION covex_b2_begin(actor_id UUID, request_id UUID, request_digest TEXT, operation_code TEXT, access_module TEXT, access_permission TEXT, operation_reason TEXT)
RETURNS TABLE(operation_id UUID,replayed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous public."AuditOperation"; actor_name TEXT; target RECORD;
BEGIN
  -- Deliberate preparation boundary, not a deploy-time/HTTP feature flag.
  IF current_database() !~ '^covex_phase4b1_test_[a-z0-9_]+$' THEN RAISE EXCEPTION 'Complete corporate policy is not prepared and active'; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND (rolsuper OR rolcreaterole)) OR has_schema_privilege(session_user,'public','CREATE') OR EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('AuditOperation','AuditEvent','AuditBusinessContext','AuditMutationWitness','AuditCaptureTablePolicy','AuditCaptureFieldPolicy','AuditRootBinding','AuditAdministrationRoot','AuditEventAdditionalTarget','AuditAggregateCursor','AuditOperationTarget','AuditRuntimeContext','AuditPolicyRequirement','AuditOperationEvidence','AuditCommandResult','SignedDocumentCustody') AND
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

CREATE OR REPLACE FUNCTION covex_b2_before(entity_type TEXT, verb TEXT, before_value JSONB, after_value JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE context public."AuditBusinessContext"; roots TEXT[]; entity_key TEXT; critical_change BOOLEAN; draft BOOLEAN:=false; root TEXT; parent_status TEXT; domain_table TEXT;
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

CREATE OR REPLACE FUNCTION covex_b2_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE witness public."AuditMutationWitness"; before_value JSONB; after_value JSONB; changes JSONB; change JSONB; roots TEXT[]; operation_id UUID; event_id UUID; ordinal INTEGER; root TEXT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public."AuditBusinessContext" WHERE "transactionId"=txid_current() AND "backendPid"=pg_backend_pid() AND "databasePrincipal"=session_user) THEN RETURN NULL; END IF;
  before_value:=CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END; after_value:=CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END;
  SELECT * INTO witness FROM public."AuditMutationWitness" WHERE "transactionId"=txid_current() AND "entityType"=TG_TABLE_NAME AND "entityKey"=public.covex_b2_entity_key(TG_TABLE_NAME,coalesce(before_value,after_value)) AND NOT completed;
  IF NOT FOUND THEN RAISE EXCEPTION 'Independent mutation witness missing'; END IF;
  changes:=public.covex_b2_changes(TG_TABLE_NAME,before_value,after_value);
  IF jsonb_array_length(changes)=0 THEN RETURN NULL; END IF;
  SELECT array_agg(DISTINCT key ORDER BY key) INTO roots FROM unnest(witness."beforeRoots"||public.covex_b2_roots(TG_TABLE_NAME,after_value)) key;
  operation_id:=public.covex_b2_ensure_operation(roots);
  SELECT coalesce(max("eventOrdinal"),0) INTO ordinal FROM public."AuditEvent" WHERE "operationId"=operation_id;
  FOR change IN SELECT value FROM jsonb_array_elements(changes) LOOP
    event_id:=gen_random_uuid(); ordinal:=ordinal+1;
    INSERT INTO public."AuditEvent"("id","operationId","rootKey","eventOrdinal","entityType","entityId","fieldPath","oldValue","newValue","mutationId","recordVersionId","generatedDocumentId","documentChecksum")
      VALUES(event_id,operation_id,roots[1],ordinal,TG_TABLE_NAME,witness."entityKey",change->>'fieldPath',change->'oldValue',change->'newValue',witness.id,
        CASE WHEN TG_OP<>'DELETE' THEN CASE WHEN TG_TABLE_NAME='QmsRecordVersion' THEN after_value->>'id' ELSE after_value->>'recordVersionId' END END,
        CASE WHEN TG_OP<>'DELETE' AND TG_TABLE_NAME='GeneratedDocument' AND after_value->>'checksum' ~ '^[a-f0-9]{64}$' THEN after_value->>'id' END,
        CASE WHEN TG_OP<>'DELETE' AND TG_TABLE_NAME='GeneratedDocument' AND after_value->>'checksum' ~ '^[a-f0-9]{64}$' THEN after_value->>'checksum' END);
    FOREACH root IN ARRAY roots[2:cardinality(roots)] LOOP
      INSERT INTO public."AuditEventAdditionalTarget" VALUES(event_id,operation_id,root);
    END LOOP;
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "SignedDocumentCustody" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "SignedDocumentCustody" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_capture AFTER INSERT OR UPDATE OR DELETE ON "SignedDocumentCustody" FOR EACH ROW EXECUTE FUNCTION covex_b2_capture();
CREATE TRIGGER audit_b2_witness AFTER INSERT OR UPDATE OR DELETE ON "SignedDocumentCustody" FOR EACH ROW EXECUTE FUNCTION covex_b2_witness();
CREATE TRIGGER audit_b2_immutable BEFORE UPDATE OR DELETE ON "SignedDocumentCustody" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_no_truncate BEFORE TRUNCATE ON "SignedDocumentCustody" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_signed_slot BEFORE INSERT OR UPDATE OR DELETE ON "RecordVersionDocument" FOR EACH ROW EXECUTE FUNCTION covex_b2_signed_slot_guard();
CREATE TRIGGER audit_b2_signed_slot_no_truncate BEFORE TRUNCATE ON "RecordVersionDocument" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_signed_original BEFORE UPDATE OR DELETE ON "GeneratedDocument" FOR EACH ROW EXECUTE FUNCTION covex_b2_signed_original_immutable();

DO $$
DECLARE owner_role TEXT:=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public."AuditOperation"'::regclass)); function_id regprocedure;
BEGIN
 REVOKE ALL ON "SignedDocumentCustody" FROM PUBLIC;
 EXECUTE format('ALTER TABLE public."SignedDocumentCustody" OWNER TO %I',owner_role);
 EXECUTE format('GRANT INSERT ON public."GeneratedDocument" TO %I',owner_role);
 FOR function_id IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'covex_b2_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',function_id);
  EXECUTE format('ALTER FUNCTION %s OWNER TO %I',function_id,owner_role);
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='covex_app') THEN
   REVOKE ALL ON "SignedDocumentCustody" FROM covex_app;
   GRANT SELECT ON "SignedDocumentCustody" TO covex_app;
   GRANT EXECUTE ON FUNCTION covex_b2_retain_signed_original(UUID,TEXT,TEXT,TEXT,BYTEA,TEXT,TEXT,TEXT,TEXT) TO covex_app;
 END IF;
END;
$$;
COMMIT;

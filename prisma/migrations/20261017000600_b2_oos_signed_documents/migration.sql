BEGIN;
-- D-088, OOS-4: custodia del PDF firmado de los Anexos III y IV de OOS. Último
-- cuerpo publicado de covex_b2_retain_signed_original, ampliado solo con los
-- tipos OOS_ANNEX_III/IV_SIGNED, que únicamente admite una raíz OOS.
CREATE OR REPLACE FUNCTION covex_b2_retain_signed_original(actor_id UUID, actor_label TEXT, version_id TEXT, document_kind TEXT,
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
 IF root."recordType" NOT IN ('RETURN','OOS') AND document_kind<>'SIGNED_PDF' OR root."recordType"<>'OOS' AND document_kind LIKE 'OOS\_%' THEN RAISE EXCEPTION 'Document kind/module mismatch'; END IF;
 document_type:=CASE root."recordType"::text WHEN 'DEVIATION' THEN 'DEVIATION_ANNEX_III' WHEN 'CAPA' THEN 'CAPA_ANNEX_III'
 WHEN 'CHANGE_CONTROL' THEN 'CHANGE_ANNEX_III' WHEN 'COMPLAINT' THEN 'COMPLAINT_ANNEX_III'
 WHEN 'RETURN' THEN CASE WHEN document_kind='RETURN_ANNEX_V_SIGNED' THEN 'RETURN_ANNEX_V' ELSE 'RETURN_ANNEX_III' END
 WHEN 'OOS' THEN CASE document_kind WHEN 'OOS_ANNEX_III_SIGNED' THEN 'OOS_ANNEX_III' WHEN 'OOS_ANNEX_IV_SIGNED' THEN 'OOS_ANNEX_IV' END
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

DO $$
DECLARE owner_role TEXT:=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public."AuditOperation"'::regclass));
BEGIN
 REVOKE ALL ON FUNCTION covex_b2_retain_signed_original(UUID,TEXT,TEXT,TEXT,BYTEA,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
 EXECUTE format('ALTER FUNCTION covex_b2_retain_signed_original(UUID,TEXT,TEXT,TEXT,BYTEA,TEXT,TEXT,TEXT,TEXT) OWNER TO %I',owner_role);
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='covex_app') THEN
   GRANT EXECUTE ON FUNCTION covex_b2_retain_signed_original(UUID,TEXT,TEXT,TEXT,BYTEA,TEXT,TEXT,TEXT,TEXT) TO covex_app;
 END IF;
END;
$$;
COMMIT;

-- B1: additive journal and isolated synthetic pilot. No QMS-wide policy/triggers.
BEGIN;
CREATE TABLE "AuditOperation" (
  "id" UUID PRIMARY KEY, "actorUserId" UUID NOT NULL REFERENCES "AuthUser"("id") ON DELETE RESTRICT,
  "actorName" TEXT NOT NULL, "origin" TEXT NOT NULL, "operation" TEXT NOT NULL,
  "requestId" UUID NOT NULL, "requestDigest" TEXT NOT NULL CHECK ("requestDigest" ~ '^[a-f0-9]{64}$'),
  "reason" TEXT NOT NULL CHECK (length(btrim("reason")) BETWEEN 1 AND 500),
  "policyVersion" TEXT NOT NULL, "schemaVersion" INTEGER NOT NULL CHECK ("schemaVersion" = 1),
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(), "databasePrincipal" TEXT NOT NULL,
  UNIQUE ("actorUserId", "origin", "requestId")
);
CREATE INDEX "AuditOperation_occurredAt_id_idx" ON "AuditOperation"("occurredAt","id");
CREATE TABLE "AuditAggregateCursor" (
  "rootKey" TEXT PRIMARY KEY, "rootKind" TEXT NOT NULL,
  "qmsRecordId" TEXT UNIQUE REFERENCES "QmsRecord"("id") ON DELETE RESTRICT,
  "controlledDocumentId" TEXT UNIQUE REFERENCES "ControlledDocument"("id") ON DELETE RESTRICT,
  "auditAnnualPlanId" TEXT UNIQUE REFERENCES "AuditAnnualPlan"("id") ON DELETE RESTRICT,
  "lastSequence" BIGINT NOT NULL DEFAULT 0 CHECK ("lastSequence" >= 0),
  CONSTRAINT "audit_root_identity" CHECK (
    ("rootKind"='QMS_RECORD' AND "qmsRecordId" IS NOT NULL AND "controlledDocumentId" IS NULL AND "auditAnnualPlanId" IS NULL AND "rootKey"='QMS_RECORD:'||"qmsRecordId") OR
    ("rootKind"='PNT' AND "controlledDocumentId" IS NOT NULL AND "qmsRecordId" IS NULL AND "auditAnnualPlanId" IS NULL AND "rootKey"='PNT:'||"controlledDocumentId") OR
    ("rootKind"='AUDIT_PLAN' AND "auditAnnualPlanId" IS NOT NULL AND "qmsRecordId" IS NULL AND "controlledDocumentId" IS NULL AND "rootKey"='AUDIT_PLAN:'||"auditAnnualPlanId")
  )
);
CREATE TABLE "AuditOperationTarget" (
  "operationId" UUID NOT NULL REFERENCES "AuditOperation"("id") ON DELETE RESTRICT,
  "rootKey" TEXT NOT NULL REFERENCES "AuditAggregateCursor"("rootKey") ON DELETE RESTRICT,
  "aggregateSequence" BIGINT NOT NULL CHECK ("aggregateSequence">0),
  PRIMARY KEY ("operationId","rootKey"), UNIQUE ("rootKey","aggregateSequence")
);
CREATE FUNCTION covex_audit_value_valid(value JSONB) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
DECLARE kind TEXT;
BEGIN
  IF value IS NULL OR jsonb_typeof(value)<>'object' THEN RETURN false; END IF;
  kind:=value->>'type';
  IF kind='ABSENT' THEN RETURN value='{"present":false,"type":"ABSENT"}'::jsonb; END IF;
  IF (value-'present'-'type'-'value')<>'{}'::jsonb OR value->'present' IS DISTINCT FROM 'true'::jsonb OR NOT(value ? 'value') THEN RETURN false; END IF;
  IF kind='NULL' THEN RETURN value->'value'='null'::jsonb; END IF;
  IF kind='BOOLEAN' THEN RETURN jsonb_typeof(value->'value')='boolean'; END IF;
  IF jsonb_typeof(value->'value')<>'string' THEN RETURN false; END IF;
  IF kind='STRING' THEN RETURN true; END IF;
  IF kind='INTEGER' THEN RETURN (value->>'value') ~ '^-?(0|[1-9][0-9]*)$'; END IF;
  IF kind='DECIMAL' THEN RETURN (value->>'value') ~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?$'; END IF;
  IF kind='DATE' THEN RETURN (value->>'value') ~ '^\d{4}-\d{2}-\d{2}$' AND (value->>'value')::date::text=value->>'value'; END IF;
  IF kind='INSTANT' THEN RETURN (value->>'value') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.[0-9]{1,6})?Z$' AND (value->>'value')::timestamptz IS NOT NULL; END IF;
  RETURN false;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE TABLE "AuditEvent" (
  "id" UUID PRIMARY KEY, "operationId" UUID NOT NULL REFERENCES "AuditOperation"("id") ON DELETE RESTRICT,
  "rootKey" TEXT NOT NULL, "eventOrdinal" INTEGER NOT NULL CHECK ("eventOrdinal">0),
  "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "fieldPath" TEXT NOT NULL,
  "oldValue" JSONB NOT NULL, "newValue" JSONB NOT NULL,
  "capturedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  "recordVersionId" TEXT REFERENCES "QmsRecordVersion"("id") ON DELETE RESTRICT,
  "generatedDocumentId" TEXT REFERENCES "GeneratedDocument"("id") ON DELETE RESTRICT,
  "documentChecksum" TEXT CHECK ("documentChecksum" IS NULL OR "documentChecksum" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "audit_document_hash_required" CHECK (("generatedDocumentId" IS NULL)=("documentChecksum" IS NULL)),
  FOREIGN KEY ("operationId","rootKey") REFERENCES "AuditOperationTarget"("operationId","rootKey") ON DELETE RESTRICT,
  UNIQUE ("operationId","eventOrdinal"),
  CONSTRAINT "audit_typed_values" CHECK (covex_audit_value_valid("oldValue") IS TRUE AND covex_audit_value_valid("newValue") IS TRUE)
);
CREATE INDEX "AuditEvent_rootKey_capturedAt_id_idx" ON "AuditEvent"("rootKey","capturedAt","id");
CREATE TABLE "AuditRuntimeContext" (
  "operationId" UUID PRIMARY KEY REFERENCES "AuditOperation"("id") ON DELETE RESTRICT,
  "transactionId" BIGINT NOT NULL UNIQUE, "backendPid" INTEGER NOT NULL, "databasePrincipal" TEXT NOT NULL
);
CREATE TABLE "AuditPilotRecord" (
  "qmsRecordId" TEXT PRIMARY KEY REFERENCES "QmsRecord"("id") ON DELETE RESTRICT,
  "value" INTEGER NOT NULL DEFAULT 0 CHECK ("value">=0), "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision">=0),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION covex_audit_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Audit journal is append-only';
END;
$$;
CREATE FUNCTION covex_audit_context() RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE operation_id UUID;
BEGIN
  SELECT c."operationId" INTO operation_id FROM public."AuditRuntimeContext" c
    WHERE c."transactionId"=txid_current() AND c."backendPid"=pg_backend_pid() AND c."databasePrincipal"=session_user;
  IF operation_id IS NULL OR current_setting('covex.audit.operation_id',true) IS DISTINCT FROM operation_id::text THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Audited transaction context required';
  END IF;
  RETURN operation_id;
END;
$$;
CREATE FUNCTION covex_audit_stamp_operation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  NEW."occurredAt":=clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE FUNCTION covex_audit_stamp_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE record_id TEXT;
BEGIN
  IF NEW."operationId"<>public.covex_audit_context() THEN RAISE EXCEPTION 'Audit context mismatch'; END IF;
  NEW."capturedAt":=clock_timestamp();
  SELECT "qmsRecordId" INTO record_id FROM public."AuditAggregateCursor" WHERE "rootKey"=NEW."rootKey";
  IF NEW."recordVersionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."QmsRecordVersion" WHERE id=NEW."recordVersionId" AND "qmsRecordId"=record_id) THEN
    RAISE EXCEPTION 'Audit version ownership mismatch';
  END IF;
  IF NEW."generatedDocumentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."GeneratedDocument" WHERE id=NEW."generatedDocumentId" AND "qmsRecordId"=record_id AND checksum=NEW."documentChecksum") THEN
    RAISE EXCEPTION 'Audit document ownership mismatch';
  END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION covex_audit_begin(actor_id UUID, request_id UUID, request_digest TEXT, operation_reason TEXT, roots JSONB)
RETURNS TABLE(operation_id UUID,replayed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous public."AuditOperation"; actor_name TEXT; item JSONB; key TEXT; sequence BIGINT; result_id UUID;
BEGIN
  -- This is the ONLY registered B1 policy, confined to disposable databases.
  IF current_database() !~ '^covex_phase4b1_test_[a-z0-9_]+$' THEN RAISE EXCEPTION 'Synthetic pilot database required'; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND (rolsuper OR rolcreaterole)) OR
     EXISTS(SELECT 1 FROM pg_class WHERE oid='public."AuditOperation"'::regclass AND pg_has_role(session_user,relowner,'USAGE')) OR
     has_schema_privilege(session_user,'public','CREATE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('AuditOperation','AuditEvent','AuditOperationTarget','AuditAggregateCursor','AuditRuntimeContext') AND
       (has_table_privilege(session_user,c.oid,'DELETE,TRUNCATE') OR has_any_column_privilege(session_user,c.oid,'INSERT') OR has_any_column_privilege(session_user,c.oid,'UPDATE'))) THEN RAISE EXCEPTION 'Separate non-owner application role required'; END IF;
  IF EXISTS(SELECT 1 FROM public."AuditRuntimeContext" WHERE "transactionId"=txid_current()) THEN RAISE EXCEPTION 'Nested audit operation refused'; END IF;
  IF request_digest !~ '^[a-f0-9]{64}$' OR operation_reason IS NULL OR length(btrim(operation_reason)) NOT BETWEEN 1 AND 500 OR
     jsonb_typeof(roots) IS DISTINCT FROM 'array' OR jsonb_array_length(roots) NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'Invalid audit command'; END IF;
  SELECT "displayName" INTO actor_name FROM public."AuthUser" WHERE id=actor_id AND active AND "authorizedAt" IS NOT NULL FOR SHARE;
  IF actor_name IS NULL THEN RAISE EXCEPTION 'Active admitted actor required'; END IF;
  PERFORM 1 FROM public."AuthRole" r JOIN public."AuthUserRole" u ON u."roleId"=r.id WHERE u."userId"=actor_id FOR SHARE OF r;
  PERFORM pg_advisory_xact_lock(hashtextextended('COVEX-AUDIT:'||actor_id::text||':'||request_id::text,0));
  SELECT * INTO previous FROM public."AuditOperation" WHERE "actorUserId"=actor_id AND origin='SYNTHETIC_PILOT' AND "requestId"=request_id;
  IF FOUND THEN
    IF previous."requestDigest"<>request_digest THEN RAISE EXCEPTION 'Audit request conflict'; END IF;
    RETURN QUERY SELECT previous.id,true; RETURN;
  END IF;
  IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(roots))<>jsonb_array_length(roots) THEN RAISE EXCEPTION 'Duplicate audit root'; END IF;
  result_id:=gen_random_uuid();
  INSERT INTO public."AuditOperation" VALUES (result_id,actor_id,actor_name,'SYNTHETIC_PILOT','PILOT_SET_VALUE',request_id,request_digest,operation_reason,'SYNTHETIC_PILOT_V1',1,clock_timestamp(),session_user);
  INSERT INTO public."AuditRuntimeContext" VALUES(result_id,txid_current(),pg_backend_pid(),session_user);
  PERFORM set_config('covex.audit.operation_id',result_id::text,true);
  FOR item IN SELECT value FROM jsonb_array_elements(roots) ORDER BY value->>'id' LOOP
    IF item->>'kind' IS DISTINCT FROM 'QMS_RECORD' OR item->>'id' IS NULL OR (item-'kind'-'id')<>'{}'::jsonb THEN RAISE EXCEPTION 'Pilot root refused'; END IF;
    PERFORM 1 FROM public."QmsRecord" WHERE id=item->>'id' AND "recordType"='DEVIATION' AND "isActive" FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Operational synthetic root required'; END IF;
    -- Same DEVIATION/EDIT ALL or ASSIGNED rule as the existing 4B1 policy.
    IF NOT EXISTS (
      SELECT 1 FROM public."AuthRolePermission" p JOIN public."AuthRole" r ON r.id=p."roleId" JOIN public."AuthUserRole" u ON u."roleId"=r.id
      WHERE u."userId"=actor_id AND r."qaAcceptedAt" IS NOT NULL AND p.module='DEVIATION' AND p.permission='EDIT' AND
      (p.scope='ALL' OR p.scope='ASSIGNED' AND (
        EXISTS(SELECT 1 FROM public."AuthRecordAssignment" a WHERE a."userId"=actor_id AND a.module='DEVIATION' AND a."recordId"::text=item->>'id') OR
        EXISTS(SELECT 1 FROM public."Deviation" d JOIN public."AuthUserDepartment" ud ON ud."departmentId"=d."departmentId" WHERE d."qmsRecordId"=item->>'id' AND ud."userId"=actor_id)))
    ) THEN RAISE EXCEPTION 'Pilot authorization required'; END IF;
    key:='QMS_RECORD:'||(item->>'id');
    INSERT INTO public."AuditAggregateCursor"("rootKey","rootKind","qmsRecordId") VALUES(key,'QMS_RECORD',item->>'id') ON CONFLICT("rootKey") DO NOTHING;
    UPDATE public."AuditAggregateCursor" SET "lastSequence"="lastSequence"+1 WHERE "rootKey"=key RETURNING "lastSequence" INTO sequence;
    INSERT INTO public."AuditOperationTarget" VALUES(result_id,key,sequence);
  END LOOP;
  RETURN QUERY SELECT result_id,false;
END;
$$;
CREATE FUNCTION covex_audit_guard_pilot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE operation_id UUID;
BEGIN
  IF current_database() !~ '^covex_phase4b1_test_[a-z0-9_]+$' THEN RAISE EXCEPTION 'Synthetic pilot database required'; END IF;
  IF TG_OP='INSERT' THEN RETURN NEW; END IF;
  operation_id:=public.covex_audit_context();
  IF NEW."qmsRecordId"<>OLD."qmsRecordId" OR NOT EXISTS (SELECT 1 FROM public."AuditOperationTarget" WHERE "operationId"=operation_id AND "rootKey"='QMS_RECORD:'||OLD."qmsRecordId") THEN RAISE EXCEPTION 'Audit target mismatch'; END IF;
  IF NEW.value=OLD.value THEN RAISE EXCEPTION 'Pilot requires a real value change'; END IF;
  NEW.revision:=OLD.revision+1; NEW."updatedAt":=clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE FUNCTION covex_audit_capture_pilot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE operation_id UUID; ordinal INTEGER; field TEXT; before_value INTEGER; after_value INTEGER;
BEGIN
  operation_id:=public.covex_audit_context();
  SELECT coalesce(max("eventOrdinal"),0) INTO ordinal FROM public."AuditEvent" WHERE "operationId"=operation_id;
  FOREACH field IN ARRAY ARRAY['value','revision'] LOOP
    before_value:=CASE WHEN field='value' THEN OLD.value ELSE OLD.revision END;
    after_value:=CASE WHEN field='value' THEN NEW.value ELSE NEW.revision END;
    ordinal:=ordinal+1;
    INSERT INTO public."AuditEvent"("id","operationId","rootKey","eventOrdinal","entityType","entityId","fieldPath","oldValue","newValue")
      VALUES(gen_random_uuid(),operation_id,'QMS_RECORD:'||NEW."qmsRecordId",ordinal,'AuditPilotRecord',NEW."qmsRecordId",field,
        jsonb_build_object('present',true,'type','INTEGER','value',before_value::text),jsonb_build_object('present',true,'type','INTEGER','value',after_value::text));
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE FUNCTION covex_audit_require_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE targets INTEGER; events INTEGER;
BEGIN
  SELECT count(*) INTO targets FROM public."AuditOperationTarget" WHERE "operationId"=NEW.id;
  SELECT count(*) INTO events FROM public."AuditEvent" WHERE "operationId"=NEW.id;
  IF targets=0 OR events<>targets*2 OR
     EXISTS(SELECT 1 FROM public."AuditOperationTarget" t WHERE t."operationId"=NEW.id AND
       (SELECT count(*) FROM public."AuditEvent" e WHERE e."operationId"=t."operationId" AND e."rootKey"=t."rootKey" AND e."entityId"=substring(t."rootKey" FROM 12) AND e."entityType"='AuditPilotRecord' AND e."fieldPath" IN ('value','revision'))<>2) OR
     (SELECT count(DISTINCT "eventOrdinal") FROM public."AuditEvent" WHERE "operationId"=NEW.id)<>events OR
     (SELECT max("eventOrdinal") FROM public."AuditEvent" WHERE "operationId"=NEW.id)<>events THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Mandatory audit capture missing';
  END IF;
  IF public.covex_audit_context()<>NEW.id THEN RAISE EXCEPTION 'Audit lease mismatch'; END IF;
  DELETE FROM public."AuditRuntimeContext" WHERE "operationId"=NEW.id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_operation_stamp BEFORE INSERT ON "AuditOperation" FOR EACH ROW EXECUTE FUNCTION covex_audit_stamp_operation();
CREATE TRIGGER audit_event_stamp BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION covex_audit_stamp_event();
CREATE TRIGGER audit_pilot_guard BEFORE INSERT OR UPDATE ON "AuditPilotRecord" FOR EACH ROW EXECUTE FUNCTION covex_audit_guard_pilot();
CREATE TRIGGER audit_pilot_capture AFTER UPDATE ON "AuditPilotRecord" FOR EACH ROW EXECUTE FUNCTION covex_audit_capture_pilot();
CREATE CONSTRAINT TRIGGER audit_operation_coverage AFTER INSERT ON "AuditOperation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION covex_audit_require_events();
CREATE TRIGGER audit_operation_immutable BEFORE UPDATE OR DELETE ON "AuditOperation" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_operation_no_truncate BEFORE TRUNCATE ON "AuditOperation" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_event_immutable BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_event_no_truncate BEFORE TRUNCATE ON "AuditEvent" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_target_immutable BEFORE UPDATE OR DELETE ON "AuditOperationTarget" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_target_no_truncate BEFORE TRUNCATE ON "AuditOperationTarget" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();

-- Never expose definer functions via the PostgreSQL default EXECUTE-to-PUBLIC.
REVOKE ALL ON FUNCTION covex_audit_begin(UUID,UUID,TEXT,TEXT,JSONB),covex_audit_context(),covex_audit_stamp_event(),covex_audit_guard_pilot(),covex_audit_capture_pilot(),covex_audit_require_events(),covex_audit_immutable(),covex_audit_stamp_operation() FROM PUBLIC;
REVOKE ALL ON FUNCTION covex_audit_value_valid(JSONB) FROM PUBLIC;
REVOKE ALL ON "AuditOperation","AuditOperationTarget","AuditEvent","AuditAggregateCursor","AuditRuntimeContext","AuditPilotRecord" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='covex_app') THEN
    REVOKE ALL ON "AuditOperation","AuditOperationTarget","AuditEvent","AuditAggregateCursor","AuditRuntimeContext","AuditPilotRecord" FROM covex_app;
    GRANT SELECT ON "AuditOperation","AuditOperationTarget","AuditEvent","AuditAggregateCursor","AuditPilotRecord" TO covex_app;
    -- Pilot writes remain unavailable in production even if these grants exist.
    GRANT UPDATE(value) ON "AuditPilotRecord" TO covex_app;
    GRANT EXECUTE ON FUNCTION covex_audit_begin(UUID,UUID,TEXT,TEXT,JSONB) TO covex_app;
  END IF;
END;
$$;
-- Optional controlled owner role, provisioned by IT outside the migration.
-- Existing dev/CI installations keep their migration owner until configured.
DO $$
DECLARE owner_role TEXT:=nullif(current_setting('covex.audit_owner_role',true),''); object_name TEXT; function_id regprocedure;
BEGIN
  IF owner_role IS NULL AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname='covex_audit_owner') THEN owner_role:='covex_audit_owner'; END IF;
  IF owner_role IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=owner_role AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreaterole) THEN RAISE EXCEPTION 'Controlled non-login audit owner required'; END IF;
    EXECUTE format('GRANT USAGE,CREATE ON SCHEMA public TO %I',owner_role);
    EXECUTE format('GRANT SELECT,REFERENCES ON public."AuthUser",public."QmsRecord",public."ControlledDocument",public."AuditAnnualPlan",public."QmsRecordVersion",public."GeneratedDocument" TO %I',owner_role);
    EXECUTE format('GRANT SELECT ON public."AuthRole",public."AuthUserRole",public."AuthRolePermission",public."AuthUserDepartment",public."AuthRecordAssignment",public."Deviation" TO %I',owner_role);
    -- Row locks require UPDATE privilege; no function changes these IDs.
    EXECUTE format('GRANT UPDATE(id) ON public."AuthUser",public."QmsRecord" TO %I',owner_role);
    EXECUTE format('GRANT UPDATE(id) ON public."AuthRole" TO %I',owner_role);
    FOREACH object_name IN ARRAY ARRAY['AuditOperation','AuditOperationTarget','AuditEvent','AuditAggregateCursor','AuditRuntimeContext','AuditPilotRecord'] LOOP
      EXECUTE format('ALTER TABLE public.%I OWNER TO %I',object_name,owner_role);
    END LOOP;
    FOR function_id IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'covex_audit_%' LOOP
      EXECUTE format('ALTER FUNCTION %s OWNER TO %I',function_id,owner_role);
    END LOOP;
  END IF;
END;
$$;
COMMIT;

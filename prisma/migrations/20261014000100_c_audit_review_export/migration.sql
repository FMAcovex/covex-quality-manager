BEGIN;

ALTER TYPE "AccessPermission" ADD VALUE IF NOT EXISTS 'AUDIT_TRAIL_REVIEW';
ALTER TYPE "AccessPermission" ADD VALUE IF NOT EXISTS 'AUDIT_TRAIL_EXPORT';
ALTER TYPE "AccessPermission" ADD VALUE IF NOT EXISTS 'AUDIT_TRAIL_SENSITIVE_READ';

CREATE TABLE "AuditTrailReview" (
  id UUID PRIMARY KEY,
  "requestId" UUID NOT NULL,
  "requestDigest" TEXT NOT NULL CHECK ("requestDigest" ~ '^[0-9a-f]{64}$'),
  "reviewerUserId" UUID NOT NULL REFERENCES "AuthUser"(id) ON DELETE RESTRICT,
  "reviewerName" TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('NO_OBSERVATIONS','OBSERVATIONS_RECORDED','FOLLOW_UP_REQUIRED')),
  notes TEXT,
  "scopeManifest" JSONB NOT NULL,
  "cutoffOccurredAt" TIMESTAMPTZ(6) NOT NULL,
  "cutoffOperationId" UUID NOT NULL,
  "supersedesId" UUID REFERENCES "AuditTrailReview"(id) ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  UNIQUE("reviewerUserId","requestId"),
  CHECK (char_length(coalesce(notes,'')) <= 4000),
  CHECK ("supersedesId" IS NULL OR "supersedesId" <> id)
);
CREATE INDEX "AuditTrailReview_createdAt_id_idx" ON "AuditTrailReview"("createdAt",id);
CREATE INDEX "AuditTrailReview_result_createdAt_idx" ON "AuditTrailReview"(result,"createdAt");

CREATE TABLE "AuditTrailReviewOperation" (
  "reviewId" UUID NOT NULL REFERENCES "AuditTrailReview"(id) ON DELETE RESTRICT,
  "operationId" UUID NOT NULL REFERENCES "AuditOperation"(id) ON DELETE RESTRICT,
  PRIMARY KEY("reviewId","operationId")
);
CREATE INDEX "AuditTrailReviewOperation_operationId_reviewId_idx" ON "AuditTrailReviewOperation"("operationId","reviewId");

CREATE TABLE "AuditTrailReviewEvent" (
  "reviewId" UUID NOT NULL REFERENCES "AuditTrailReview"(id) ON DELETE RESTRICT,
  "eventId" UUID NOT NULL REFERENCES "AuditEvent"(id) ON DELETE RESTRICT,
  PRIMARY KEY("reviewId","eventId")
);
CREATE INDEX "AuditTrailReviewEvent_eventId_reviewId_idx" ON "AuditTrailReviewEvent"("eventId","reviewId");

CREATE TABLE "AuditTrailExport" (
  id UUID PRIMARY KEY,
  "requestId" UUID NOT NULL,
  "requestDigest" TEXT NOT NULL CHECK ("requestDigest" ~ '^[0-9a-f]{64}$'),
  "actorUserId" UUID NOT NULL REFERENCES "AuthUser"(id) ON DELETE RESTRICT,
  "actorName" TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format='CSV_UTF8'),
  "fileName" TEXT NOT NULL,
  "fileData" BYTEA NOT NULL,
  "contentSha256" TEXT NOT NULL CHECK ("contentSha256" ~ '^[0-9a-f]{64}$'),
  "rowCount" INTEGER NOT NULL CHECK ("rowCount">=0),
  "scopeManifest" JSONB NOT NULL,
  "cutoffOccurredAt" TIMESTAMPTZ(6) NOT NULL,
  "cutoffOperationId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  UNIQUE("actorUserId","requestId"),
  CHECK (octet_length("fileData") <= 20971520),
  CHECK (char_length("fileName") BETWEEN 1 AND 180)
);
CREATE INDEX "AuditTrailExport_createdAt_id_idx" ON "AuditTrailExport"("createdAt",id);

CREATE TABLE "AuditTrailExportEvent" (
  "exportId" UUID NOT NULL REFERENCES "AuditTrailExport"(id) ON DELETE RESTRICT,
  "eventId" UUID NOT NULL REFERENCES "AuditEvent"(id) ON DELETE RESTRICT,
  PRIMARY KEY("exportId","eventId")
);
CREATE INDEX "AuditTrailExportEvent_eventId_exportId_idx" ON "AuditTrailExportEvent"("eventId","exportId");

CREATE FUNCTION covex_c_has_permission(actor_id UUID, required_permission TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(
   SELECT 1 FROM public."AuthUser" u
   JOIN public."AuthUserRole" ur ON ur."userId"=u.id
   JOIN public."AuthRole" r ON r.id=ur."roleId" AND r."qaAcceptedAt" IS NOT NULL
   JOIN public."AuthRolePermission" p ON p."roleId"=r.id
   WHERE u.id=actor_id AND u.active AND u."authorizedAt" IS NOT NULL
     AND p.module::text='SYSTEM' AND p.permission::text=required_permission AND p.scope::text='ALL'
 );
$$;

CREATE FUNCTION covex_c_record_review(
  review_id UUID, request_id UUID, request_digest TEXT, actor_id UUID,
  review_result TEXT, review_notes TEXT, scope_manifest JSONB,
  cutoff_time TIMESTAMPTZ, cutoff_operation_id UUID,
  operation_ids UUID[], event_ids UUID[], supersedes_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE existing public."AuditTrailReview"; actor_name TEXT;
BEGIN
  IF NOT public.covex_c_has_permission(actor_id,'AUDIT_TRAIL_REVIEW') THEN RAISE EXCEPTION 'Explicit audit review permission required'; END IF;
  SELECT "displayName" INTO actor_name FROM public."AuthUser" WHERE id=actor_id AND active AND "authorizedAt" IS NOT NULL FOR SHARE;
  IF actor_name IS NULL THEN RAISE EXCEPTION 'Active admitted reviewer required'; END IF;
  SELECT * INTO existing FROM public."AuditTrailReview" WHERE "reviewerUserId"=actor_id AND "requestId"=request_id;
  IF FOUND THEN
    IF existing."requestDigest"<>request_digest THEN RAISE EXCEPTION 'Review request conflict'; END IF;
    RETURN existing.id;
  END IF;
  IF request_digest !~ '^[0-9a-f]{64}$' OR review_result NOT IN ('NO_OBSERVATIONS','OBSERVATIONS_RECORDED','FOLLOW_UP_REQUIRED') OR char_length(coalesce(review_notes,''))>4000 THEN RAISE EXCEPTION 'Invalid review receipt'; END IF;
  IF cardinality(operation_ids) IS NULL OR cardinality(operation_ids)<1 OR cardinality(operation_ids)>500 OR cardinality(event_ids) IS NULL OR cardinality(event_ids)<1 OR cardinality(event_ids)>10000 THEN RAISE EXCEPTION 'Bounded exact review scope required'; END IF;
  IF cardinality(operation_ids)<>(SELECT count(DISTINCT value) FROM unnest(operation_ids) value) OR cardinality(event_ids)<>(SELECT count(DISTINCT value) FROM unnest(event_ids) value) THEN RAISE EXCEPTION 'Duplicate review scope'; END IF;
  IF (SELECT count(*) FROM public."AuditOperation" o WHERE o.id=ANY(operation_ids) AND (o."occurredAt",o.id)<=(cutoff_time,cutoff_operation_id))<>cardinality(operation_ids) THEN RAISE EXCEPTION 'Review operation scope changed or exceeds cut'; END IF;
  IF (SELECT count(*) FROM public."AuditEvent" e WHERE e.id=ANY(event_ids) AND e."operationId"=ANY(operation_ids))<>cardinality(event_ids) THEN RAISE EXCEPTION 'Review event scope mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM public."AuditEvent" e WHERE e.id=ANY(event_ids) AND (e."rootKey" LIKE 'ADMINISTRATION:%' OR EXISTS(SELECT 1 FROM public."AuditEventAdditionalTarget" a WHERE a."eventId"=e.id AND a."rootKey" LIKE 'ADMINISTRATION:%')))
    AND NOT public.covex_c_has_permission(actor_id,'AUDIT_TRAIL_SENSITIVE_READ') THEN RAISE EXCEPTION 'Sensitive audit permission required'; END IF;
  IF scope_manifest->'operationIds' IS DISTINCT FROM to_jsonb(operation_ids) OR scope_manifest->'eventIds' IS DISTINCT FROM to_jsonb(event_ids) THEN RAISE EXCEPTION 'Review manifest does not identify its exact scope'; END IF;
  IF supersedes_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."AuditTrailReview" WHERE id=supersedes_id) THEN RAISE EXCEPTION 'Superseded review does not exist'; END IF;
  INSERT INTO public."AuditTrailReview"(id,"requestId","requestDigest","reviewerUserId","reviewerName",result,notes,"scopeManifest","cutoffOccurredAt","cutoffOperationId","supersedesId")
  VALUES(review_id,request_id,request_digest,actor_id,actor_name,review_result,nullif(btrim(review_notes),''),scope_manifest,cutoff_time,cutoff_operation_id,supersedes_id);
  INSERT INTO public."AuditTrailReviewOperation" SELECT review_id,value FROM unnest(operation_ids) value;
  INSERT INTO public."AuditTrailReviewEvent" SELECT review_id,value FROM unnest(event_ids) value;
  RETURN review_id;
END;
$$;

CREATE FUNCTION covex_c_record_export(
  export_id UUID, request_id UUID, request_digest TEXT, actor_id UUID,
  export_format TEXT, file_name TEXT, file_data BYTEA, scope_manifest JSONB,
  cutoff_time TIMESTAMPTZ, cutoff_operation_id UUID,
  operation_ids UUID[], event_ids UUID[], row_count INTEGER
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE existing public."AuditTrailExport"; actor_name TEXT; content_hash TEXT;
BEGIN
  IF NOT public.covex_c_has_permission(actor_id,'AUDIT_TRAIL_EXPORT') THEN RAISE EXCEPTION 'Explicit audit export permission required'; END IF;
  SELECT "displayName" INTO actor_name FROM public."AuthUser" WHERE id=actor_id AND active AND "authorizedAt" IS NOT NULL FOR SHARE;
  IF actor_name IS NULL THEN RAISE EXCEPTION 'Active admitted exporter required'; END IF;
  SELECT * INTO existing FROM public."AuditTrailExport" WHERE "actorUserId"=actor_id AND "requestId"=request_id;
  IF FOUND THEN
    IF existing."requestDigest"<>request_digest THEN RAISE EXCEPTION 'Export request conflict'; END IF;
    RETURN existing.id;
  END IF;
  IF export_format<>'CSV_UTF8' OR request_digest !~ '^[0-9a-f]{64}$' OR file_name !~ '^[A-Za-z0-9._-]{1,180}$' OR octet_length(file_data)>20971520 THEN RAISE EXCEPTION 'Invalid controlled export'; END IF;
  IF cardinality(operation_ids) IS NULL OR cardinality(operation_ids)<1 OR cardinality(operation_ids)>5000 OR cardinality(event_ids) IS NULL OR cardinality(event_ids)<1 OR cardinality(event_ids)>10000 OR row_count<>cardinality(event_ids) THEN RAISE EXCEPTION 'Bounded exact export scope required'; END IF;
  IF cardinality(operation_ids)<>(SELECT count(DISTINCT value) FROM unnest(operation_ids) value) OR cardinality(event_ids)<>(SELECT count(DISTINCT value) FROM unnest(event_ids) value) THEN RAISE EXCEPTION 'Duplicate export scope'; END IF;
  IF (SELECT count(*) FROM public."AuditOperation" o WHERE o.id=ANY(operation_ids) AND (o."occurredAt",o.id)<=(cutoff_time,cutoff_operation_id))<>cardinality(operation_ids) THEN RAISE EXCEPTION 'Export operation scope changed or exceeds cut'; END IF;
  IF (SELECT count(*) FROM public."AuditEvent" e WHERE e.id=ANY(event_ids) AND e."operationId"=ANY(operation_ids))<>cardinality(event_ids) OR (SELECT count(DISTINCT e."operationId") FROM public."AuditEvent" e WHERE e.id=ANY(event_ids))<>cardinality(operation_ids) THEN RAISE EXCEPTION 'Export event scope mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM public."AuditEvent" e WHERE e.id=ANY(event_ids) AND (e."rootKey" LIKE 'ADMINISTRATION:%' OR EXISTS(SELECT 1 FROM public."AuditEventAdditionalTarget" a WHERE a."eventId"=e.id AND a."rootKey" LIKE 'ADMINISTRATION:%')))
    AND NOT public.covex_c_has_permission(actor_id,'AUDIT_TRAIL_SENSITIVE_READ') THEN RAISE EXCEPTION 'Sensitive audit permission required'; END IF;
  IF scope_manifest->'operationIds' IS DISTINCT FROM to_jsonb(operation_ids) OR scope_manifest->'eventIds' IS DISTINCT FROM to_jsonb(event_ids) THEN RAISE EXCEPTION 'Export manifest does not identify its exact scope'; END IF;
  content_hash:=encode(sha256(file_data),'hex');
  INSERT INTO public."AuditTrailExport"(id,"requestId","requestDigest","actorUserId","actorName",format,"fileName","fileData","contentSha256","rowCount","scopeManifest","cutoffOccurredAt","cutoffOperationId")
  VALUES(export_id,request_id,request_digest,actor_id,actor_name,export_format,file_name,file_data,content_hash,row_count,scope_manifest||jsonb_build_object('contentSha256',content_hash),cutoff_time,cutoff_operation_id);
  INSERT INTO public."AuditTrailExportEvent" SELECT export_id,value FROM unnest(event_ids) value;
  RETURN export_id;
END;
$$;

CREATE TRIGGER audit_c_review_immutable BEFORE UPDATE OR DELETE ON "AuditTrailReview" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_c_review_no_truncate BEFORE TRUNCATE ON "AuditTrailReview" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_c_review_operation_immutable BEFORE UPDATE OR DELETE ON "AuditTrailReviewOperation" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_c_review_operation_no_truncate BEFORE TRUNCATE ON "AuditTrailReviewOperation" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_c_review_event_immutable BEFORE UPDATE OR DELETE ON "AuditTrailReviewEvent" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_c_review_event_no_truncate BEFORE TRUNCATE ON "AuditTrailReviewEvent" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_c_export_immutable BEFORE UPDATE OR DELETE ON "AuditTrailExport" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_c_export_no_truncate BEFORE TRUNCATE ON "AuditTrailExport" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_c_export_event_immutable BEFORE UPDATE OR DELETE ON "AuditTrailExportEvent" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_c_export_event_no_truncate BEFORE TRUNCATE ON "AuditTrailExportEvent" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();

DO $$
DECLARE owner_role TEXT:=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public."AuditOperation"'::regclass)); function_id regprocedure; object_name TEXT;
BEGIN
  FOREACH object_name IN ARRAY ARRAY['AuditTrailReview','AuditTrailReviewOperation','AuditTrailReviewEvent','AuditTrailExport','AuditTrailExportEvent'] LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO %I',object_name,owner_role);
  END LOOP;
  FOR function_id IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'covex_c_%' LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO %I',function_id,owner_role);
  END LOOP;
  REVOKE ALL ON "AuditTrailReview","AuditTrailReviewOperation","AuditTrailReviewEvent","AuditTrailExport","AuditTrailExportEvent" FROM PUBLIC;
  REVOKE ALL ON FUNCTION covex_c_has_permission(UUID,TEXT),covex_c_record_review(UUID,UUID,TEXT,UUID,TEXT,TEXT,JSONB,TIMESTAMPTZ,UUID,UUID[],UUID[],UUID),covex_c_record_export(UUID,UUID,TEXT,UUID,TEXT,TEXT,BYTEA,JSONB,TIMESTAMPTZ,UUID,UUID[],UUID[],INTEGER) FROM PUBLIC;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='covex_app') THEN
    REVOKE ALL ON "AuditTrailReview","AuditTrailReviewOperation","AuditTrailReviewEvent","AuditTrailExport","AuditTrailExportEvent" FROM covex_app;
    GRANT SELECT ON "AuditTrailReview","AuditTrailReviewOperation","AuditTrailReviewEvent","AuditTrailExport","AuditTrailExportEvent" TO covex_app;
    GRANT EXECUTE ON FUNCTION covex_c_record_review(UUID,UUID,TEXT,UUID,TEXT,TEXT,JSONB,TIMESTAMPTZ,UUID,UUID[],UUID[],UUID),covex_c_record_export(UUID,UUID,TEXT,UUID,TEXT,TEXT,BYTEA,JSONB,TIMESTAMPTZ,UUID,UUID[],UUID[],INTEGER) TO covex_app;
  END IF;
END;
$$;

COMMIT;

-- B2 foundation: a durable requirement prevents unaudited regulated writes.
-- No activation or approval is inferred from installing this migration.
BEGIN;
CREATE TABLE "AuditPolicyRequirement" (
  "policyVersion" TEXT PRIMARY KEY CHECK ("policyVersion"='QMS_B2_V1'),
  "requirementReference" TEXT NOT NULL CHECK (length(btrim("requirementReference")) BETWEEN 1 AND 2000),
  "requestedByDatabasePrincipal" TEXT NOT NULL,
  "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION covex_b2_require_policy(requirement_reference TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF requirement_reference IS NULL OR length(btrim(requirement_reference)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Controlled requirement reference required'; END IF;
  IF EXISTS(SELECT 1 FROM public."AuditPolicyRequirement" WHERE "policyVersion"='QMS_B2_V1' AND "requirementReference"<>requirement_reference) THEN RAISE EXCEPTION 'Existing audit requirement cannot be replaced'; END IF;
  INSERT INTO public."AuditPolicyRequirement"("policyVersion","requirementReference","requestedByDatabasePrincipal")
    VALUES('QMS_B2_V1',requirement_reference,session_user) ON CONFLICT("policyVersion") DO NOTHING;
END;
$$;
CREATE FUNCTION covex_b2_required_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE operation_id UUID;
BEGIN
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
CREATE TRIGGER audit_b2_requirement_immutable BEFORE UPDATE OR DELETE ON "AuditPolicyRequirement" FOR EACH ROW EXECUTE FUNCTION covex_audit_immutable();
CREATE TRIGGER audit_b2_requirement_no_truncate BEFORE TRUNCATE ON "AuditPolicyRequirement" FOR EACH STATEMENT EXECUTE FUNCTION covex_audit_immutable();

CREATE FUNCTION covex_b2_required_truncate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public."AuditPolicyRequirement" WHERE "policyVersion"='QMS_B2_V1') THEN
    RAISE EXCEPTION USING ERRCODE='P4001',MESSAGE='Truncating required business audit scope is forbidden';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AlertRule" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AppParameter" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "Audit" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuditAnnualPlan" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuditAnnualProgrammeVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuditDepartment" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuditFinding" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuditFindingAction" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuditFindingRelation" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuditFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuditParticipant" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuditPlanChange" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuditPlanEntry" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuthAuthorizationChange" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuthRecordAssignment" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuthRole" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuthRolePermission" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuthUser" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuthUserDepartment" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "AuthUserRole" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "Capa" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "CapaActionFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "CapaFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "CapaPlannedAction" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ChangeControl" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ChangeControlFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ChangeControlTask" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ChangeControlTaskState" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ChangeHistory" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "Complaint" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ComplaintCapaPlan" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ComplaintDerivedAction" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ComplaintFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ConfigurationChange" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ControlledDecisionEvidence" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ControlledDocument" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ControlledDocumentChange" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ControlledDocumentImportBatch" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ControlledDocumentImportEvent" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ControlledDocumentImportRow" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ControlledDocumentRevision" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ControlledRevisionDecision" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ControlledRevisionDocument" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ControlledRevisionLifecycle" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "Department" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "Deviation" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "DeviationCapaPlan" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "DeviationFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "DeviationImmediateAction" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "FormFieldConfig" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "FormVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "GeneratedDocument" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "HistoricalImportBatch" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "HistoricalImportRow" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "LookupCatalog" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "LookupCatalogItem" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "QmsRecord" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "QmsRecordVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "QmsRelation" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "RecordVersionDocument" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ReturnFollowup" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ReturnProduct" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ReturnRecord" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ReviewMessage" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "ReviewThread" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();
CREATE TRIGGER audit_b2_required BEFORE INSERT OR UPDATE OR DELETE ON "TemplateVersion" FOR EACH ROW EXECUTE FUNCTION covex_b2_required_guard();

CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AlertRule" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AppParameter" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "Audit" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuditAnnualPlan" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuditAnnualProgrammeVersion" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuditDepartment" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuditFinding" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuditFindingAction" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuditFindingRelation" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuditFollowup" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuditParticipant" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuditPlanChange" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuditPlanEntry" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuthAuthorizationChange" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuthRecordAssignment" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuthRole" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuthRolePermission" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuthUser" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuthUserDepartment" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "AuthUserRole" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "Capa" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "CapaActionFollowup" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "CapaFollowup" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "CapaPlannedAction" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ChangeControl" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ChangeControlFollowup" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ChangeControlTask" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ChangeControlTaskState" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ChangeHistory" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "Complaint" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ComplaintCapaPlan" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ComplaintDerivedAction" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ComplaintFollowup" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ConfigurationChange" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ControlledDecisionEvidence" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ControlledDocument" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ControlledDocumentChange" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ControlledDocumentImportBatch" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ControlledDocumentImportEvent" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ControlledDocumentImportRow" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ControlledDocumentRevision" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ControlledRevisionDecision" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ControlledRevisionDocument" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ControlledRevisionLifecycle" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "Department" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "Deviation" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "DeviationCapaPlan" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "DeviationFollowup" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "DeviationImmediateAction" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "FormFieldConfig" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "FormVersion" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "GeneratedDocument" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "HistoricalImportBatch" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "HistoricalImportRow" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "LookupCatalog" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "LookupCatalogItem" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "QmsRecord" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "QmsRecordVersion" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "QmsRelation" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "RecordVersionDocument" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ReturnFollowup" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ReturnProduct" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ReturnRecord" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ReviewMessage" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "ReviewThread" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();
CREATE TRIGGER audit_b2_required_truncate BEFORE TRUNCATE ON "TemplateVersion" FOR EACH STATEMENT EXECUTE FUNCTION covex_b2_required_truncate();

REVOKE ALL ON FUNCTION covex_b2_require_policy(TEXT),covex_b2_required_guard(),covex_b2_required_truncate() FROM PUBLIC;
REVOKE ALL ON "AuditPolicyRequirement" FROM PUBLIC;
DO $$
DECLARE owner_role TEXT:=nullif(current_setting('covex.audit_owner_role',true),'');
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='covex_app') THEN
    REVOKE ALL ON "AuditPolicyRequirement" FROM covex_app;
    GRANT SELECT ON "AuditPolicyRequirement" TO covex_app;
  END IF;
  IF owner_role IS NULL AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname='covex_audit_owner') THEN owner_role:='covex_audit_owner'; END IF;
  IF owner_role IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=owner_role AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreaterole) THEN RAISE EXCEPTION 'Controlled non-login audit owner required'; END IF;
    EXECUTE format('ALTER TABLE public."AuditPolicyRequirement" OWNER TO %I',owner_role);
    EXECUTE format('ALTER FUNCTION public.covex_b2_require_policy(TEXT) OWNER TO %I',owner_role);
    EXECUTE format('ALTER FUNCTION public.covex_b2_required_guard() OWNER TO %I',owner_role);
    EXECUTE format('ALTER FUNCTION public.covex_b2_required_truncate() OWNER TO %I',owner_role);
  END IF;
END;
$$;
COMMIT;

-- Candidate only: run as the controlled owner AFTER migration on the approved DB.
-- Reapply after restore/no-acl; never run broad existing-table grants afterwards.
REVOKE ALL ON "AuditOperation","AuditOperationTarget","AuditEvent","AuditAggregateCursor","AuditRuntimeContext","AuditPilotRecord" FROM covex_app;
GRANT SELECT ON "AuditOperation","AuditOperationTarget","AuditEvent","AuditAggregateCursor","AuditPilotRecord" TO covex_app;
-- No production pilot UPDATE. Registered B1 policy refuses non-test databases.
GRANT EXECUTE ON FUNCTION covex_audit_begin(UUID,UUID,TEXT,TEXT,JSONB) TO covex_app;
-- Additive B2 objects, if installed. This procedure grants no activation and no
-- permission to require/approve a policy. The B2 foundation RPC still refuses
-- corporate databases until the complete controlled policy is available.
DO $$
DECLARE object_name TEXT; function_id regprocedure;
BEGIN
  FOR object_name IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN (
    'AuditPolicyRequirement','AuditAdministrationRoot','AuditEventAdditionalTarget','AuditBusinessContext','AuditMutationWitness','AuditRootBinding','AuditCaptureTablePolicy','AuditCaptureFieldPolicy','AuditOperationEvidence','AuditCommandResult','SignedDocumentCustody','AuditTechnicalContext','AuditTechnicalEvent','AuditRootMaturity','AuditOperationAssessment') LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM covex_app',object_name);
    IF object_name NOT IN ('AuditBusinessContext','AuditMutationWitness','AuditRootBinding','AuditTechnicalContext','AuditRootMaturity') THEN EXECUTE format('GRANT SELECT ON public.%I TO covex_app',object_name); END IF;
  END LOOP;
  FOR function_id IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'covex_b2_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM covex_app',function_id);
  END LOOP;
  IF to_regprocedure('public.covex_b2_begin(uuid,uuid,text,text,text,text,text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION covex_b2_begin(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT) TO covex_app;
  END IF;
  IF to_regprocedure('public.covex_b2_command_outcome(jsonb,jsonb)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION covex_b2_command_outcome(JSONB,JSONB),covex_b2_check_claims(UUID,JSONB) TO covex_app;
  END IF;
  IF to_regprocedure('public.covex_b2_retain_signed_original(uuid,text,text,text,bytea,text,text,text,text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION covex_b2_retain_signed_original(UUID,TEXT,TEXT,TEXT,BYTEA,TEXT,TEXT,TEXT,TEXT) TO covex_app;
  END IF;
  IF to_regprocedure('public.covex_b2_expire_staging(uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION covex_b2_expire_staging(UUID) TO covex_app;
  END IF;
END;
$$;

-- Candidate only: run as the controlled owner AFTER migration on the approved DB.
-- Reapply after restore/no-acl; never run broad existing-table grants afterwards.
REVOKE ALL ON "AuditOperation","AuditOperationTarget","AuditEvent","AuditAggregateCursor","AuditRuntimeContext","AuditPilotRecord" FROM covex_app;
GRANT SELECT ON "AuditOperation","AuditOperationTarget","AuditEvent","AuditAggregateCursor","AuditPilotRecord" TO covex_app;
-- No production pilot UPDATE. Registered B1 policy refuses non-test databases.
GRANT EXECUTE ON FUNCTION covex_audit_begin(UUID,UUID,TEXT,TEXT,JSONB) TO covex_app;

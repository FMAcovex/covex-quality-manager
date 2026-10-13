-- Candidate only. Provision once as DBA before migrations; no passwords here.
-- Three duties: non-login owner, controlled migrator, non-owner application.
CREATE ROLE covex_audit_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT covex_audit_owner TO covex_migrator;
-- For a different approved name, IT sets the database-local custom setting
-- covex.audit_owner_role before B1 migration. Never grant this role to the app.

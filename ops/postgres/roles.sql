-- Run manually as DBA in the approved NEW database only. No passwords in SQL.
-- Existing clusters: review roles/grants first; this script intentionally fails on duplicates.
CREATE ROLE covex_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE covex_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE covex_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE covex_recovery LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION;
-- Set four DIFFERENT secrets via psql \password or IT secret provisioning; never command args.
REVOKE ALL ON DATABASE covex_quality FROM PUBLIC;
GRANT CONNECT ON DATABASE covex_quality TO covex_app, covex_migrator, covex_backup;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO covex_migrator;
GRANT USAGE ON SCHEMA public TO covex_app, covex_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE covex_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO covex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE covex_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO covex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE covex_migrator IN SCHEMA public GRANT SELECT ON TABLES TO covex_backup;
-- Tables already migrated: DBA reviews and grants the same privileges explicitly.
-- App has no CREATE/ALTER/TRUNCATE grant and is never database/table owner.
-- Restrict recovery role/network to the independent recovery cluster and maintenance window.

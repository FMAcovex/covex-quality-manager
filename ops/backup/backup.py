"""PostgreSQL 16 recovery tools. No application data or subprocess errors in logs.

Encryption: OpenSSL AES-256-CBC/PBKDF2, encrypt-then-MAC via authenticated
manifest and ciphertext SHA-256. Encryption and HMAC keys are separate.
Only new, explicitly named recovery databases can be created; no DROP/clean.
"""
import argparse
import contextlib
import datetime as dt
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import uuid

try:
    from storage import StorageUnavailable, destination
except ModuleNotFoundError:
    from ops.backup.storage import StorageUnavailable, destination


class Refused(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise Refused(reason)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def digest(path):
    with Path(path).open("rb") as stream:
        hasher = hashlib.sha256()
        while block := stream.read(1024 * 1024):
            hasher.update(block)
        return hasher.hexdigest()


def private_file(path):
    path = Path(path)
    require(not path.is_symlink() and path.is_file(), "private-file-required")
    require(os.name != "posix" or not path.stat().st_mode & 0o077, "private-permissions-required")
    return path


def write_json(path, value):
    path = Path(path)
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    with temporary.open("xb") as stream:
        os.chmod(temporary, 0o600)
        stream.write(canonical(value) + b"\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def config(path):
    value = json.loads(private_file(path).read_text())
    require(value.get("environment") in ["test", "production"], "explicit-environment-required")
    require(value.get("approval_reference") and value.get("assets_consistency") in ["immutable-release", "maintenance-approved"], "asset-consistency-approval-required")
    require(re.fullmatch(r"[a-f0-9]{40}", value.get("release_sha", "")), "release-sha-required")
    require(value.get("external_reference_policy") == "references-only-accepted", "external-custody-decision-required")
    if value["environment"] == "production":
        require(not value["approval_reference"].upper().startswith("PENDING"), "production-approval-pending")
        require(value["source"]["sslmode"] == "verify-full", "production-database-tls-required")
    else:
        require(value["source"]["host"] in ["localhost", "127.0.0.1", "::1"] and re.fullmatch(r"covex_phase4b1_test_4b2_[a-z0-9_]+", value["source"]["database"]), "test-source-must-be-disposable")
    for field in ["encryption_key", "manifest_key"]:
        key = private_file(value[field]).read_bytes().strip()
        require(len(key) >= 64 and b"\n" not in key, "independent-strong-keys-required")
    require(Path(value["encryption_key"]).read_bytes() != Path(value["manifest_key"]).read_bytes(), "independent-strong-keys-required")
    require(value.get("command_timeout_seconds", 3600) > 0, "timeout-required")
    return value


def connection_env(connection, database=None):
    require(all(isinstance(connection.get(k), str) and connection[k] for k in ["host", "database", "user", "passfile", "sslmode"]), "connection-incomplete")
    require(re.fullmatch(r"[a-z][a-z0-9_]{0,62}", database or connection["database"]), "database-name-refused")
    private_file(connection["passfile"])
    require(connection["sslmode"] in ["disable", "verify-full"], "ssl-policy-refused")
    if connection["sslmode"] == "verify-full":
        require(Path(connection.get("sslrootcert", "")).is_file(), "database-ca-required")
    # Do not inherit libpq password/service/options values from another environment.
    env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
    env.update(PGHOST=connection["host"], PGPORT=str(connection.get("port", 5432)), PGDATABASE=database or connection["database"], PGUSER=connection["user"], PGPASSFILE=connection["passfile"], PGSSLMODE=connection["sslmode"], PGCONNECT_TIMEOUT="5", PGAPPNAME="covex-recovery", PGOPTIONS="-c statement_timeout=3600000 -c lock_timeout=10000")
    if connection.get("sslrootcert"):
        env["PGSSLROOTCERT"] = connection["sslrootcert"]
    return env


def run(args, env=None, data=None, timeout=3600):
    result = subprocess.run(args, env=env, input=data, capture_output=True, timeout=timeout)
    require(result.returncode == 0, "tool-failed-" + Path(args[0]).name)
    return result.stdout


def pg_version(connection):
    env = connection_env(connection)
    require(b" 16." in run(["pg_dump", "--version"], env), "postgresql-client-16-required")
    require(sql(connection, "SELECT current_setting('server_version_num');").strip().startswith(b"16"), "postgresql-server-16-required")


def sql(connection, statement, database=None):
    return run(["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], connection_env(connection, database), statement.encode())


@contextlib.contextmanager
def snapshot(connection):
    process = subprocess.Popen(["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], env=connection_env(connection), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    try:
        process.stdin.write("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();\n")
        process.stdin.flush()
        value = process.stdout.readline().strip()
        require(re.fullmatch(r"[0-9A-F]+-[0-9A-F]+-[0-9]+", value), "snapshot-failed")
        yield value
    finally:
        if process.poll() is None:
            process.stdin.close()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


def inventory(connection, exported_snapshot=None):
    prefix = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL extra_float_digits=3; "
    if exported_snapshot:
        require(re.fullmatch(r"[0-9A-F]+-[0-9A-F]+-[0-9]+", exported_snapshot), "snapshot-refused")
        prefix += "SET TRANSACTION SNAPSHOT '" + exported_snapshot + "'; "
    names = sql(connection, prefix + "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename; COMMIT;").decode().splitlines()
    tables, files, unresolved = {}, [], 0
    for name in names:
        # Database identifiers never come from an untrusted SQL fragment.
        require(re.fullmatch(r"[A-Za-z_][A-Za-z_0-9]*", name), "table-name-refused")
        query = prefix + f'SELECT row_to_json(t)::text FROM public."{name}" t ORDER BY row_to_json(t)::text COLLATE "C"; COMMIT;'
        process = subprocess.Popen(["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], env=connection_env(connection), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        count, hasher = 0, hashlib.sha256()
        process.stdin.write(query.encode())
        process.stdin.close()
        try:
            for line in process.stdout:
                count += 1
                hasher.update(line)
                row = json.loads(line)
                if row.get("fileData") is not None:
                    data = row["fileData"]
                    require(isinstance(data, str) and data.startswith("\\x"), "binary-encoding-refused")
                    binary = bytes.fromhex(data[2:])
                    stored = row.get("checksum") or row.get("sha256")
                    require(not stored or hmac.compare_digest(stored, hashlib.sha256(binary).hexdigest()), "document-checksum-mismatch")
                    size = row.get("fileSize", row.get("sizeBytes"))
                    require(size is None or size == len(binary), "document-size-mismatch")
                if name == "TemplateVersion" and row.get("filePath") and row.get("fileData") is None:
                    files.append(row["filePath"])
                if name == "ControlledRevisionDocument" and row.get("externalReference"):
                    unresolved += 1
            require(process.wait(timeout=30) == 0, "inventory-query-failed")
        finally:
            process.stdout.close()
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
        tables[name] = {"rows": count, "sha256": hasher.hexdigest()}
    shape = sql(connection, prefix + "SELECT json_build_array(c.relname, a.attname, format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid))::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum; SELECT json_build_array(c.relname,x.conname,pg_get_constraintdef(x.oid),x.convalidated)::text FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,x.conname; SELECT json_build_array(tablename,indexname,indexdef)::text FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname; SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' ORDER BY p.proname,pg_get_function_identity_arguments(p.oid); SELECT pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname; SELECT json_build_array(t.typname,e.enumlabel,e.enumsortorder)::text FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder; COMMIT;")
    return {"tables": tables, "schema_sha256": hashlib.sha256(shape).hexdigest(), "external_references_without_custody": unresolved}, files


def audit_contract(connection):
    """Recognize installed journal releases without inferring activation."""
    b2 = sql(connection, 'SELECT to_regclass(\'public."AuditPolicyRequirement"\') IS NOT NULL;').strip() == b"t"
    if not b2 and sql(connection, "SELECT to_regclass('public._prisma_migrations') IS NOT NULL;").strip() == b"t":
        installed = sql(connection, "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name='20261013000200_b2_audit_requirement' AND finished_at IS NOT NULL AND rolled_back_at IS NULL;").strip()
        require(installed == b"0", "audit-protection-unavailable")
    capture = sql(connection, 'SELECT to_regclass(\'public."AuditBusinessContext"\') IS NOT NULL;').strip() == b"t"
    if not capture and sql(connection, "SELECT to_regclass('public._prisma_migrations') IS NOT NULL;").strip() == b"t":
        installed = sql(connection, "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name='20261013000300_b2_sql_capture' AND finished_at IS NOT NULL AND rolled_back_at IS NULL;").strip()
        require(installed == b"0", "audit-protection-unavailable")
    composition = sql(connection, 'SELECT to_regclass(\'public."AuditCommandResult"\') IS NOT NULL;').strip() == b"t"
    if not composition and sql(connection, "SELECT to_regclass('public._prisma_migrations') IS NOT NULL;").strip() == b"t":
        installed = sql(connection, "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name='20261013000400_b2_command_composition' AND finished_at IS NOT NULL AND rolled_back_at IS NULL;").strip()
        require(installed == b"0", "audit-protection-unavailable")
    documents = sql(connection, 'SELECT to_regclass(\'public."SignedDocumentCustody"\') IS NOT NULL;').strip() == b"t"
    if not documents and sql(connection, "SELECT to_regclass('public._prisma_migrations') IS NOT NULL;").strip() == b"t":
        installed = sql(connection, "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name='20261013000500_b2_signed_originals' AND finished_at IS NOT NULL AND rolled_back_at IS NULL;").strip()
        require(installed == b"0", "audit-protection-unavailable")
    filename = "audit-contract-b2-documents.json" if documents else "audit-contract-b2-integration.json" if composition else "audit-contract-b2-capture.json" if capture else "audit-contract-b2.json" if b2 else "audit-contract.json"
    return json.loads(Path(__file__).with_name(filename).read_text())


def audit_restore_acl(connection):
    # --no-acl deliberately avoids source cluster identities. Restore secure
    # PUBLIC exceptions explicitly before any protection check/access opening.
    contract = audit_contract(connection)
    names = ",".join("'" + name + "'" for name in contract["functions"])
    statements = sql(connection, f"SELECT 'REVOKE ALL ON FUNCTION '||p.oid::regprocedure::text||' FROM PUBLIC;' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ({names});").decode()
    if statements.strip():
        sql(connection, statements)
        tables = ",".join('"' + name + '"' for name in contract["tables"])
        sql(connection, "REVOKE ALL ON " + tables + " FROM PUBLIC;")
        # Default privileges of the recovery account can reintroduce writers
        # despite --no-acl. Remove those on NEW journal objects only.
        protected = ",".join("'" + name + "'" for name in contract["tables"] if name != "AuditPilotRecord")
        revocations = sql(connection, f"SELECT DISTINCT 'REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE public.'||quote_ident(c.relname)||' FROM '||quote_ident(r.rolname)||';' FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a JOIN pg_roles r ON r.oid=a.grantee WHERE n.nspname='public' AND c.relname IN ({protected}) AND NOT pg_has_role(a.grantee,c.relowner,'USAGE');").decode()
        if revocations.strip():
            sql(connection, revocations)
        private = ",".join("'" + name + "'" for name in contract.get("privateTables", ["AuditRuntimeContext"]))
        readers = sql(connection, f"SELECT DISTINCT 'REVOKE SELECT ON TABLE public.'||quote_ident(c.relname)||' FROM '||quote_ident(r.rolname)||';' FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a JOIN pg_roles r ON r.oid=a.grantee WHERE n.nspname='public' AND c.relname IN ({private}) AND NOT pg_has_role(a.grantee,c.relowner,'USAGE') AND a.privilege_type='SELECT';").decode()
        if readers.strip():
            sql(connection, readers)


def audit_protection(connection):
    """A legacy database has no B1 tables. Partial/weakened B1 is quarantined.

    Compare the release contract independently of database function assertions.
    pg_restore loads data before triggers: historical events are copied, not made.
    """
    contract = audit_contract(connection)
    names = ",".join("'" + name + "'" for name in contract["tables"])
    tables = json.loads(sql(connection, f"SELECT coalesce(json_agg(json_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner))),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ({names});"))
    if not tables:
        functions_present = sql(connection, "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE 'covex_audit_%' OR p.proname LIKE 'covex_b2_%');").strip()
        require(functions_present == b"0", "audit-protection-unavailable")
        has_migrations = sql(connection, "SELECT to_regclass('public._prisma_migrations') IS NOT NULL;").strip() == b"t"
        if has_migrations:
            installed = sql(connection, "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name='20261013000100_audit_engine_b1' AND finished_at IS NOT NULL AND rolled_back_at IS NULL;").strip()
            require(installed == b"0", "audit-protection-unavailable")
        return
    require(len(tables) == len(contract["tables"]) and len({row["owner"] for row in tables}) == 1, "audit-protection-unavailable")
    protected = ",".join("'" + name + "'" for name in contract["tables"] if name != "AuditPilotRecord")
    private = ",".join("'" + name + "'" for name in contract.get("privateTables", ["AuditRuntimeContext"]))
    # A dump must include the (empty) private tables. The configured snapshot
    # connection is allowed to read them only when it has no business DML.
    # Application writers and unrelated readers are not exempted by this rule.
    readonly_snapshot = "a.grantee=(SELECT oid FROM pg_roles WHERE rolname=session_user) AND NOT EXISTS(SELECT 1 FROM pg_class b JOIN pg_namespace bn ON bn.oid=b.relnamespace WHERE bn.nspname='public' AND b.relkind IN ('r','p') AND (has_table_privilege(session_user,b.oid,'DELETE,TRUNCATE') OR has_any_column_privilege(session_user,b.oid,'INSERT') OR has_any_column_privilege(session_user,b.oid,'UPDATE')))"
    unsafe = sql(connection, f"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='public' AND c.relname IN ({protected}) AND (a.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER') OR c.relname IN ({private}) AND a.privilege_type='SELECT' AND NOT ({readonly_snapshot})) AND CASE WHEN a.grantee=0 THEN true ELSE NOT pg_has_role(a.grantee,c.relowner,'USAGE') END;").strip()
    require(unsafe == b"0", "audit-protection-unavailable")
    functions = json.loads(sql(connection, "SELECT coalesce(json_agg(json_build_object('name',p.proname,'body',p.prosrc,'definer',p.prosecdef,'config',p.proconfig,'owner',pg_get_userbyid(p.proowner),'publicExecute',EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE'))),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE 'covex_audit_%' OR p.proname LIKE 'covex_b2_%');"))
    require(len(functions) == len(contract["functions"]), "audit-protection-unavailable")
    for name, expected in contract["functions"].items():
        actual = next((row for row in functions if row["name"] == name), {})
        require(actual and hashlib.sha256(actual["body"].encode()).hexdigest() == expected["sha256"] and actual["definer"] == expected["definer"] and actual["config"] == ["search_path=pg_catalog, public"] and actual["owner"] == tables[0]["owner"] and not actual["publicExecute"], "audit-protection-unavailable")
    guards = ",".join("'" + name + "'" for name in contract.get("guardTables", [])) or "NULL"
    triggers = json.loads(sql(connection, f"SELECT coalesce(json_agg(json_build_object('name',t.tgname,'table',c.relname,'function',p.proname,'enabled',t.tgenabled,'type',t.tgtype,'deferred',t.tginitdeferred,'deferrable',t.tgdeferrable)),'[]') FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid WHERE n.nspname='public' AND (c.relname IN ({names}) OR c.relname IN ({guards}) AND t.tgname LIKE 'audit_b2_%') AND NOT t.tgisinternal;"))
    require(len(triggers) == len(contract["triggers"]), "audit-protection-unavailable")
    for expected in contract["triggers"]:
        actual = next((row for row in triggers if row["name"] == expected["name"] and row["table"] == expected["table"]), {})
        require(actual and actual["enabled"] == "O" and actual["function"] == expected["function"] and actual["type"] == expected["type"] and actual["deferred"] == actual["deferrable"] == expected["deferred"], "audit-protection-unavailable")
    for table in contract.get("privateTables", ["AuditRuntimeContext"]):
        require(sql(connection, f'SELECT count(*) FROM "{table}";').strip() == b"0", "audit-protection-unavailable")
    if "capturePolicySha256" in contract:
        metadata = json.loads(sql(connection, '''SELECT jsonb_agg(jsonb_build_object('entityType',t."entityType",'primaryKey',t."primaryKey",'rootPaths',t."rootPaths",'captureMode',t."captureMode",'fields',
          (SELECT jsonb_agg(jsonb_build_object('fieldPath',f."fieldPath",'valueType',f."valueType",'transform',f.transform,'critical',f.critical) ORDER BY f."fieldPath") FROM "AuditCaptureFieldPolicy" f WHERE f."entityType"=t."entityType")) ORDER BY t."entityType") FROM "AuditCaptureTablePolicy" t;'''))
        digest = hashlib.sha256(json.dumps(metadata, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
        require(digest == contract["capturePolicySha256"], "audit-protection-unavailable")


def asset_files(value):
    files, sources = {}, {}
    for asset in value.get("assets", []):
        label, root = asset["label"], Path(asset["path"])
        require(re.fullmatch(r"[a-z][a-z0-9_-]{0,40}", label) and label not in sources, "asset-label-refused")
        require(root.is_dir() and not root.is_symlink(), "asset-root-refused")
        sources[label] = root.resolve()
        for path in sorted(root.rglob("*")):
            require(not path.is_symlink(), "asset-symlink-refused")
            require(path.is_file() or path.is_dir(), "asset-special-file-refused")
            if path.is_file():
                files[label + "/" + path.relative_to(root).as_posix()] = {"sha256": digest(path), "size": path.stat().st_size}
    return files, sources


def crypt(source, target, key, decrypt=False):
    args = ["openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-iter", "600000", "-salt", "-pass", "file:" + str(private_file(key)), "-in", str(source), "-out", str(target)]
    if decrypt:
        args.append("-d")
    run(args)
    os.chmod(target, 0o600)


def signature(manifest, value):
    key = private_file(value["manifest_key"]).read_bytes().strip()
    return hmac.new(key, b"COVEX-BACKUP-v1\0" + canonical(manifest), hashlib.sha256).hexdigest()


def verify(bundle, value):
    bundle = Path(bundle)
    require(bundle.is_dir() and not bundle.is_symlink(), "bundle-refused")
    manifest = json.loads(private_file(bundle / "manifest.json").read_text())
    mac = private_file(bundle / "manifest.mac").read_text().strip()
    require(manifest.get("format") == 1 and hmac.compare_digest(signature(manifest, value), mac), "manifest-authentication-failed")
    require(set(manifest["encrypted_files"]) == {"database.dump.enc", "assets.tar.enc"}, "bundle-inventory-refused")
    for name, checksum in manifest["encrypted_files"].items():
        require(hmac.compare_digest(digest(private_file(bundle / name)), checksum), "ciphertext-checksum-mismatch")
    return manifest


def backup(value):
    with destination(value) as (output, descriptor, check):
        return backup_at_destination(value, output, descriptor, check)


def backup_at_destination(value, output, descriptor, check):
    source = value["source"]
    pg_version(source)
    audit_protection(source)
    check()
    identifier = "covex-" + dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex
    with tempfile.TemporaryDirectory(prefix="covex-plain-", dir=value["temporary_directory"]) as scratch, tempfile.TemporaryDirectory(prefix=".pending-", dir=output) as staging:
        scratch, staging = Path(scratch), Path(staging)
        with snapshot(source) as exported:
            run(["pg_dump", "--format=custom", "--no-owner", "--no-acl", "--snapshot=" + exported, "--file=" + str(scratch / "database.dump")], connection_env(source), timeout=value.get("command_timeout_seconds", 3600))
            contents, required_files = inventory(source, exported)
            files, roots = asset_files(value)
            application_root = Path(value["application_root"]).resolve()
            for required_file in required_files:
                path = Path(required_file)
                path = (path if path.is_absolute() else application_root / path).resolve()
                require(path.is_file() and any(path == root / key.split("/", 1)[1] for label, root in roots.items() for key in files if key.startswith(label + "/")), "uncaptured-template-file")
            with tarfile.open(scratch / "assets.tar", "w") as archive:
                for name in files:
                    label, relative = name.split("/", 1)
                    archive.add(roots[label] / relative, arcname=name, recursive=False)
            require(asset_files(value)[0] == files, "assets-changed-during-backup")
        for name in ["database.dump", "assets.tar"]:
            crypt(scratch / name, staging / (name + ".enc"), value["encryption_key"])
        manifest = {"format": 1, "id": identifier, "created_at": dt.datetime.now(dt.timezone.utc).isoformat(), "release_sha": value["release_sha"], "approval_reference": value["approval_reference"], "crypto": "AES256CBC-PBKDF2-600000+HMACSHA256-manifest", "database": contents, "assets": files, "encrypted_files": {name: digest(staging / name) for name in ["database.dump.enc", "assets.tar.enc"]}}
        write_json(staging / "manifest.json", manifest)
        (staging / "manifest.mac").write_text(signature(manifest, value) + "\n")
        os.chmod(staging / "manifest.mac", 0o600)
        verify(staging, value)
        audit_protection(source)
        check()
        os.rename(staging.name, identifier, src_dir_fd=descriptor, dst_dir_fd=descriptor)
        try:
            os.fsync(descriptor)
            check()
        except Exception:
            # Remove only the unpublished success candidate on the pinned volume.
            shutil.rmtree(output / identifier)
            raise
    return {"status": "success", "operation": "backup", "bundle": identifier, "release_sha": value["release_sha"], "external_references_without_custody": contents["external_references_without_custody"]}


def restore_target(value, name, confirmation):
    pattern = r"covex_phase4b1_test_4b2_restore_[a-f0-9]{16}" if value["environment"] == "test" else r"covex_restore_[a-z0-9_]{8,40}"
    require(name == confirmation and re.fullmatch(pattern, name), "explicit-new-recovery-database-required")
    target, source = value["recovery"], value["source"]
    require(target["host"] in value.get("approved_recovery_hosts", []) and target["database"] == "postgres", "recovery-host-not-approved")
    if value["environment"] == "test":
        require(target["host"] in ["127.0.0.1", "localhost", "::1"] and source["host"] in ["127.0.0.1", "localhost", "::1"], "test-recovery-must-be-loopback")
        require(re.fullmatch(r"covex_phase4b1_test_4b2_[a-z0-9_]+", source["database"]), "test-source-must-be-disposable")
    else:
        require((source["host"], source.get("port", 5432)) != (target["host"], target.get("port", 5432)), "independent-recovery-server-required")
        require(source["sslmode"] == target["sslmode"] == "verify-full", "production-database-tls-required")
    return target


def extract_assets(archive, destination, expected):
    require(not Path(destination).exists() and not Path(destination).is_symlink(), "new-assets-destination-required")
    with tarfile.open(archive) as tar:
        members = tar.getmembers()
        require(len(members) == len(expected), "asset-count-mismatch")
        require(len({m.name for m in members}) == len(members), "duplicate-assets-refused")
        for member in members:
            path = Path(member.name)
            require(member.isfile() and not path.is_absolute() and ".." not in path.parts and member.name in expected and member.size == expected[member.name]["size"], "asset-path-refused")
        Path(destination).mkdir(mode=0o700, parents=False)
        for member in members:
            path = Path(destination) / member.name
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            with tar.extractfile(member) as source, path.open("xb") as target:
                shutil.copyfileobj(source, target)
            os.chmod(path, 0o600)
            require(digest(path) == expected[member.name]["sha256"], "asset-checksum-mismatch")


def restore(value, bundle, name, confirmation, assets_destination):
    # All guards/authentication/decryption precede database creation. No clean, DROP, or seed.
    target = restore_target(value, name, confirmation)
    manifest = verify(bundle, value)
    pg_version(target)
    require(not sql(target, f"SELECT datname FROM pg_database WHERE datname='{name}';").strip(), "existing-database-refused")
    require(not Path(assets_destination).exists(), "new-assets-destination-required")
    with tempfile.TemporaryDirectory(prefix="covex-restore-", dir=value["temporary_directory"]) as scratch:
        scratch = Path(scratch)
        for file in ["database.dump", "assets.tar"]:
            crypt(Path(bundle) / (file + ".enc"), scratch / file, value["encryption_key"], decrypt=True)
        run(["pg_restore", "--list", str(scratch / "database.dump")])
        extract_assets(scratch / "assets.tar", assets_destination, manifest["assets"])
        sql(target, f'CREATE DATABASE "{name}" TEMPLATE template0;')
        sql(target, f'REVOKE CONNECT ON DATABASE "{name}" FROM PUBLIC;')
        run(["pg_restore", "--exit-on-error", "--single-transaction", "--no-owner", "--no-acl", "--dbname=" + name, str(scratch / "database.dump")], connection_env(target, name), timeout=value.get("command_timeout_seconds", 3600))
        restored = {**target, "database": name}
        audit_restore_acl(restored)
        audit_protection(restored)
        contents, _ = inventory(restored)
        require(contents == manifest["database"], "restored-content-mismatch")
        # Snapshot equality is verified BEFORE operational sessions are invalidated.
        sql(restored, 'BEGIN; UPDATE "AuthSession" SET "revokedAt"=clock_timestamp() WHERE "revokedAt" IS NULL; DELETE FROM "AuthLoginAttempt"; COMMIT;')
        require(sql(restored, 'SELECT count(*) FROM "AuthSession" WHERE "revokedAt" IS NULL; SELECT count(*) FROM "AuthLoginAttempt";').decode().splitlines() == ["0", "0"], "restored-session-revocation-failed")
    return {"status": "success", "operation": "restore", "bundle": manifest["id"], "release_sha": manifest["release_sha"], "integrity": "verified", "sessions": "revoked", "access": "quarantined-pending-IT-QA-reconciliation", "external_references_without_custody": contents["external_references_without_custody"]}


def prune(value, keep, days, confirmation):
    require(confirmation == "approved-local-retention" and keep >= 2 and days > 0, "retention-approval-required")
    with destination(value) as (root, _, check):
        return prune_at_destination(value, keep, days, root, check)


def prune_at_destination(value, keep, days, root, check):
    # Authenticated bundles only; unknown/pending files are never deleted.
    bundles = []
    for path in root.glob("covex-*"):
        manifest = verify(path, value)
        created = dt.datetime.fromisoformat(manifest["created_at"])
        require(created.tzinfo is not None, "retention-date-refused")
        bundles.append((created, path))
    bundles.sort(reverse=True)
    threshold = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
    for created, path in bundles[keep:]:
        if created < threshold:
            check()
            shutil.rmtree(path)
    check()
    return {"status": "success", "operation": "prune", "scope": "local-only"}


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["backup", "verify", "restore", "prune"])
    parser.add_argument("--config", required=True)
    parser.add_argument("--bundle")
    parser.add_argument("--target")
    parser.add_argument("--confirm")
    parser.add_argument("--assets-out")
    parser.add_argument("--keep", type=int)
    parser.add_argument("--older-than-days", type=int)
    args = parser.parse_args()
    value = None
    try:
        value = config(args.config)
        if args.operation == "backup":
            result = backup(value)
        elif args.operation == "verify":
            verify(args.bundle, value)
            result = {"status": "success", "operation": "verify", "scope": "authenticated-encrypted-artifact"}
        elif args.operation == "restore":
            require(args.target and args.assets_out and args.confirm, "restore-arguments-required")
            result = restore(value, args.bundle, args.target, args.confirm, args.assets_out)
        else:
            require(args.keep is not None and args.older_than_days is not None, "retention-policy-required")
            result = prune(value, args.keep, args.older_than_days, args.confirm)
    except Exception as error:
        result = {"status": "failure", "operation": args.operation, "reason": str(error) if isinstance(error, (Refused, StorageUnavailable)) else "operation-failed-review-privately", "access": "quarantined"}
    if value and value.get("status_directory"):
        directory = Path(value["status_directory"])
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        write_json(directory / (args.operation + ".json"), {**result, "checked_at": dt.datetime.now(dt.timezone.utc).isoformat()})
    print(json.dumps(result))
    return 1 if result["status"] == "failure" else 0


if __name__ == "__main__":
    raise SystemExit(main())

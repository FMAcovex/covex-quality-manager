"""Private technical release evidence; this is not a validated GMP audit trail."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path


def record(release, schema, configuration, backup, checks, operator):
    def require(condition, reason):
        if not condition:
            raise ValueError(reason)
    require(release["format"] == 1 and len(release["commit"]) == 40, "Release manifest invalid")
    expected = {r["name"]: r["sha256"] for r in release["migrations"]}
    require(all(r["finished"] and not r["rolled_back"] for r in schema), "Unresolved migration evidence")
    require({r["migration_name"]: r["checksum"] for r in schema} == expected, "Release/schema mismatch")
    require(set(configuration) == {"approval_reference", "environment", "dns", "infrastructure", "secret_version_references"}, "Use approved non-secret configuration metadata only")
    require(configuration["environment"] == "production" and configuration["approval_reference"] and not configuration["approval_reference"].upper().startswith("PENDING"), "Configuration approval pending")
    require(backup["status"] == "success" and backup["operation"] == "backup" and backup["bundle"], "Backup evidence missing")
    require(set(checks) == {"health", "oidc", "permissions", "documents"} and all(v is True for v in checks.values()), "Acceptance checks incomplete")
    require(operator, "Responsible operator reference required")
    return {"format": 1, "commit": release["commit"], "version": release["version"], "migrations": expected, "approved_configuration_sha256": hashlib.sha256(json.dumps(configuration, sort_keys=True).encode()).hexdigest(), "approval_reference": configuration["approval_reference"], "deployed_at": dt.datetime.now(dt.timezone.utc).isoformat(), "operator_reference": operator, "predeployment_backup": backup["bundle"], "checks": checks, "acceptance": "technical-evidence-requires-IT-QA-review"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    for name in ["release", "schema", "configuration", "backup", "checks", "operator", "out"]:
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    os.umask(0o077)
    try:
        values = {name: json.loads(Path(getattr(args, name)).read_text()) for name in ["release", "schema", "configuration", "backup", "checks"]}
        evidence = record(**values, operator=args.operator)
        with Path(args.out).open("x") as stream:
            json.dump(evidence, stream, indent=2)
        print(json.dumps({"status": "success", "operation": "deployment-record", "commit": evidence["commit"]}))
    except Exception:
        print(json.dumps({"status": "failure", "operation": "deployment-record"}))
        raise SystemExit(1)

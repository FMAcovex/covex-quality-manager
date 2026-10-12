"""Required final check. Missing, stale, failed or skipped code evidence is a failure."""
import json
import os
import pathlib

def evaluate(sha, classified_sha, documentation, needs, evidence, groups):
    errors = []
    if sha != classified_sha or needs.get("scope", {}).get("result") != "success":
        errors.append("Scope absent, failed or from another SHA")
    if documentation:
        for job in ["quality", "regression"]:
            if needs.get(job, {}).get("result") != "skipped":
                errors.append(f"Documentation route expected {job} skipped")
        return errors
    for job in ["quality", "regression"]:
        if needs.get(job, {}).get("result") != "success":
            errors.append(f"Required job {job}: {needs.get(job, {}).get('result', 'absent')}")
    if set(evidence) != {"quality", *groups}:
        errors.append("Missing or unexpected evidence groups")
    for name in {"quality", *groups}:
        row = evidence.get(name, {})
        if row.get("sha") != sha or row.get("status") != "success":
            errors.append(f"{name}: stale, missing or failed evidence")
        if name in groups:
            suite = groups[name]
            commands = ["db:deploy", "db:seed"] + suite["db"] + suite["ui"] + [item[0] for item in suite.get("auth", [])]
            if [item.get("command") for item in row.get("commands", [])] != commands:
                errors.append(f"{name}: suite inventory incomplete")
            if any(item.get("status") != 0 for item in row.get("commands", [])):
                errors.append(f"{name}: failed suite")
    return errors

def main():
    evidence = {}
    for path in pathlib.Path("ci-evidence").glob("*.json"):
        row = json.loads(path.read_text())
        if row["group"] in evidence:
            raise RuntimeError("Duplicate evidence")
        evidence[row["group"]] = row
    groups = json.loads(pathlib.Path(".github/ci-suites.json").read_text())
    errors = evaluate(os.environ["TESTED_SHA"], os.environ["CLASSIFIED_SHA"], os.environ["DOCS_ONLY"] == "true", json.loads(os.environ["NEEDS_JSON"]), evidence, groups)
    result = {"sha": os.environ["TESTED_SHA"], "status": "failure" if errors else "success", "documentationOnly": os.environ["DOCS_ONLY"] == "true", "groups": sorted(evidence), "errors": errors}
    pathlib.Path("gate-result.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()

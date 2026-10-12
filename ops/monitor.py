"""Read-only technical monitoring; no alerts, record data, credentials or tokens."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import shutil
import subprocess
import urllib.request
from backup.storage import inspect

parser = argparse.ArgumentParser()
parser.add_argument("--health-url", default="http://127.0.0.1:3000/api/health")
parser.add_argument("--backup-status", required=True)
parser.add_argument("--backup-config", required=True)
parser.add_argument("--max-backup-age-seconds", type=int, required=True)
parser.add_argument("--disk", required=True)
parser.add_argument("--min-free-bytes", type=int, required=True)
parser.add_argument("--certificate")
parser.add_argument("--min-cert-seconds", type=int, default=2592000)
parser.add_argument("--service", action="append", default=[])
args = parser.parse_args()
checks = {}
try:
    inspect(json.loads(Path(args.backup_config).read_text()))
    checks["backup_storage_available"] = True
except Exception:
    checks["backup_storage_available"] = False
for service in args.service:
    checks["supervised_service_" + service] = subprocess.run(["systemctl", "is-active", "--quiet", service], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
try:
    with urllib.request.urlopen(args.health_url, timeout=5) as response:
        body = json.load(response)
        checks["application_database"] = response.status == 200 and body.get("status") == body.get("database") == "ok"
except Exception:
    checks["application_database"] = False
try:
    state = json.loads(Path(args.backup_status).read_text())
    age = (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(state["checked_at"])).total_seconds()
    checks["backup_recent_success"] = state["status"] == "success" and state["operation"] == "backup" and 0 <= age <= args.max_backup_age_seconds
except Exception:
    checks["backup_recent_success"] = False
try:
    checks["disk_capacity"] = shutil.disk_usage(args.disk).free >= args.min_free_bytes
except Exception:
    checks["disk_capacity"] = False
if args.certificate:
    checks["certificate_validity"] = subprocess.run(["openssl", "x509", "-in", args.certificate, "-noout", "-checkend", str(args.min_cert_seconds)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
metrics = {"load_average": list(os.getloadavg())} if hasattr(os, "getloadavg") else {}
if Path("/proc/meminfo").is_file():
    memory = dict(line.split(":", 1) for line in Path("/proc/meminfo").read_text().splitlines())
    metrics["memory_available_kib"] = int(memory["MemAvailable"].split()[0])
print(json.dumps({"status": "success" if all(checks.values()) else "failure", "checks": checks, "metrics": metrics}))
raise SystemExit(0 if all(checks.values()) else 1)

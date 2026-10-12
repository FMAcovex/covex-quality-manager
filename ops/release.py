"""Package the verified standalone build into a NEW native release directory."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("--sha", required=True)
parser.add_argument("--out", required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
if subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip() != args.sha:
    raise RuntimeError("Exact checkout SHA required")
target = Path(args.out)
if target.exists() or target.is_symlink():
    raise RuntimeError("New release directory required")
if not (root / ".next/standalone/server.js").is_file():
    raise RuntimeError("Verified standalone build required")
subprocess.run(["node", "ops/runtime/release-manifest.mjs", args.sha], cwd=root, check=True)
shutil.copytree(root / ".next/standalone", target, symlinks=True, ignore=shutil.ignore_patterns(".env", ".env.*", "*.pgpass", "*.key", "*.pem"))
shutil.copytree(root / ".next/static", target / ".next/static", dirs_exist_ok=True)
shutil.copytree(root / "ops/runtime", target / "ops/runtime")
if (root / "public").is_dir():
    shutil.copytree(root / "public", target / "public", dirs_exist_ok=True)
shutil.copyfile(root / "release-manifest.json", target / "release-manifest.json")
# Code contains no operating secrets. Normalize readable modes for the service UID;
# preserve executable engines, never follow symlinks when changing permissions.
for path in [target, *target.rglob("*")]:
    if not path.is_symlink():
        os.chmod(path, 0o755 if path.is_dir() or path.stat().st_mode & 0o111 else 0o644)
print(json.dumps({"status": "success", "operation": "package", "sha": args.sha}))

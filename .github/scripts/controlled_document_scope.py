"""Select the existing documentation job by changed paths, never branch name."""
import json
import os
import re
import subprocess
import pathlib

base = os.environ["PR_BASE_SHA"]
head = os.environ["PR_HEAD_SHA"]
paths = subprocess.check_output(["git", "diff", "--name-only", base, head], text=True).splitlines()
allowed = re.compile(
    r"^(?:src/(?:modules/controlled-documents/|app/(?:controlled-documents/|api/controlled-documents/))"
    r"|prisma/schema\.prisma$|prisma/migrations/[^/]+_pnt_p1b2_import/migration\.sql$"
    r"|scripts/smoke-pnt-[^/]+\.ts$|docs/PNT_[^/]+\.md$"
    r"|docs/(?:CURRENT_STATUS|DECISIONS)\.md$|package\.json$"
    r"|\.github/(?:workflows/ci\.yml|scripts/controlled_document_scope\.py)$)"
)
scoped = bool(paths) and all(allowed.match(path) for path in paths)
scoped = scoped and any("controlled-documents/" in path or path.startswith("scripts/smoke-pnt-") or path.startswith("docs/PNT_") for path in paths)
if scoped and "prisma/schema.prisma" in paths:
    old_schema = subprocess.check_output(["git", "show", f"{base}:prisma/schema.prisma"], text=True)
    new_schema = pathlib.Path("prisma/schema.prisma").read_text()
    # Only the additive P1B staging models and pending-import revision state use the documentary job.
    restored = new_schema.split("// P1B-2: bounded staging;")[0].replace("  IMPORTED_PENDING\n", "")
    scoped = restored.strip() == old_schema.strip()
if scoped and "package.json" in paths:
    old = json.loads(subprocess.check_output(["git", "show", f"{base}:package.json"], text=True))
    new = json.loads(subprocess.check_output(["git", "show", f"{head}:package.json"], text=True))
    # A dependency/build/test change can affect other modules and uses the full job.
    old_scripts, new_scripts = old.pop("scripts", {}), new.pop("scripts", {})
    scoped = old == new and all(old_scripts.get(key) == new_scripts.get(key) for key in old_scripts.keys() | new_scripts.keys() if not key.startswith("pnt-"))
with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
    output.write(f"documentation_only={'true' if scoped else 'false'}\n")

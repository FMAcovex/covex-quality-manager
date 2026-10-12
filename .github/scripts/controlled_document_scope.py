"""Fail-closed classification: every non-document change requires the full QMS gate."""
import os
import subprocess
from pathlib import PurePosixPath

def docs_only(paths, modes):
    if not paths:
        return False
    for path in paths:
        p = PurePosixPath(path)
        if ".." in p.parts or not (path == "README.md" or (path.startswith("docs/") and path.endswith(".md"))):
            return False
        if modes.get(path) not in {"100644", "deleted"}:
            return False
    return True

def main():
    base, head = os.environ["PR_BASE_SHA"], os.environ["PR_HEAD_SHA"]
    raw = subprocess.check_output(["git", "diff", "--no-renames", "--name-only", "-z", base, head]).decode()
    paths = raw.rstrip("\0").split("\0") if raw else []
    modes = {}
    for path in paths:
        entries = subprocess.check_output(["git", "ls-tree", "-z", head, "--", path]).decode()
        modes[path] = entries.split(" ", 1)[0] if entries else "deleted"
    result = docs_only(paths, modes)
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write(f"docs_only={str(result).lower()}\nhead_sha={head}\n")

if __name__ == "__main__":
    main()

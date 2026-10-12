"""Explicit, isolated Docker mount smoke. No host volumes, network or database."""
import argparse
import json
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("--image", required=True)
args = parser.parse_args()
script = r'''
import hashlib, json, os, pathlib, subprocess, sys
sys.path.insert(0, "/opt/covex")
from storage import inspect, destination, StorageUnavailable

assert os.getuid() == 10001
root = pathlib.Path("/storage")
(root / "backups").mkdir(mode=0o700)
marker = root / ".covex-backup-storage"
marker.write_bytes(b"synthetic-docker-approved-volume")
policy = {"mode": "mounted-filesystem", "root": str(root), "source": "tmpfs", "filesystem_type": "tmpfs", "mount_root": "/", "marker_sha256": hashlib.sha256(marker.read_bytes()).hexdigest()}
value = {"environment": "production", "backup_directory": str(root / "backups"), "backup_storage": policy}
inspect(value)
with destination(value) as (pinned, descriptor, check):
    (root / "plain").write_bytes(b"synthetic backup test bytes")
    (root / "key").write_bytes(b"1" * 64)
    subprocess.run(["openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-iter", "600000", "-salt", "-in", str(root / "plain"), "-out", str(pinned / "synthetic.enc"), "-pass", "file:" + str(root / "key")], check=True, capture_output=True)
    assert (root / "backups/synthetic.enc").is_file()
    os.fsync(descriptor)
    check()
def refused(candidate):
    try:
        inspect(candidate)
    except StorageUnavailable:
        return
    raise AssertionError("Unavailable or substituted storage accepted")
refused({**value, "backup_directory": "/absent/backups"})
refused({**value, "backup_storage": {**policy, "source": "substituted"}})
fallback = root / "unmounted-fallback"
fallback.mkdir(mode=0o700)
(fallback / "backups").mkdir(mode=0o700)
(fallback / ".covex-backup-storage").write_bytes(marker.read_bytes())
refused({**value, "backup_directory": str(fallback / "backups"), "backup_storage": {**policy, "root": str(fallback)}})
marker.write_bytes(b"substituted")
refused(value)
print(json.dumps({"status": "success", "uid": os.getuid(), "mounted_storage_positive": True, "absent_unmounted_substituted_negative": True}))
'''
result = subprocess.run(["docker", "run", "--rm", "--read-only", "--network=none", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--tmpfs", "/storage:uid=10001,gid=10001,mode=0700", "--entrypoint", "python3", args.image, "-c", script], capture_output=True, text=True, timeout=120)
if result.returncode:
    raise SystemExit("Docker backup storage smoke failed; review privately")
value = json.loads(result.stdout)
assert value["status"] == "success"
print(json.dumps(value))

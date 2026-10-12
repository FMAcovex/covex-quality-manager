"""Fail-closed Linux backup storage identity checks; never provision a destination.

IT enrolls a mounted filesystem and an independently recorded marker SHA-256.
The directory identity mode is restricted to disposable test environments.
"""
import contextlib
import hashlib
import os
from pathlib import Path
import re
import stat


class StorageUnavailable(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise StorageUnavailable(reason)


def mounts():
    """Use the process mount namespace, including Docker bind mounts."""
    def decode(value):
        return re.sub(r"\\([0-7]{3})", lambda match: chr(int(match[1], 8)), value)

    result = []
    for line in Path("/proc/self/mountinfo").read_text().splitlines():
        left, right = line.split(" - ", 1)
        fields, filesystem = left.split(), right.split()
        result.append({"id": fields[0], "root": decode(fields[3]), "path": decode(fields[4]), "options": fields[5].split(","), "type": filesystem[0], "source": decode(filesystem[1]), "super_options": filesystem[2].split(",")})
    return result


def checked_path(value):
    require(isinstance(value, str) and value.startswith("/"), "backup-storage-absolute-path-required")
    path = Path(value)
    # Reject symlink components and noncanonical paths rather than following aliases.
    require(str(path) == value and path.resolve(strict=True) == path, "backup-storage-path-refused")
    return path


def inspect(value):
    try:
        policy = value.get("backup_storage")
        require(isinstance(policy, dict), "backup-storage-policy-required")
        root = checked_path(policy.get("root"))
        output = checked_path(value.get("backup_directory"))
        require(root != Path("/") and root.is_dir() and output.is_dir() and output.is_relative_to(root), "backup-storage-destination-refused")
        root_stat, output_stat = root.stat(), output.stat()
        require(not output_stat.st_mode & 0o077, "backup-directory-must-be-private")
        require(root_stat.st_dev == output_stat.st_dev, "backup-storage-nested-filesystem-refused")
        mode = policy.get("mode")
        mount_id = None
        if mode == "mounted-filesystem":
            entries = mounts()
            exact = [entry for entry in entries if entry["path"] == str(root)]
            require(len(exact) == 1, "backup-storage-mount-absent-or-ambiguous")
            mount = exact[0]
            require(all(isinstance(policy.get(key), str) and policy[key] for key in ["source", "filesystem_type", "mount_root"]), "backup-storage-mount-identity-required")
            require((mount["source"], mount["type"], mount["root"]) == (policy["source"], policy["filesystem_type"], policy["mount_root"]), "backup-storage-mount-identity-mismatch")
            require("rw" in mount["options"] and "rw" in mount["super_options"], "backup-storage-read-only")
            # A nested/overlaid mount must not redirect output onto another volume.
            require(not any(Path(entry["path"]) != root and Path(entry["path"]).is_relative_to(root) and output.is_relative_to(Path(entry["path"])) for entry in entries), "backup-storage-nested-mount-refused")
            mount_id = mount["id"]
        elif mode == "test-directory-identity":
            require(value.get("environment") == "test", "backup-storage-test-mode-refused")
            require((root_stat.st_dev, root_stat.st_ino) == (policy.get("device"), policy.get("inode")), "backup-storage-directory-identity-mismatch")
        else:
            raise StorageUnavailable("backup-storage-mode-required")
        expected = policy.get("marker_sha256", "")
        require(isinstance(expected, str) and re.fullmatch(r"[a-f0-9]{64}", expected), "backup-storage-marker-identity-required")
        marker = root / ".covex-backup-storage"
        with contextlib.ExitStack() as stack:
            descriptor = os.open(marker, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
            stack.callback(os.close, descriptor)
            info = os.fstat(descriptor)
            require(stat.S_ISREG(info.st_mode) and info.st_size <= 4096 and info.st_dev == root_stat.st_dev, "backup-storage-marker-refused")
            require(hashlib.sha256(os.read(descriptor, 4097)).hexdigest() == expected, "backup-storage-marker-mismatch")
        return (mount_id, root_stat.st_dev, root_stat.st_ino, output_stat.st_dev, output_stat.st_ino)
    except StorageUnavailable:
        raise
    except Exception:
        # Do not leak paths, mount sources, marker bytes or OS diagnostics.
        raise StorageUnavailable("backup-storage-unavailable") from None


@contextlib.contextmanager
def destination(value):
    """Pin output to its original inode; rechecks also detect namespace changes."""
    identity = inspect(value)
    try:
        descriptor = os.open(value["backup_directory"], os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    except OSError:
        raise StorageUnavailable("backup-storage-unavailable") from None
    try:
        def check():
            current = inspect(value)
            info = os.fstat(descriptor)
            require(current == identity and (info.st_dev, info.st_ino) == identity[3:], "backup-storage-changed-during-operation")
        check()
        # OpenSSL is a child process: self/fd there would name its own closed FD.
        yield Path("/proc") / str(os.getpid()) / "fd" / str(descriptor), descriptor, check
    finally:
        os.close(descriptor)

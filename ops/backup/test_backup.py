import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import io
import tarfile
import contextlib
import datetime as dt
import hashlib
import shutil
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).parent))
import storage

spec = importlib.util.spec_from_file_location("backup", Path(__file__).with_name("backup.py"))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class Safety(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        for name in ["enc.key", "mac.key", "pass"]:
            (self.root / name).write_text(name * 64)
            os.chmod(self.root / name, 0o600)
        self.value = {"environment": "test", "approval_reference": "SYNTHETIC", "release_sha": "a" * 40, "assets_consistency": "immutable-release", "external_reference_policy": "references-only-accepted", "encryption_key": str(self.root / "enc.key"), "manifest_key": str(self.root / "mac.key"), "source": {"host": "127.0.0.1", "database": "covex_phase4b1_test_4b2_source_unit", "user": "synthetic", "passfile": str(self.root / "pass"), "sslmode": "disable"}, "recovery": {"host": "127.0.0.1", "database": "postgres"}, "approved_recovery_hosts": ["127.0.0.1"]}
        self.name = "covex_phase4b1_test_4b2_restore_" + "a" * 16

    def tearDown(self):
        self.directory.cleanup()

    def test_explicit_target_and_host(self):
        self.assertEqual(backup.restore_target(self.value, self.name, self.name), self.value["recovery"])
        for name in ["covex_quality", "postgres", "covex_phase4b1_test_demo_final", "covex_restore_production", 'bad";DROP DATABASE postgres;--']:
            with self.subTest(name=name), self.assertRaises(backup.Refused):
                backup.restore_target(self.value, name, name)
        with self.assertRaises(backup.Refused):
            backup.restore_target(self.value, self.name, "wrong")
        self.value["recovery"]["host"] = "remote.example.invalid"
        with self.assertRaises(backup.Refused):
            backup.restore_target(self.value, self.name, self.name)

    def test_test_source_cannot_be_habitual(self):
        self.value["source"]["database"] = "covex_quality"
        with self.assertRaises(backup.Refused):
            backup.restore_target(self.value, self.name, self.name)

    def test_private_config_keys_and_explicit_acceptance(self):
        file = self.root / "config.json"
        backup.write_json(file, self.value)
        self.assertEqual(backup.config(file)["environment"], "test")
        os.chmod(self.root / "enc.key", 0o644)
        with self.assertRaises(backup.Refused):
            backup.config(file)
        os.chmod(self.root / "enc.key", 0o600)
        self.value["environment"] = "production"
        self.value["approval_reference"] = "PENDING-IT-QA"
        backup.write_json(file, self.value)
        with self.assertRaises(backup.Refused):
            backup.config(file)

    def test_ambient_libpq_password_is_removed(self):
        with patch.dict(os.environ, {"PGPASSWORD": "DO-NOT-LEAK", "PGSERVICE": "dangerous", "PGOPTIONS": "unsafe"}):
            env = backup.connection_env(self.value["source"])
        self.assertNotIn("PGPASSWORD", env)
        self.assertNotIn("PGSERVICE", env)
        self.assertNotEqual(env["PGOPTIONS"], "unsafe")

    def test_encrypt_verify_roundtrip_and_wrong_key(self):
        plain, encrypted, recovered = [self.root / n for n in ["plain", "encrypted", "recovered"]]
        data = b"Synthetic PDF/DOCX/XLSX binary\x00\xff" * 30
        plain.write_bytes(data)
        backup.crypt(plain, encrypted, self.value["encryption_key"])
        self.assertNotIn(data, encrypted.read_bytes())
        backup.crypt(encrypted, recovered, self.value["encryption_key"], decrypt=True)
        self.assertEqual(recovered.read_bytes(), data)
        with self.assertRaises(backup.Refused):
            backup.crypt(encrypted, recovered, self.value["manifest_key"], decrypt=True)

    def test_authenticated_manifest_and_ciphertext(self):
        for name in ["database.dump.enc", "assets.tar.enc"]:
            (self.root / name).write_bytes(b"synthetic ciphertext")
            os.chmod(self.root / name, 0o600)
        manifest = {"format": 1, "encrypted_files": {n: backup.digest(self.root / n) for n in ["database.dump.enc", "assets.tar.enc"]}}
        backup.write_json(self.root / "manifest.json", manifest)
        (self.root / "manifest.mac").write_text(backup.signature(manifest, self.value))
        os.chmod(self.root / "manifest.mac", 0o600)
        self.assertEqual(backup.verify(self.root, self.value), manifest)
        manifest["format"] = 2
        backup.write_json(self.root / "manifest.json", manifest)
        with self.assertRaises(backup.Refused):
            backup.verify(self.root, self.value)
        manifest["format"] = 1
        backup.write_json(self.root / "manifest.json", manifest)
        (self.root / "database.dump.enc").write_bytes(b"altered")
        with self.assertRaises(backup.Refused):
            backup.verify(self.root, self.value)

    def test_archive_path_traversal_and_symlinks_refused(self):
        archive = self.root / "evil.tar"
        for name, kind in [("../outside", tarfile.REGTYPE), ("safe", tarfile.SYMTYPE), ("/absolute", tarfile.REGTYPE)]:
            with self.subTest(name=name):
                with tarfile.open(archive, "w") as stream:
                    member = tarfile.TarInfo(name)
                    member.type, member.size = kind, 1
                    stream.addfile(member, io.BytesIO(b"x") if kind == tarfile.REGTYPE else None)
                with self.assertRaises(backup.Refused):
                    backup.extract_assets(archive, self.root / "out", {name: {"size": 1}})
        self.assertFalse((self.root / "out").exists())

    def test_failed_tool_does_not_print_credentials_or_sql(self):
        with self.assertRaisesRegex(backup.Refused, "tool-failed-python"):
            backup.run(["python3", "-c", "import sys;sys.stderr.write('sensitive row and token');sys.exit(1)"])

    def test_retention_without_approval_is_refused(self):
        with self.assertRaises(backup.Refused):
            backup.prune(self.value, 1, 30, "approved-local-retention")
        with self.assertRaises(backup.Refused):
            backup.prune(self.value, 3, 30, "")


class StorageSafety(unittest.TestCase):
    tearDown = Safety.tearDown

    def setUp(self):
        Safety.setUp(self)
        self.storage = self.root / "storage"
        self.storage.mkdir(mode=0o700)
        self.output = self.storage / "backups"
        self.output.mkdir(mode=0o700)
        self.marker = self.storage / ".covex-backup-storage"
        self.marker.write_bytes(b"synthetic-approved-volume")
        info = self.storage.stat()
        self.value.update(backup_directory=str(self.output), temporary_directory=str(self.root), application_root=str(self.root), assets=[], backup_storage={"mode": "test-directory-identity", "root": str(self.storage), "device": info.st_dev, "inode": info.st_ino, "marker_sha256": hashlib.sha256(self.marker.read_bytes()).hexdigest()})
        self.mount = {"id": "77", "root": "/", "path": str(self.storage), "options": ["rw"], "type": "nfs4", "source": "synthetic.example.invalid:/approved", "super_options": ["rw"]}

    def mounted_policy(self):
        self.value["backup_storage"].update(mode="mounted-filesystem", source=self.mount["source"], filesystem_type=self.mount["type"], mount_root=self.mount["root"])

    def assert_before_database(self):
        with patch.object(backup, "pg_version") as database:
            with self.assertRaises(storage.StorageUnavailable):
                backup.backup(self.value)
            database.assert_not_called()
        self.assertFalse(any(self.storage.glob("backups/*")))

    def test_policy_is_mandatory(self):
        del self.value["backup_storage"]
        self.assert_before_database()

    def test_absent_storage_is_not_created(self):
        shutil.rmtree(self.storage)
        self.assert_before_database()
        self.assertFalse(self.storage.exists())

    def test_directory_without_mount_even_with_marker_is_refused(self):
        self.mounted_policy()
        with patch.object(storage, "mounts", return_value=[]):
            self.assert_before_database()

    def test_substituted_mounted_source_type_or_root_is_refused(self):
        self.mounted_policy()
        for field in ["source", "type", "root"]:
            with self.subTest(field=field), patch.object(storage, "mounts", return_value=[{**self.mount, field: "substituted"}]):
                self.assert_before_database()

    def test_substituted_marker_is_refused(self):
        self.marker.write_bytes(b"another-volume")
        self.assert_before_database()

    def test_copied_marker_on_replacement_directory_is_refused(self):
        self.storage.rename(self.root / "original")
        shutil.copytree(self.root / "original", self.storage)
        self.assert_before_database()

    def test_production_cannot_use_test_storage_mode(self):
        self.value["environment"] = "production"
        self.assert_before_database()

    def test_symlink_and_missing_output_are_not_provisioned(self):
        self.output.rmdir()
        self.assert_before_database()
        self.assertFalse(self.output.exists())
        self.output.symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(storage.StorageUnavailable):
            storage.inspect(self.value)

    def test_marker_symlink_or_special_file_is_refused(self):
        self.marker.unlink()
        self.marker.symlink_to(self.root / "enc.key")
        self.assert_before_database()
        self.marker.unlink()
        os.mkfifo(self.marker)
        self.assert_before_database()

    def test_read_only_and_nested_bind_mount_are_refused(self):
        self.mounted_policy()
        with patch.object(storage, "mounts", return_value=[{**self.mount, "options": ["ro"]}]):
            self.assert_before_database()
        with patch.object(storage, "mounts", return_value=[self.mount, {**self.mount, "id": "78", "path": str(self.output)}]):
            self.assert_before_database()

    def test_valid_mounted_storage_and_unmount_or_remount_during_operation(self):
        self.mounted_policy()
        with patch.object(storage, "mounts", return_value=[self.mount]) as entries:
            with storage.destination(self.value) as (pinned, _, check):
                self.assertEqual(pinned.stat().st_ino, self.output.stat().st_ino)
                check()
                entries.return_value = []
                with self.assertRaises(storage.StorageUnavailable):
                    check()
                entries.return_value = [{**self.mount, "id": "79"}]
                with self.assertRaises(storage.StorageUnavailable):
                    check()

    def test_mountinfo_octal_paths_and_namespace(self):
        data = "77 1 0:44 /approved\\040root /mnt/approved\\040volume rw,relatime - nfs4 synthetic:/approved\\040root rw\n"
        with patch.object(Path, "read_text", return_value=data):
            entry = storage.mounts()[0]
        self.assertEqual(entry["root"], "/approved root")
        self.assertEqual(entry["path"], "/mnt/approved volume")
        self.assertEqual(entry["source"], "synthetic:/approved root")

    def fake_generation(self):
        # Real encrypted files/MAC and publication path, only PostgreSQL is mocked.
        def dump(args, *a, **kw):
            Path(next(arg[7:] for arg in args if arg.startswith("--file="))).write_bytes(b"synthetic dump")
        stack = contextlib.ExitStack()
        stack.enter_context(patch.object(backup, "pg_version"))
        stack.enter_context(patch.object(backup, "audit_protection"))
        stack.enter_context(patch.object(backup, "snapshot", return_value=contextlib.nullcontext("synthetic")))
        stack.enter_context(patch.object(backup, "inventory", return_value=({"external_references_without_custody": 0}, [])))
        stack.enter_context(patch.object(backup, "connection_env", return_value={}))
        # Keep OpenSSL execution real, intercept only pg_dump.
        original = backup.run
        stack.enter_context(patch.object(backup, "run", side_effect=lambda args, *a, **kw: dump(args) if args[0] == "pg_dump" else original(args, *a, **kw)))
        return stack

    def test_positive_enrolled_storage_publishes_authenticated_backup(self):
        with self.fake_generation():
            result = backup.backup(self.value)
        self.assertEqual(result["status"], "success")
        backup.verify(self.output / result["bundle"], self.value)
        self.assertFalse(list(self.output.glob(".pending-*")))

    def test_storage_disappears_before_publication_no_success_bundle(self):
        original = backup.verify
        def disconnect(*args):
            result = original(*args)
            self.marker.unlink()
            return result
        with self.fake_generation(), patch.object(backup, "verify", side_effect=disconnect):
            with self.assertRaises(storage.StorageUnavailable):
                backup.backup(self.value)
        self.assertEqual(list(self.output.iterdir()), [])

    def test_storage_replaced_after_rename_candidate_removed_from_original(self):
        original = os.rename
        def replace(*args, **kwargs):
            original(*args, **kwargs)
            original(self.storage, self.root / "original")
            shutil.copytree(self.root / "original", self.storage)
        with self.fake_generation(), patch.object(backup.os, "rename", side_effect=replace):
            with self.assertRaises(storage.StorageUnavailable):
                backup.backup(self.value)
        self.assertEqual(list((self.root / "original/backups").iterdir()), [])

    def test_failed_cli_overwrites_previous_success_without_creating_destination(self):
        self.value["status_directory"] = str(self.root / "status")
        Path(self.value["status_directory"]).mkdir()
        backup.write_json(self.root / "status/backup.json", {"status": "success", "operation": "backup"})
        file = self.root / "config.json"
        backup.write_json(file, self.value)
        shutil.rmtree(self.storage)
        result = subprocess.run(["python3", str(Path(backup.__file__)), "backup", "--config", str(file)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout)["status"], "failure")
        self.assertTrue(json.loads(result.stdout)["reason"].startswith("backup-storage-"))
        self.assertEqual(json.loads((self.root / "status/backup.json").read_text())["status"], "failure")
        self.assertFalse(self.storage.exists())
        self.assertNotIn(str(self.root), result.stdout + result.stderr)

    def test_monitor_detects_storage_loss_despite_recent_success(self):
        self.root.joinpath("status.json").write_text(json.dumps({"status": "success", "operation": "backup", "checked_at": dt.datetime.now(dt.timezone.utc).isoformat()}))
        file = self.root / "config.json"
        backup.write_json(file, self.value)
        def monitor():
            result = subprocess.run(["python3", str(Path(__file__).resolve().parents[1] / "monitor.py"), "--health-url", "http://127.0.0.1:1/api/health", "--backup-status", str(self.root / "status.json"), "--backup-config", str(file), "--max-backup-age-seconds", "3600", "--disk", str(self.root), "--min-free-bytes", "1"], capture_output=True, text=True)
            self.assertNotIn(str(self.root), result.stdout)
            self.assertEqual(result.returncode, 1)  # Deliberately absent app health.
            return json.loads(result.stdout)["checks"]
        self.assertTrue(monitor()["backup_storage_available"])
        self.marker.unlink()
        checks = monitor()
        self.assertTrue(checks["backup_recent_success"])
        self.assertFalse(checks["backup_storage_available"])
        self.marker.write_bytes(b"synthetic-approved-volume")
        self.storage.rename(self.root / "original")
        self.assertFalse(monitor()["backup_storage_available"])
        shutil.copytree(self.root / "original", self.storage)
        self.assertFalse(monitor()["backup_storage_available"])
        shutil.rmtree(self.storage)
        (self.root / "original").rename(self.storage)
        self.mounted_policy()
        backup.write_json(file, self.value)
        checks = monitor()  # Residual directory has marker but no real mount.
        self.assertTrue(checks["backup_recent_success"])
        self.assertFalse(checks["backup_storage_available"])


if __name__ == "__main__":
    unittest.main()

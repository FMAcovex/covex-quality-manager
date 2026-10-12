import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import io
import tarfile

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


if __name__ == "__main__":
    unittest.main()

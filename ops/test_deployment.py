"""Render candidate Compose with fictitious, temporary configuration only."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from deploy_record import record

ROOT = Path(__file__).resolve().parents[1]


class Deployment(unittest.TestCase):
    def test_compose_isolated_persistent_nonroot_and_private(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            file = root / "fictitious.env"
            file.write_text((ROOT / "ops/production.env.example").read_text())
            os.chmod(file, 0o600)
            env = {**os.environ, "COVEX_STACK_NAME": "covex-synthetic-config", "COVEX_POSTGRES_IMAGE": "postgres:16-bookworm", "COVEX_APP_IMAGE": "covex-synthetic:config-test", "COVEX_PROXY_IMAGE": "nginx:stable-bookworm", "COVEX_APP_ENV_FILE": str(file), "COVEX_ASSETS_DIR": temporary, "COVEX_LISTEN_IP": "127.0.0.1", "COVEX_DNS": "quality.example.invalid", "COVEX_TLS_DIR": temporary, "COVEX_PG_VOLUME": "synthetic-external-volume", "COVEX_POSTGRES_PASSWORD_FILE": str(file), "COVEX_DATABASE_URL_FILE": str(file), "COVEX_ENTRA_SECRET_FILE": str(file), "COVEX_PG_CERT_FILE": str(file), "COVEX_PG_KEY_FILE": str(file), "COVEX_PG_CA_FILE": str(file)}
            result = subprocess.run(["docker", "compose", "-f", str(ROOT / "ops/compose.production.yaml"), "config", "--format", "json"], env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, "Candidate Compose must render with explicit configuration")
            value = json.loads(result.stdout)
            pg, app, proxy = [value["services"][name] for name in ["postgres", "app", "proxy"]]
            self.assertFalse(pg.get("ports"))
            self.assertFalse(app.get("ports"))
            self.assertTrue(value["networks"]["database"]["internal"])
            self.assertTrue(value["volumes"]["postgres_data"]["external"])
            self.assertEqual(pg["environment"]["POSTGRES_PASSWORD_FILE"], "/run/secrets/postgres_password")
            self.assertNotIn("POSTGRES_PASSWORD", pg["environment"])
            self.assertTrue(app["read_only"])
            self.assertIn("ALL", app["cap_drop"])
            self.assertEqual(app["environment"]["APP_ENV"], "production")
            self.assertEqual(app["environment"]["ALLOW_DEMO_DATA"], "false")
            self.assertEqual(app["environment"]["AUTH_SYNTHETIC_IDENTITY"], "0")
            self.assertEqual(len(proxy["ports"]), 1)
            self.assertEqual(proxy["ports"][0]["host_ip"], "127.0.0.1")
            self.assertEqual(proxy["ports"][0]["target"], 443)

    def test_unconfigured_compose_fails_closed(self):
        env = {k: v for k, v in os.environ.items() if not k.startswith("COVEX_")}
        result = subprocess.run(["docker", "compose", "-f", str(ROOT / "ops/compose.production.yaml"), "config", "--quiet"], env=env, capture_output=True)
        self.assertNotEqual(result.returncode, 0)

    def test_image_and_native_supervisor_keep_controlled_startup(self):
        image = (ROOT / "ops/Dockerfile").read_text()
        unit = (ROOT / "ops/systemd/covex-quality.service").read_text()
        self.assertIn("FROM node:22-bookworm-slim", image)
        self.assertIn("pnpm install --frozen-lockfile", image)
        self.assertIn(".next/standalone", image)
        self.assertIn("USER 10001:10001", image)
        self.assertIn("HEALTHCHECK", image)
        self.assertIn("HOSTNAME=127.0.0.1", unit)
        self.assertIn("Restart=on-failure", unit)
        self.assertIn("ops/runtime/start.mjs", unit)
        for forbidden in ["db:push", "db:seed", "auth:fixtures", "db:deploy"]:
            self.assertNotIn(forbidden, image + unit)
        ignore = (ROOT / ".dockerignore").read_text().splitlines()
        for name in [".env*", "backups", "data", "reports", "templates", "**/*.key", "**/*.pgpass"]:
            self.assertIn(name, ignore)

    def test_proxy_preserves_origin_without_trusting_client_forwarding(self):
        text = (ROOT / "ops/nginx/covex.conf.template").read_text()
        self.assertIn("proxy_set_header Host ${COVEX_DNS}", text)
        self.assertIn("proxy_set_header X-Forwarded-Proto https", text)
        self.assertIn("proxy_set_header X-Forwarded-For $remote_addr", text)
        self.assertNotIn("$http_x_forwarded", text)
        self.assertIn("TLSv1.2 TLSv1.3", text)
        self.assertIn("location = /api/health { deny all; }", text)
        self.assertIn("access_log off", text)

    def test_monitor_failure_is_red_without_sensitive_output(self):
        with tempfile.TemporaryDirectory() as temporary:
            result = subprocess.run(["python3", str(ROOT / "ops/monitor.py"), "--health-url", "http://127.0.0.1:1/api/health", "--backup-status", str(Path(temporary) / "absent"), "--max-backup-age-seconds", "3600", "--disk", temporary, "--min-free-bytes", "1"], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            value = json.loads(result.stdout)
            self.assertFalse(value["checks"]["application_database"])
            self.assertFalse(value["checks"]["backup_recent_success"])
            self.assertTrue(value["checks"]["disk_capacity"])
            self.assertNotIn(temporary, result.stdout)
            self.assertNotIn("127.0.0.1", result.stdout)

    def test_deployment_evidence_requires_schema_config_backup_and_checks(self):
        release = {"format": 1, "commit": "a" * 40, "version": "0.1.0", "migrations": [{"name": "synthetic", "sha256": "b" * 64}]}
        schema = [{"migration_name": "synthetic", "checksum": "b" * 64, "finished": True, "rolled_back": False}]
        configuration = {"approval_reference": "SYNTHETIC-IT-QA", "environment": "production", "dns": "quality.example.invalid", "infrastructure": "synthetic", "secret_version_references": []}
        backup = {"status": "success", "operation": "backup", "bundle": "synthetic"}
        checks = dict.fromkeys(["health", "oidc", "permissions", "documents"], True)
        evidence = record(release, schema, configuration, backup, checks, "SYNTHETIC-OPERATOR")
        self.assertEqual(evidence["commit"], release["commit"])
        schema[0]["checksum"] = "c" * 64
        with self.assertRaises(ValueError):
            record(release, schema, configuration, backup, checks, "SYNTHETIC-OPERATOR")
        schema[0]["checksum"] = "b" * 64
        checks["permissions"] = False
        with self.assertRaises(ValueError):
            record(release, schema, configuration, backup, checks, "SYNTHETIC-OPERATOR")


if __name__ == "__main__":
    unittest.main()

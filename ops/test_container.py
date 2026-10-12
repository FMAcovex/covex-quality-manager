"""Optional local Docker/HTTPS/TLS integration. Creates/removes its own stack only.

Requires the candidate app image already built. All certificates/credentials/data
are fictitious. Not repeated by CI: avoids another expensive image compilation.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import ssl
import subprocess
import tempfile
import time
import urllib.request
import urllib.error
import uuid

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--image", required=True)
args = parser.parse_args()


def run(command, env=None, check=True):
    result = subprocess.run(command, env=env, capture_output=True, text=True, timeout=180)
    if check and result.returncode:
        raise RuntimeError("Synthetic container operation failed: " + command[0])
    return result


with tempfile.TemporaryDirectory(prefix="covex4b2-container-") as temporary:
    root = Path(temporary)
    project, volume = "covex4b2-" + uuid.uuid4().hex[:12], "covex4b2-data-" + uuid.uuid4().hex[:12]
    for name in ["assets", "https"]:
        (root / name).mkdir()
    for label, names in [("pg", "DNS:postgres"), ("web", "DNS:example.org,IP:127.0.0.1"), ("wrong", "DNS:wrong.example.invalid")]:
        run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=" + label, "-addext", "subjectAltName=" + names, "-keyout", str(root / (label + ".key")), "-out", str(root / (label + ".crt"))])
    shutil.copyfile(root / "web.crt", root / "https/fullchain.pem")
    shutil.copyfile(root / "web.key", root / "https/privkey.pem")
    admin, app_password = uuid.uuid4().hex + uuid.uuid4().hex, uuid.uuid4().hex + uuid.uuid4().hex
    for name, data in [("admin", admin), ("entra", "synthetic-container-entra-secret-" + uuid.uuid4().hex), ("database", f"postgresql://covex_app:{app_password}@postgres:5432/covex_quality?sslmode=require&sslaccept=strict&sslcert=/run/secrets/pg_ca_cert"), ("init.sql", f"CREATE ROLE covex_app LOGIN PASSWORD '{app_password}' NOSUPERUSER NOCREATEDB NOCREATEROLE;\nGRANT CONNECT ON DATABASE covex_quality TO covex_app;\n")]:
        (root / name).write_text(data)
        os.chmod(root / name, 0o600)
    (root / "production.env").write_text((ROOT / "ops/production.env.example").read_text().replace("https://quality.example.invalid", "https://example.org"))
    os.chmod(root / "production.env", 0o600)
    # Real owners/modes required by production secrets and PostgreSQL TLS.
    run(["docker", "run", "--rm", "--user", "0:0", "-v", str(root) + ":/work", "postgres:16-bookworm", "chown", "999:999", "/work/pg.key", "/work/admin", "/work/init.sql"])
    run(["docker", "run", "--rm", "--user", "0:0", "-v", str(root) + ":/work", "postgres:16-bookworm", "chown", "10001:10001", "/work/database", "/work/entra"])
    override = root / "override.json"
    # Override only synthetic port/initial fixture; retain actual production network/TLS/volume/UID.
    override.write_text(json.dumps({"services": {"postgres": {"volumes": [{"type": "bind", "source": str(root / "init.sql"), "target": "/docker-entrypoint-initdb.d/10-synthetic.sql", "read_only": True}]}, "proxy": {"ports": [{"target": 443, "published": "8443", "host_ip": "127.0.0.1"}]}}}))
    env = {**os.environ, "COVEX_STACK_NAME": project, "COVEX_POSTGRES_IMAGE": "postgres:16-bookworm", "COVEX_APP_IMAGE": args.image, "COVEX_PROXY_IMAGE": "nginx:stable-bookworm", "COVEX_APP_ENV_FILE": str(root / "production.env"), "COVEX_ASSETS_DIR": str(root / "assets"), "COVEX_LISTEN_IP": "127.0.0.1", "COVEX_DNS": "example.org", "COVEX_TLS_DIR": str(root / "https"), "COVEX_PG_VOLUME": volume, "COVEX_POSTGRES_PASSWORD_FILE": str(root / "admin"), "COVEX_DATABASE_URL_FILE": str(root / "database"), "COVEX_ENTRA_SECRET_FILE": str(root / "entra"), "COVEX_PG_CERT_FILE": str(root / "pg.crt"), "COVEX_PG_KEY_FILE": str(root / "pg.key"), "COVEX_PG_CA_FILE": str(root / "pg.crt")}
    compose = ["docker", "compose", "-f", str(ROOT / "ops/compose.production.yaml"), "-f", str(override)]
    app_id = None
    try:
        run(["docker", "volume", "create", volume])
        run(compose + ["up", "-d"], env)
        app_id = run(compose + ["ps", "-q", "app"], env).stdout.strip()
        pg_id = run(compose + ["ps", "-q", "postgres"], env).stdout.strip()
        def healthy():
            return run(["docker", "exec", app_id, "node", "ops/runtime/health.mjs"], check=False).returncode == 0
        for _ in range(60):
            if healthy():
                break
            time.sleep(0.5)
        else:
            raise RuntimeError("Synthetic production TLS readiness failed")
        assert run(["docker", "exec", app_id, "id", "-u"]).stdout.strip() == "10001"
        sentinel = uuid.uuid4().hex
        run(["docker", "exec", "--user", "postgres", pg_id, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-d", "covex_quality", "-c", "CREATE TABLE synthetic_persistence(id text PRIMARY KEY); INSERT INTO synthetic_persistence VALUES ('" + sentinel + "');"])
        ctx = ssl.create_default_context(cafile=str(root / "web.crt"))
        request = urllib.request.Request("https://127.0.0.1:8443/login", headers={"Host": "example.org"})
        with urllib.request.urlopen(request, context=ctx, timeout=10) as response:
            assert response.status == 200
            assert response.headers["Strict-Transport-Security"]
            assert response.headers["X-Content-Type-Options"] == "nosniff"
        try:
            urllib.request.urlopen(urllib.request.Request("https://127.0.0.1:8443/api/health", headers={"Host": "example.org"}), context=ctx, timeout=5)
            raise RuntimeError("Public proxy health must be denied")
        except urllib.error.HTTPError as error:
            assert error.code == 403
        run(compose + ["restart", "app"], env)
        for _ in range(60):
            if healthy():
                break
            time.sleep(0.5)
        else:
            raise RuntimeError("Synthetic supervised restart failed")
        # Point ONLY the application's CA mount to an unrelated CA; actual strict TLS must fail.
        # Compose secrets use mounts too; use a separate direct container for the negative probe.
        image = args.image
        app_env = {**os.environ, "NODE_ENV": "production", "APP_ENV": "production", "ALLOW_DEMO_DATA": "false", "AUTH_PROVIDER": "entra", "AUTH_SYNTHETIC_IDENTITY": "0", "AUTH_ORIGIN": "https://example.org", "AUTH_ENTRA_TENANT_ID": "11111111-1111-4111-8111-111111111111", "AUTH_ENTRA_CLIENT_ID": "22222222-2222-4222-8222-222222222222", "AUTH_ENTRA_CLIENT_SECRET_FILE": "/run/secrets/entra_secret", "DATABASE_URL_FILE": "/run/secrets/database_url"}
        bad = project + "-bad-ca"
        network = run(["docker", "inspect", "--format", '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}', app_id]).stdout.splitlines()
        database_network = next(n for n in network if n.endswith("_database"))
        run(["docker", "run", "-d", "--name", bad, "--network", database_network, *sum((["-e", key] for key in app_env if key in ["NODE_ENV", "APP_ENV", "ALLOW_DEMO_DATA", "AUTH_PROVIDER", "AUTH_SYNTHETIC_IDENTITY", "AUTH_ORIGIN", "AUTH_ENTRA_TENANT_ID", "AUTH_ENTRA_CLIENT_ID", "AUTH_ENTRA_CLIENT_SECRET_FILE", "DATABASE_URL_FILE"]), []), "-v", str(root / "database") + ":/run/secrets/database_url:ro", "-v", str(root / "entra") + ":/run/secrets/entra_secret:ro", "-v", str(root / "wrong.crt") + ":/run/secrets/pg_ca_cert:ro", image], app_env)
        try:
            time.sleep(3)
            result = run(["docker", "exec", bad, "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(async r=>console.log(JSON.stringify({status:r.status,body:await r.json()})))"])
            negative = json.loads(result.stdout)
            assert negative["status"] == 503 and negative["body"]["database"] == "unavailable"
            assert run(["docker", "exec", bad, "node", "ops/runtime/health.mjs"], check=False).returncode != 0
            logs = run(["docker", "logs", bad])
            assert app_password not in logs.stdout + logs.stderr
            assert "Invalid `prisma" not in logs.stdout + logs.stderr
        finally:
            run(["docker", "rm", "-f", bad], check=False)
        run(compose + ["down"], env)
        assert run(["docker", "volume", "inspect", "--format", "{{.Name}}", volume]).stdout.strip() == volume
        run(compose + ["up", "-d"], env)
        app_id = run(compose + ["ps", "-q", "app"], env).stdout.strip()
        pg_id = run(compose + ["ps", "-q", "postgres"], env).stdout.strip()
        for _ in range(60):
            if healthy():
                break
            time.sleep(0.5)
        else:
            raise RuntimeError("Synthetic persistent volume restart failed")
        assert run(["docker", "exec", "--user", "postgres", pg_id, "psql", "-XAt", "-d", "covex_quality", "-c", "SELECT id FROM synthetic_persistence;"]).stdout.strip() == sentinel
        print("4B2 Docker/HTTPS/TLS OK: production UID/config/health; strict PostgreSQL certificate validation; proxy HTTPS/security headers/internal health denial; supervised restart; external volume persistence. Fictitious only.")
    finally:
        run(compose + ["down"], env, check=False)
        run(["docker", "volume", "rm", volume], check=False)

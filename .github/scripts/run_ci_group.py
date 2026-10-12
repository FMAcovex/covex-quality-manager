"""One mutable database and one Next process per job; suites run sequentially within it."""
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.request
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[2]

def main():
    group = sys.argv[1]
    suites = json.loads((ROOT / ".github/ci-suites.json").read_text())[group]
    env = dict(os.environ)
    database = urlparse(env["DATABASE_URL"]).path.lstrip("/")
    disposable_ci = env.get("GITHUB_ACTIONS") == "true" and env.get("CI") == "true" and database == "covex_quality"
    assert env.get("APP_ENV") == "test" and (disposable_ci or ((database.startswith("covex_phase3b2_ci3b3_") or database.startswith("covex_phase4b1_test_")) and env.get("PHASE3B3_SYNTHETIC_DATABASE") == "1")), "Isolated synthetic PostgreSQL required"
    sha = env["TESTED_SHA"]
    assert subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip() == sha
    output = ROOT / "ci-evidence"
    output.mkdir(exist_ok=True)
    result = {"group": group, "sha": sha, "status": "running", "commands": [], "failureKind": None}
    server = None
    provider = None
    server_log = None
    phase = "infrastructure"

    def persist():
        (output / (group + ".json")).write_text(json.dumps(result, indent=2))

    def run(command, extra=None):
        started = time.monotonic()
        logfile = output / (group + "-" + str(len(result["commands"])) + ".log")
        with logfile.open("w") as log:
            process = subprocess.run(["pnpm", command], cwd=ROOT, env={**env, **(extra or {})}, stdout=log, stderr=subprocess.STDOUT, timeout=300)
        row = {"command": command, "status": process.returncode, "seconds": round(time.monotonic() - started, 3), "phase": phase}
        result["commands"].append(row)
        persist()
        print(json.dumps(row), flush=True)
        if process.returncode:
            print(logfile.read_text()[-20000:], flush=True)
            raise RuntimeError("Failed suite: " + command)

    def stop():
        nonlocal server
        if server:
            server.terminate()
            server.wait(timeout=30)
            server = None

    def start(extra=None):
        nonlocal server, server_log
        manifest = json.loads((ROOT / "build-manifest.json").read_text())
        assert manifest["sha"] == sha
        assert hashlib.sha256((ROOT / "next-build.tar").read_bytes()).hexdigest() == manifest["sha256"]
        server_log = output / (group + "-server.log")
        server = subprocess.Popen(["node", "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000"], cwd=ROOT, env={**env, **(extra or {})}, stdout=server_log.open("a"), stderr=subprocess.STDOUT)
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            if server.poll() is not None:
                raise RuntimeError("Next server exited before readiness")
            try:
                with urllib.request.urlopen("http://127.0.0.1:3000/", timeout=3) as response:
                    if response.status == 200:
                        return
            except (OSError, TimeoutError):
                time.sleep(0.5)
        raise RuntimeError("HTTP readiness timeout")

    try:
        persist()
        run("db:deploy"); run("db:seed"); run("auth:fixtures")
        provider = subprocess.Popen(["node", "--import", "tsx", "scripts/auth-fixtures/provider.ts"], cwd=ROOT, env=env, stdout=(output / (group + "-oidc.log")).open("w"), stderr=subprocess.STDOUT)
        deadline = time.monotonic() + 30
        while True:
            if provider.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError("Synthetic OIDC readiness failed")
            try:
                with urllib.request.urlopen(env["AUTH_TEST_ISSUER"] + "/.well-known/openid-configuration", timeout=2) as response:
                    if response.status == 200:
                        break
            except (OSError, TimeoutError):
                time.sleep(0.2)
        phase = "functional"
        for command in suites["db"]:
            run(command)
        if suites.get("security"):
            phase = "infrastructure"
            start()
            phase = "functional"
            for command in suites["security"]:
                run(command)
            stop()
        if suites["ui"]:
            phase = "infrastructure"
            start()
            base = "http://127.0.0.1:3000"
            ui_env = {prefix + "_UI_BASE_URL": base for prefix in ["D1B", "D1C", "PHASE3B1", "PHASE3B2", "C3", "R2C", "R3A", "R3B", "R3C", "R4A", "R4B", "R4B_AUDITS", "ANNUAL", "R4C", "P1A", "P1B1", "P1B2", "P2A", "P2B", "P2C", "P3C1", "PNT_FINAL"]}
            for prefix in ["D1B", "D1C", "PHASE3B1", "PHASE3B2", "PNT_FINAL", "P3C1"]:
                ui_env[prefix + "_SCREENSHOT_DIR"] = str(output / (group + "-" + prefix))
            ui_env["ANNUAL_UI_CAPTURE_DIR"] = str(output / (group + "-ANNUAL"))
            phase = "functional"
            for command in suites["ui"]:
                run(command, ui_env)
            if suites.get("auth"):
                phase = "infrastructure"
                stop()
                secret = "synthetic-test-key-not-a-real-secret"
                start({"PNT_DOCUMENT_ACCESS_MODE": "trusted-proxy", "PNT_DOCUMENT_PROXY_SECRET": secret})
                phase = "functional"
                for command, flag in suites["auth"]:
                    run(command, {**ui_env, "PNT_DOCUMENT_PROXY_SECRET": secret, flag: "true"})
        result["status"] = "success"
    except Exception as error:
        result["status"] = "failure"
        result["failureKind"] = phase
        result["error"] = str(error)
        if server_log and server_log.exists():
            print(server_log.read_text()[-12000:])
        raise
    finally:
        try:
            stop()
        finally:
            if provider:
                provider.terminate()
                provider.wait(timeout=30)
            persist()

if __name__ == "__main__":
    main()

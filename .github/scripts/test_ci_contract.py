import copy
import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / ".github/scripts" / (name + ".py"))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

scope = load("controlled_document_scope")
gate = load("ci_gate")
groups = json.loads((ROOT / ".github/ci-suites.json").read_text())

class Contract(unittest.TestCase):
    def setUp(self):
        self.needs = {name: {"result": "success"} for name in ["scope", "quality", "regression"]}
        self.evidence = {"quality": {"sha": "head", "status": "success"}}
        for name, suite in groups.items():
            commands = ["db:deploy", "db:seed"] + suite["db"] + suite["ui"] + [x[0] for x in suite.get("auth", [])]
            self.evidence[name] = {"sha": "head", "status": "success", "commands": [{"command": c, "status": 0} for c in commands]}

    def check(self, evidence=None, needs=None, docs=False, classified="head"):
        return gate.evaluate("head", classified, docs, needs or self.needs, self.evidence if evidence is None else evidence, groups)

    def test_success(self):
        self.assertEqual(self.check(), [])

    def test_each_job_failure_skip_cancel_absence(self):
        for name in self.needs:
            for status in ["failure", "skipped", "cancelled", "timed_out", "unknown"]:
                with self.subTest(name=name, status=status):
                    needs = copy.deepcopy(self.needs); needs[name]["result"] = status
                    self.assertTrue(self.check(needs=needs))
            needs = copy.deepcopy(self.needs); del needs[name]
            self.assertTrue(self.check(needs=needs))

    def test_each_group_missing_stale_failed_and_unexecuted_suite(self):
        for name in self.evidence:
            evidence = copy.deepcopy(self.evidence); del evidence[name]
            self.assertTrue(self.check(evidence=evidence))
            for field, value in [("sha", "old"), ("status", "failure")]:
                evidence = copy.deepcopy(self.evidence); evidence[name][field] = value
                self.assertTrue(self.check(evidence=evidence))
            if name != "quality":
                evidence = copy.deepcopy(self.evidence); evidence[name]["commands"].pop()
                self.assertTrue(self.check(evidence=evidence))
                evidence = copy.deepcopy(self.evidence); evidence[name]["commands"][0]["status"] = 1
                self.assertTrue(self.check(evidence=evidence))

    def test_classification_and_documentation_route(self):
        self.assertTrue(self.check(classified="old"))
        needs = {"scope": {"result": "success"}, "quality": {"result": "skipped"}, "regression": {"result": "skipped"}}
        self.assertEqual(self.check(needs=needs, docs=True, evidence={}), [])
        needs["regression"]["result"] = "failure"
        self.assertTrue(self.check(needs=needs, docs=True, evidence={}))
        for path in ["docs/a.md", "README.md"]:
            self.assertTrue(scope.docs_only([path], {path: "100644"}))
        for path in ["AGENTS.md", "src/a.ts", "prisma/schema.prisma", "prisma/migrations/a.sql", "package.json", "pnpm-lock.yaml", "next.config.ts", "scripts/test.ts", ".github/workflows/ci.yml", ".github/scripts/x.py", "docs/a.py", "docs/../src/a.md"]:
            self.assertFalse(scope.docs_only(["docs/a.md", path], {"docs/a.md": "100644", path: "100644"}))
        for mode in ["120000", "100755", None]:
            self.assertFalse(scope.docs_only(["docs/a.md"], {"docs/a.md": mode}))
        self.assertFalse(scope.docs_only([], {}))

    def test_inventory_does_not_drop_any_existing_smoke(self):
        scripts = json.loads((ROOT / "package.json").read_text())["scripts"]
        listed = {command for suite in groups.values() for command in suite["db"] + suite["ui"] + [x[0] for x in suite.get("auth", [])]}
        required = {name for name in scripts if name.endswith(":smoke")}
        self.assertEqual(required - listed, set())
        self.assertEqual(listed - set(scripts), set())

if __name__ == "__main__":
    unittest.main()

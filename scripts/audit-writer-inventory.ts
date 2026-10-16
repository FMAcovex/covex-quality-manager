import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { Prisma } from "@prisma/client";
import ts from "typescript";
import { auditManifestJson } from "./audit-manifest-format";

// Static source metadata only. Never executes a writer or reads a database.
const writes = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert", "delete", "deleteMany"]);
const nestedWrites = new Set([...writes, "connect", "connectOrCreate", "disconnect", "set"]);
const models = new Map(Prisma.dmmf.datamodel.models.map(model => [model.name[0].toLowerCase() + model.name.slice(1), model]));
type Writer = { file: string; line: number; function: string; model: string; method: string; inputFields: string[]; nested: { path: string; model: string; operation: string }[]; dynamicInput: boolean };
type Sql = { file: string; line: number; function: string; method: string; reviewRequired: true };

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : /\.(ts|tsx)$/.test(entry.name) ? [join(dir, entry.name)] : []).sort();
}
function excluded(file: string) {
  return /(?:\.test\.|\/__tests__\/|\/.*fixtures\/|-fixtures\.|\/smoke-|\/auth-fixtures\/|\/audit-fixtures\/|\/seed-demo\.|\/scripts\/demo\/|\/benchmark-|\/generate-demo-)/.test(file) || /\/audit-writer-inventory\.ts$/.test(file);
}
function name(node: ts.Node | undefined): string | undefined {
  return node && (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) ? node.text : undefined;
}
function owner(node: ts.Node): string {
  for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionDeclaration(parent) && parent.name) return parent.name.text;
    if ((ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) && ts.isVariableDeclaration(parent.parent)) return parent.parent.name.getText();
  }
  return "<module>";
}
function objectFields(node: ts.Node): string[] {
  const result = new Set<string>();
  function visit(current: ts.Node) {
    if (ts.isPropertyAssignment(current) || ts.isShorthandPropertyAssignment(current)) {
      const key = name(current.name); if (key) result.add(key);
    }
    ts.forEachChild(current, visit);
  }
  visit(node); return [...result].sort();
}
function nested(node: ts.Node, modelName: string, prefix = ""): Writer["nested"] {
  const model = Prisma.dmmf.datamodel.models.find(m => m.name === modelName);
  if (!model || !ts.isObjectLiteralExpression(node)) return [];
  const found: Writer["nested"] = [];
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const key = name(property.name), field = model.fields.find(f => f.name === key && f.kind === "object");
    if (field && ts.isObjectLiteralExpression(property.initializer)) {
      for (const operation of property.initializer.properties) {
        if (!ts.isPropertyAssignment(operation)) continue;
        const method = name(operation.name); if (!method || !nestedWrites.has(method)) continue;
        const path = prefix + field.name;
        found.push({ path, model: field.type, operation: method });
        const values = ts.isArrayLiteralExpression(operation.initializer) ? operation.initializer.elements : [operation.initializer];
        for (const value of values) found.push(...nested(value, field.type, path + "."));
      }
    } else if (key && ["data", "create", "update"].includes(key)) {
      const values = ts.isArrayLiteralExpression(property.initializer) ? property.initializer.elements : [property.initializer];
      for (const value of values) found.push(...nested(value, modelName, prefix));
    }
  }
  return found.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
export function auditWriterInventory(root = process.cwd()) {
  const writers: Writer[] = [], rawSql: Sql[] = [], independentClients: { file: string; line: number; function: string }[] = [];
  const sources = files(join(root, "src")).concat(files(join(root, "scripts"))).filter(file => !excluded(file));
  const fingerprints: Record<string,string> = {};
  for (const file of sources) {
    const path = relative(root, file).replaceAll("\\", "/"), source = readFileSync(file, "utf8");
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const location = (node: ts.Node) => ({ file: path, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, function: owner(node) });
    let relevant = false;
    function visit(node: ts.Node) {
      if (ts.isNewExpression(node) && name(node.expression) === "PrismaClient") { independentClients.push(location(node)); relevant = true; }
      const expression = ts.isCallExpression(node) ? node.expression : ts.isTaggedTemplateExpression(node) ? node.tag : undefined;
      if (expression && ts.isPropertyAccessExpression(expression)) {
        const method = expression.name.text;
        if (["$executeRaw", "$executeRawUnsafe", "$queryRaw", "$queryRawUnsafe"].includes(method)) {
          // Includes SELECT functions/CTEs that may write. No SQL text/values are published.
          rawSql.push({ ...location(node), method, reviewRequired: true }); relevant = true;
        }
        if (writes.has(method) && ts.isCallExpression(node) && ts.isPropertyAccessExpression(expression.expression)) {
          const model = models.get(expression.expression.name.text);
          if (model) {
            const input = node.arguments[0];
            writers.push({ ...location(node), model: model.name, method, inputFields: input ? objectFields(input) : [], nested: input ? nested(input, model.name) : [], dynamicInput: !input || !ts.isObjectLiteralExpression(input) || input.getText(ast).includes("...") });
            relevant = true;
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    if (relevant) fingerprints[path] = createHash("sha256").update(source).digest("hex");
  }
  return { schemaVersion: 1, interpretation: "STATIC_CANDIDATES_NOT_SQL_COVERAGE", writers, rawSql, independentClients, fingerprints };
}
if (basename(process.argv[1] ?? "") === "audit-writer-inventory.ts" && process.argv.includes("--print")) process.stdout.write(auditManifestJson(auditWriterInventory()));

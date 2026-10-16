import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import inventory from "./operation-inventory.json";
const root = process.cwd();
function files(path: string): string[] {
  return readdirSync(resolve(root, path), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path + "/" + entry.name) : [path + "/" + entry.name]);
}
function exports(file: string) {
  const source = readFileSync(resolve(root, file), "utf8"), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const declarations = ast.statements.filter(ts.isFunctionDeclaration).filter(node => node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword));
  const variables = ast.statements.filter(ts.isVariableStatement).filter(node => node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)).flatMap(node => node.declarationList.declarations);
  const bodies = new Map([...declarations.map(node => [node.name?.text, node.body?.getText(ast) ?? ""] as const), ...variables.map(node => [node.name.getText(ast), node.initializer?.getText(ast) ?? ""] as const)]);
  return { source, names: [...bodies.keys()], bodies };
}
describe("4B1 inventario exhaustivo de entradas protegidas", () => {
  it("cada Server Action exportada tiene permiso inventariado y guarda", () => {
    const found: string[] = [];
    for (const file of files("src").filter(p => /\.(ts|tsx)$/.test(p) && !p.endsWith(".test.ts"))) {
      const source = readFileSync(resolve(root, file), "utf8");
      if (!/^\s*["']use server["'];/.test(source)) continue;
      for (const name of exports(file).names) {
        const entry = inventory.actions.find(a => a.file === file && a.name === name); expect(entry, file + ":" + name).toBeDefined();
        expect(exports(file).bodies.get(name)).toMatch(entry && "guard" in entry ? /administerUser|configureRole/ : /authorizedAction\(/);
        found.push(file + ":" + name);
      }
    }
    expect(found.sort()).toEqual(inventory.actions.map(a => a.file + ":" + a.name).sort());
  });
  it("cada método API/auth está inventariado y usa la frontera correspondiente", () => {
    const found: string[] = [];
    for (const file of files("src/app").filter(p => p.endsWith("/route.ts"))) for (const name of exports(file).names.filter(n => n && ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(n))) {
      const entry = inventory.routes.find(r => r.file === file && r.method === name), source = exports(file).bodies.get(name)!;
      expect(entry, file + ":" + name).toBeDefined();
      if (entry?.public) expect(["src/app/api/health/route.ts", "src/app/auth/login/route.ts", "src/app/auth/callback/route.ts", "src/app/auth/demo/route.ts"]).toContain(file);
      else expect(source).toMatch(entry && "guard" in entry ? /requireUser|requireCsrf/ : /authorizedRoute\(/);
      found.push(file + ":" + name);
    }
    expect(found.sort()).toEqual(inventory.routes.map(r => r.file + ":" + r.method).sort());
  });
  it("cada página con datos autoriza antes de consultar; solo login es pública", () => {
    const pages = files("src/app").filter(p => p.endsWith("/page.tsx"));
    expect(pages.sort()).toEqual([...inventory.pages].sort());
    for (const file of pages.filter(p => p !== "src/app/login/page.tsx")) expect(readFileSync(resolve(root, file), "utf8")).toMatch(/authorizedPage\(|requireUserAdministration\(/);
  });
});

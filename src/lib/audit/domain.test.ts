import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import contract from "../../../ops/backup/audit-contract.json";
import { commandDigest, pilotCommandSchema } from "./domain";
const command = { requestId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",reason:"Synthetic",changes:[{qmsRecordId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",value:4}] };
describe("B1 pilot input and protected SQL release",()=>{
  it.each(["actor","actorUserId","origin","policyVersion","occurredAt","capturedAt","token","binary"])("rejects client metadata %s",key=>{
    expect(pilotCommandSchema.safeParse({...command,[key]:"untrusted"}).success).toBe(false);
  });
  it("rejects duplicate roots and invalid numeric values",()=>{
    expect(pilotCommandSchema.safeParse({...command,changes:[...command.changes,...command.changes]}).success).toBe(false);
    for(const value of [-1,1.5,2147483648,NaN])expect(pilotCommandSchema.safeParse({...command,changes:[{...command.changes[0],value}]}).success).toBe(false);
  });
  it("fingerprints command content, not actor tokens or input order",()=>{
    const other={qmsRecordId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",value:5};
    expect(commandDigest({...command,changes:[...command.changes,other]})).toBe(commandDigest({...command,changes:[other,...command.changes]}));
    expect(commandDigest(command)).not.toBe(commandDigest({...command,reason:"Changed"}));
  });
  it("matches every SQL function body to the release protection contract",()=>{
    const sql=readFileSync("prisma/migrations/20261013000100_audit_engine_b1/migration.sql","utf8");
    const functions=[...sql.matchAll(/CREATE FUNCTION (covex_audit_\w+)\([\s\S]*? AS \$\$([\s\S]*?)\$\$;/g)];
    expect(functions.length).toBe(Object.keys(contract.functions).length);
    for(const match of functions){
      const expected=contract.functions[match[1] as keyof typeof contract.functions];
      expect(createHash("sha256").update(match[2]).digest("hex")).toBe(expected.sha256);
      expect(match[0].split(" AS $$")[0].includes("SECURITY DEFINER")).toBe(expected.definer);
    }
    expect([...sql.matchAll(/CREATE (?:CONSTRAINT )?TRIGGER /g)]).toHaveLength(contract.triggers.length);
  });
});

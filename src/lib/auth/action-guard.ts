import { prisma } from "../db";
import { auditPolicyState } from "../audit/activation";
import inventory from "./operation-inventory.json";
import { AccessError, currentIdentity, identityContext, type AccessModule, type AccessPermission } from "./context";
import { assertPermission } from "./policy";
import { qmsScope, resourceScope, reviewScope } from "./resources";
import { requireCsrf, requireUser } from "./session";
import { qmsRecordModuleKeys, qmsRecordTypes } from "@/modules/registry";

const actorKeys = ["actor", "createdByText", "acceptedByText", "resolvedByText"];
export function authenticatedArguments(args: unknown[], name: string, creation = false, action = "") {
  return args.map(arg => {
    if (arg instanceof FormData) { const copy = new FormData(); for (const [key, value] of arg) copy.append(key, value); copy.set("actor", name); copy.set("modifiedByText", name); if (creation) copy.set("createdByText", name); return copy; }
    if (arg && typeof arg === "object" && !(arg instanceof Date)) {
      const copy = { ...arg } as Record<string, unknown>;
      delete copy._covexCsrf;
      for (const key of actorKeys) if (key in copy) copy[key] = name;
      if ("qmsRecordId" in copy || "reviewThreadId" in copy) copy[action.startsWith("accept") ? "acceptedByText" : action.startsWith("resolve") ? "resolvedByText" : "createdByText"] = name;
      return copy;
    }
    return arg;
  });
}
async function configurationModule(entry: typeof inventory.actions[number], args: unknown[]): Promise<AccessModule> {
  const form = args.find(a => a instanceof FormData) as FormData | undefined;
  const model = entry.name.includes("Template") ? "templateVersion" : entry.name.includes("FormField") ? "formFieldConfig" : entry.name.includes("FormVersion") ? "formVersion" : entry.name.includes("Alert") ? "alertRule" : entry.name === "createCatalogItemAction" ? "lookupCatalog" : entry.name.includes("CatalogItem") ? "lookupCatalogItem" : entry.name.includes("Catalog") ? "lookupCatalog" : null;
  if (model && entry.resourceArg >= 0) {
    type Lookup = { findUnique(args: object): Promise<{ module?: AccessModule | null; formVersion?: { module: AccessModule }; catalog?: { module: AccessModule | null } } | null> };
    const row = await (prisma as unknown as Record<string, Lookup>)[model].findUnique({ where: { id: String(args[entry.resourceArg]) }, ...(model === "formFieldConfig" ? { include: { formVersion: true } } : model === "lookupCatalogItem" ? { include: { catalog: true } } : {}) });
    if (!row) throw new AccessError(403);
    return row.module ?? row.formVersion?.module ?? row.catalog?.module ?? "SYSTEM";
  }
  const raw = form?.get("module");
  const createsModuleResource = ["createCatalogAction", "registerTemplateVersionAction"].includes(entry.name);
  return createsModuleResource && raw && (qmsRecordModuleKeys as readonly string[]).includes(String(raw)) ? String(raw) as AccessModule : "SYSTEM";
}
async function authorizeAndRun<T>(name: string, args: unknown[], run: (authenticated: unknown[]) => Promise<T>): Promise<T> {
  const entry = inventory.actions.find(a => a.name === name); if (!entry) throw new AccessError(403);
  const user = await requireUser(), form = args.find(a => a instanceof FormData) as FormData | undefined;
  const csrfInput = args.find(a => a && typeof a === "object" && "_covexCsrf" in a) as { _covexCsrf?: string } | undefined;
  const csrfForm = form ?? (csrfInput ? new FormData() : undefined);
  if (!form && csrfForm) csrfForm.set("_covexCsrf", csrfInput?._covexCsrf ?? "");
  await requireCsrf(undefined, csrfForm);
  let accessModule = entry.module as AccessModule, permission = entry.permission as AccessPermission;
  let scope: { id?: string; departmentIds?: string[] } = {};
  const unit = currentIdentity()?.unitTest && process.env.VITEST === "true" && process.env.APP_ENV === "test";
  if (entry.module === "QMS") {
    if (!unit) { const resolved = await reviewScope(args[0] as Record<string, unknown>); accessModule = resolved.module; scope = resolved.scope; }
    else accessModule = "DEVIATION";
  } else if (accessModule === "SYSTEM") { if (!unit) accessModule = await configurationModule(entry, args); }
  else {
    const id = entry.resourceArg >= 0 ? args[entry.resourceArg] : null;
    if (entry.dynamicCreate) permission = (name === "revisionAction" ? args[1] : id) ? "EDIT" : "CREATE";
    if (name === "saveAuditChildAction") {
      if (typeof args[1] !== "string" || !["finding", "action", "followup"].includes(args[1])) throw new AccessError(403);
      if (args[1] === "followup") permission = "FOLLOWUP";
    }
    if (id && !unit) scope = await resourceScope(accessModule, String(id), entry.resourceKind);
    else if (form) { const dept = form.get("departmentId") ?? form.get("codingDepartmentId"); scope.departmentIds = dept ? [String(dept)] : []; }
  }
  assertPermission(user, accessModule, permission, scope);
  if (entry.module === "SYSTEM" && form?.get("module") && form.get("module") !== accessModule) assertPermission(user, String(form.get("module")) as AccessModule, "MANAGE_CONFIGURATION");
  // Reclamaciones envía el estado de destino en `saveStatus` (prevalece sobre `status`).
  if (form?.get("status") === "CLOSED" || form?.get("saveStatus") === "CLOSED" || form?.get("treatmentStatus") === "CLOSED") assertPermission(user, accessModule, "CLOSE", scope);
  if (form?.get("finalStatus") === "CLOSED" || form?.get("closeChange") === "true") assertPermission(user, accessModule, "CLOSE", scope);
  if ([form?.get("status"), form?.get("administrativeStatus")].some(value => value === "ANNULLED" || value === "CANCELLED")) assertPermission(user, accessModule, "ANNUL", scope);
  if (form?.get("departmentId") && scope.id) assertPermission(user, accessModule, permission, { id: scope.id, departmentIds: [String(form.get("departmentId"))] });
  if (accessModule === "AUDIT" && form) {
    const departments = form.getAll("departmentIds").map(String);
    if (departments.length) assertPermission(user, accessModule, permission, { id: scope.id, departmentIds: departments });
    if (!unit && form.get("planEntryId")) {
      const entry = await prisma.auditPlanEntry.findUnique({ where: { id: String(form.get("planEntryId")) }, select: { planId: true } });
      if (entry) assertPermission(user, "AUDIT", "EDIT", { id: entry.planId });
    }
  }
  // R5B2: crear una CAPA o Desviación desde un hallazgo exige poder editar su auditoría. Sin base de datos
  // (modo unitario) solo se puede comprobar el permiso del módulo; el ámbito se comprueba abajo.
  if (unit && form?.get("fromAuditFindingId")) assertPermission(user, "AUDIT", "EDIT");
  if (!unit && form) {
    const ids = new Set<string>();
    const collect = (value: unknown) => {
      if (Array.isArray(value)) { value.forEach(collect); return; }
      if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) {
        if (/^(qmsRecordId|linkedCapaRecordId|originRecordId|targetRecordId)$/.test(key) && typeof item === "string" && /^[0-9a-f-]{36}$/i.test(item)) ids.add(item);
        else if (item && typeof item === "object") collect(item);
      }
    };
    for (const [key, value] of form) {
      if (/Json$/.test(key) && typeof value === "string") { try { collect(JSON.parse(value)); } catch { /* Domain validation reports malformed input. */ } }
      else if (/^(qmsRecordId|linkedCapaRecordId|originRecordId|targetRecordId)$/.test(key) && typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)) ids.add(value);
    }
    if (/Relation/.test(name) && form.get("businessCode") && form.get("recordType")) {
      const type = String(form.get("recordType"));
      if ((qmsRecordTypes as readonly string[]).includes(type)) {
        const target = await prisma.qmsRecord.findFirst({ where: { recordType: type as import("@prisma/client").QmsRecordType, businessCode: String(form.get("businessCode")).trim() }, select: { id: true } });
        if (target) ids.add(target.id);
      }
    }
    for (const id of ids) { const other = await qmsScope(id); assertPermission(user, other.module, "EDIT", other.scope); }
    for (const [key, parentModule, model] of [["fromDeviationPlanId", "DEVIATION", "deviationCapaPlan"], ["fromComplaintPlanId", "COMPLAINT", "complaintCapaPlan"]] as const) {
      const id = form.get(key); if (!id) continue;
      type Plan = { findUnique(args: object): Promise<{ deviationId?: string; complaintId?: string } | null> };
      const parent = await (prisma as unknown as Record<string, Plan>)[model].findUnique({ where: { id: String(id) } });
      if (parent) assertPermission(user, parentModule, "EDIT", await resourceScope(parentModule, parent.deviationId ?? parent.complaintId));
    }
    if (form.get("fromComplaintId")) assertPermission(user, "COMPLAINT", "EDIT", await resourceScope("COMPLAINT", String(form.get("fromComplaintId"))));
    // R5B2: crear una CAPA o Desviación desde un hallazgo escribe la atribución en la auditoría.
    if (form.get("fromAuditFindingId")) {
      const finding = await prisma.auditFinding.findUnique({ where: { id: String(form.get("fromAuditFindingId")) }, select: { auditId: true } });
      if (finding) assertPermission(user, "AUDIT", "EDIT", await resourceScope("AUDIT", finding.auditId));
      else assertPermission(user, "AUDIT", "EDIT");
    }
  }
  // Relations can refresh snapshots at both endpoints; authorize every affected record.
  if (!unit && /Relation|unlink|linkAudit|Attribution/.test(name)) {
    const candidates = [form?.get("targetRecordId"), form?.get("relatedQmsRecordId"), ...entry.params.flatMap((p, i) => /(?:QmsRecordId|targetRecordId)/.test(p) ? [args[i]] : [])].filter(v => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v));
    for (const target of candidates) { const other = await qmsScope(String(target)); assertPermission(user, other.module, "EDIT", other.scope); }
  }
  const context = currentIdentity();
  return identityContext.run({ principal: user, ...(context?.unitTest ? { unitTest: true } : {}), ...(context?.testHarness ? { testHarness: true } : {}), auditClaims: context?.auditClaims, resource: scope, module: accessModule, createdRecords: context?.createdRecords ?? new Set<string>() }, async () => {
    const execute = () => run(authenticatedArguments(args, user.name, permission === "CREATE", name));
    if (unit) return execute();
    if (!(await auditPolicyState(prisma)).required) return execute();
    const { actionAuditBoundary } = await import("../audit/action-boundary");
    return actionAuditBoundary(name, args, accessModule, permission, execute);
  });
}

export async function authorizedAction<T>(name: string, args: unknown[], run: (authenticated: unknown[]) => Promise<T>): Promise<T> {
  const context = currentIdentity();
  const principal = await requireUser();
  return identityContext.run({ ...context, principal, auditClaims: [] }, () => authorizeAndRun(name, args, run));
}

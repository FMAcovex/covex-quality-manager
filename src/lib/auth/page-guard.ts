import { redirect } from "next/navigation";
import { AccessError, currentIdentity, identityContext, type AccessModule } from "./context";
import { assertPermission } from "./policy";
import { requireUser } from "./session";
import { createElement, type ReactNode } from "react";
import { PermissionProvider } from "@/components/permissions";
import { canPresent, presentationAccess } from "./presentation";
import { resourceScope, qmsScope } from "./resources";
import { prisma } from "../db";

const paths: Record<string, AccessModule> = { deviations: "DEVIATION", capa: "CAPA", changes: "CHANGE_CONTROL", complaints: "COMPLAINT", returns: "RETURN", audits: "AUDIT", "controlled-documents": "PNT", settings: "SYSTEM", "audit-trail": "DEVIATION" };
function forbidden(segment: string) {
  return createElement("section", { className: "card", role: "alert" }, createElement("h1", null, "Acceso no permitido"), createElement("p", null, "No tiene permiso para esta operación. Puede seguir consultando los expedientes."), createElement("a", { className: "button", href: `/${segment}` }, "Volver al listado"));
}

export async function authorizedPage(file: string, run: () => ReactNode | void | Promise<ReactNode | void>, args: unknown[] = []): Promise<ReactNode> {
  try {
    const user = await requireUser();
    const route = file.replace("src/app/", "").replace("/page.tsx", "");
    const segment = route.split("/")[0];
    const accessModule = paths[segment] ?? "DEVIATION";
    assertPermission(user, accessModule, "READ");
    const props = args[0] as { params?: Promise<{ id?: string }> ; searchParams?: Promise<Record<string, string>> } | undefined;
    const params = await props?.params as { id?: string; sequence?: string } | undefined;
    const scope = await resourceScope(accessModule, params?.id, route.includes("audits/plans/[id]") ? "AUDIT_PLAN" : "RECORD");
    const access = presentationAccess(user, accessModule, scope);
    if (!params?.id) access.current = { ...access.modules[accessModule] };
    if (!params?.id && accessModule !== "SYSTEM") access.current.FOLLOWUP ||= user.departmentIds.some(id => canPresent(user, accessModule, "FOLLOWUP", { departmentIds: [id] })) || user.assignments.some(a => a.module === accessModule && canPresent(user, accessModule, "FOLLOWUP", { id: a.recordId }));
    if (params?.id && !route.includes("import-index") && !route.includes("/plans/")) {
      const model = { DEVIATION: "deviation", CAPA: "capa", CHANGE_CONTROL: "changeControl", COMPLAINT: "complaint", RETURN: "returnRecord", AUDIT: "audit" } as const;
      if (accessModule !== "SYSTEM" && accessModule !== "PNT") {
        type Delegate = { findUnique(args: object): Promise<{ status?: string; finalStatus?: string } | null> };
        const record = await (prisma as unknown as Record<string, Delegate>)[model[accessModule]].findUnique({ where: { id: params.id }, select: accessModule === "CHANGE_CONTROL" ? { finalStatus: true } : { status: true } });
        if ((record?.status ?? record?.finalStatus) === "CLOSED") access.editForm &&= access.current.CLOSE;
        if ((record?.status ?? record?.finalStatus) === "CANCELLED") access.editForm &&= access.current.ANNUL;
      }
    }
    const permission = route.includes("/followups/") ? "FOLLOWUP" : route.endsWith("/edit") || route.includes("/revisions/new") ? "EDIT" : route.endsWith("/new") ? "CREATE" : route.includes("import-index") && !route.endsWith("batches") && !params?.id ? "IMPORT" : null;
    let sourceAllowed = true;
    if (permission === "CREATE") {
      const query = await props?.searchParams;
      if (query?.fromComplaintId) sourceAllowed &&= canPresent(user, "COMPLAINT", "EDIT", await resourceScope("COMPLAINT", query.fromComplaintId));
      for (const [key, module, model, parentKey] of [["fromDeviationPlanId", "DEVIATION", "deviationCapaPlan", "deviationId"], ["fromComplaintPlanId", "COMPLAINT", "complaintCapaPlan", "complaintId"]] as const) {
        if (!query?.[key]) continue;
        type Delegate = { findUnique(args: object): Promise<Record<string, string> | null> };
        const plan = await (prisma as unknown as Record<string, Delegate>)[model].findUnique({ where: { id: query[key] }, select: { [parentKey]: true } });
        if (plan) sourceAllowed &&= canPresent(user, module, "EDIT", await resourceScope(module, plan[parentKey]));
      }
      if (query?.planEntryId) {
        const entry = await prisma.auditPlanEntry.findUnique({ where: { id: query.planEntryId }, select: { planId: true } });
        if (entry) sourceAllowed &&= canPresent(user, "AUDIT", "EDIT", { id: entry.planId });
      }
    }
    if (route.includes("/followups/") && params?.id && params.sequence && /^\d+$/.test(params.sequence)) {
      const followup = await prisma.changeControlFollowup.findFirst({ where: { changeControlId: params.id, sequenceNumber: Number(params.sequence) }, select: { closeChange: true } });
      if (followup?.closeChange) sourceAllowed &&= access.current.CLOSE;
    }
    // Deny entry before querying/rendering a mutating form, preserving all read pages.
    const denied = permission && (!sourceAllowed || !access.current[permission] || permission === "EDIT" && !access.editForm);
    if (denied) return forbidden(segment);
    const formPermission = permission ?? "EDIT";
    const departments = await prisma.department.findMany({ select: { id: true } });
    access.departments = Object.fromEntries(departments.map(d => [d.id, canPresent(user, accessModule, formPermission, { id: scope.id, departmentIds: [d.id] })]));
    if (accessModule === "AUDIT") {
      const plans = await prisma.auditAnnualPlan.findMany({ select: { id: true } });
      access.plans = Object.fromEntries(plans.map(p => [p.id, canPresent(user, "AUDIT", "EDIT", { id: p.id })]));
    }
    if (scope.id && access.current.EDIT && accessModule !== "PNT" && accessModule !== "SYSTEM" && !route.includes("/plans/")) {
      const relations = await prisma.qmsRelation.findMany({ where: { OR: [{ sourceRecordId: scope.id }, { targetRecordId: scope.id }] }, select: { sourceRecordId: true, targetRecordId: true, isActive: true, sourceRecord: { select: { recordType: true } }, targetRecord: { select: { recordType: true } } } });
      const targets = new Map(relations.flatMap(r => [[r.sourceRecordId, r.sourceRecord.recordType], [r.targetRecordId, r.targetRecord.recordType]] as const));
      await Promise.all([...targets].map(async ([id, module]) => {
        if (canPresent(user, module, "EDIT")) access.related[id] = true;
        else { const target = await qmsScope(id); access.related[id] = canPresent(user, target.module, "EDIT", target.scope); }
      }));
      // The CAPA editor re-synchronizes every active origin and requires both endpoints.
      if (accessModule === "CAPA") access.editForm &&= relations.filter(r => r.isActive && r.targetRecordId === scope.id).every(r => access.related[r.sourceRecordId]);
    }
    if (permission === "EDIT" && !access.editForm) return forbidden(segment);
    const context = currentIdentity();
    const content = await identityContext.run({ principal: user, ...(context?.unitTest ? { unitTest: true } : {}), ...(context?.testHarness ? { testHarness: true } : {}), module: accessModule, resource: scope }, run);
    return createElement(PermissionProvider, { value: access }, content ?? null);
  } catch (error) {
    if (error instanceof AccessError) redirect(error.status === 401 ? "/login" : "/login?error=access");
    throw error;
  }
}

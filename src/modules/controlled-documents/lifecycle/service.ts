import { createHash, randomUUID } from "node:crypto";
import { Prisma, PrismaClient, type ControlledDocumentRevision, type ControlledRevisionDecision } from "@prisma/client";
import { prisma } from "@/lib/db";
import { uuid } from "../documents/domain";
import { commandSchema, permissions, assertTransition, plannedDates, normalizedPerson, lifecycleHistoryActions, type LifecycleCommand } from "./domain";
import { requireLifecyclePermission, type LifecyclePrincipal } from "./access";
type Tx = Prisma.TransactionClient;
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
const day = (value: Date | null | undefined) => value?.toISOString().slice(0, 10);
const details = (d: ControlledRevisionDecision | undefined) => { if (!d) throw new Error("Falta decisión documental previa."); return d.details as unknown as LifecycleCommand; };
async function objects(tx: Tx, revisionId: string, ids: string[], basis?: string) {
  const rows = await tx.controlledRevisionDocument.findMany({ where: { revisionId, id: { in: ids } }, select: {
    id: true, revisionId: true, originalName: true, kind: true, state: true, sha256: true, sizeBytes: true,
    mimeType: true, externalReference: true, storageReference: true, replacement: { select: { id: true } },
    fileData: true,
  } });
  if (rows.length !== ids.length || rows.some(r => r.replacement)) throw new Error("Evidencia ajena a la revisión, inexistente o sustituida.");
  if (rows.some(r => r.externalReference) && !basis?.trim()) throw new Error("Una referencia externa exige fundamento del contraste humano; no acredita custodia ni SHA-256.");
  for (const row of rows) if (!row.externalReference && (!row.fileData || row.fileData.length !== row.sizeBytes || createHash("sha256").update(row.fileData).digest("hex") !== row.sha256)) throw new Error("Integridad SHA-256 de evidencia no verificada.");
  return rows.map(({ fileData: _bytes, ...metadata }) => { void _bytes; return metadata; });
}
async function append(tx: Tx, r: ControlledDocumentRevision, command: LifecycleCommand, p: LifecyclePrincipal, oldState: ControlledDocumentRevision["status"], before: unknown, after: unknown, hash: string) {
  const projection = await tx.controlledRevisionLifecycle.update({ where: { revisionId: r.id }, data: { version: { increment: 1 } } });
  const evidence = await objects(tx, r.id, command.evidenceIds, command.referenceBasis);
  const decision = await tx.controlledRevisionDecision.create({ data: {
    documentId: r.documentId, revisionId: r.id, sequence: projection.version, requestId: command.requestId, requestHash: hash,
    operation: command.operation, result: command.operation === "REGISTER_EXTERNAL" ? "RECORDED" : command.result,
    actor: p.name, identitySource: p.source, reason: command.reason, oldState, newState: r.status,
    details: json(command), before: json(before), after: json({ ...(after as Record<string, unknown>), projection }), rectifiesId: command.rectifiesId,
  } });
  if (evidence.length) await tx.controlledDecisionEvidence.createMany({ data: evidence.map(e => ({ revisionId: r.id, decisionId: decision.id, documentObjectId: e.id, snapshot: json(e) })) });
  await tx.controlledDocumentChange.create({ data: { documentId: r.documentId, revisionId: r.id,
    action: lifecycleHistoryActions.decision, changedByText: p.name, reason: command.reason,
    oldValue: json({ status: oldState, lifecycle: before }), newValue: json({ status: r.status, lifecycle: after, decisionId: decision.id, details: command }),
  } });
  return decision;
}
async function requirements(tx: Tx, revisionId: string, decisions: ControlledRevisionDecision[]) {
  const reset = decisions.findLast(d => d.operation === "RECTIFY")?.sequence || 0;
  const current = decisions.filter(d => d.sequence > reset);
  const verification = current.findLast(d => d.operation === "VERIFY");
  if (!verification || verification.result !== "FAVORABLE") throw new Error("Falta verificación documental favorable vigente.");
  await objects(tx, revisionId, details(verification).evidenceIds, details(verification).referenceBasis);
  const accepted: Partial<Record<"PREPARATION" | "REVIEW" | "APPROVAL", ControlledRevisionDecision>> = {};
  for (const d of current.filter(d => d.sequence > verification.sequence)) {
    if (d.operation !== "CONTRAST_EXTERNAL") continue;
    const registration = current.find(v => v.id === details(d).registrationId && v.operation === "REGISTER_EXTERNAL");
    if (!registration || !details(registration).function) continue;
    const role = details(registration).function!;
    delete accepted[role];
    if (d.result === "ACCEPTED") accepted[role] = registration;
  }
  for (const registration of Object.values(accepted)) await objects(tx, revisionId, details(registration).evidenceIds, details(registration).referenceBasis);
  return accepted;
}
export async function lifecycleDecision(documentId: string, revisionId: string, raw: unknown, principal: LifecyclePrincipal, db: PrismaClient = prisma) {
  uuid(documentId); uuid(revisionId);
  const c = commandSchema.parse(raw); requireLifecyclePermission(principal, permissions[c.operation]);
  const hash = createHash("sha256").update(JSON.stringify({ documentId, revisionId, command: c, actor: principal.name, source: principal.source })).digest("hex");
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ControlledDocument" WHERE id = ${documentId} FOR UPDATE`;
    const duplicate = await tx.controlledRevisionDecision.findUnique({ where: { requestId: c.requestId } });
    if (duplicate) { if (duplicate.requestHash !== hash) throw new Error("Identificador de solicitud reutilizado con datos diferentes."); return duplicate; }
    const master = await tx.controlledDocument.findUnique({ where: { id: documentId } });
    let r = await tx.controlledDocumentRevision.findFirst({ where: { documentId, id: revisionId } });
    if (!master || !r || master.administrativeStatus === "ANNULLED") throw new Error("Revisión no disponible para esta operación.");
    assertTransition(c.operation, r.status, c.function);
    if (r.consolidatedAt && !(await tx.controlledRevisionLifecycle.findUnique({ where: { revisionId } })) && !["RETIRE", "ANNUL", "RECTIFY"].includes(c.operation))
      throw new Error("Registro histórico P1A sin acreditación P2B; no se reinterpreta como aprobado.");
    const projection = await tx.controlledRevisionLifecycle.upsert({ where: { revisionId }, create: { revisionId, documentId,
      ...(r.consolidatedAt ? { legacyOrigin: true, effectiveFrom: r.effectiveFrom, reviewDueAt: r.reviewDueAt, obsoletedAt: r.obsoletedAt } : {}),
    }, update: {} });
    if (projection.version !== c.expectedVersion) throw new Error("La revisión ha cambiado. Recargue antes de decidir.");
    const oldState = r.status, before = { revision: r, projection };
    await objects(tx, revisionId, c.evidenceIds, c.referenceBasis);
    const decisions = await tx.controlledRevisionDecision.findMany({ where: { revisionId }, orderBy: { sequence: "asc" } });
    const today = new Date().toISOString().slice(0, 10);
    let status = r.status;
    if (c.operation === "VERIFY") {
      if (!["FAVORABLE", "DISCREPANCY"].includes(c.result || "")) throw new Error("Indique el resultado del contraste.");
      if (c.result === "DISCREPANCY" && !c.discrepancies) throw new Error("Describa las discrepancias detectadas.");
      if (c.result === "FAVORABLE" && c.discrepancies) throw new Error("No puede aceptar un contraste con discrepancias pendientes.");
      if (c.result === "FAVORABLE" && (!r.baseCodeSnapshot || !r.titleSnapshot || !r.departmentCodeSnapshot)) throw new Error("Faltan código, título o departamento congelados que contrastar; no se acredita una revisión incompleta.");
      if (c.result === "FAVORABLE") status = "IN_REVIEW";
    }
    if (c.operation === "REGISTER_EXTERNAL") {
      if (!c.function || !c.externalPerson || !c.responsibility || !c.authorityBasis || !c.accreditedDate || c.accreditedDate > today)
        throw new Error("La función externa exige identidad, cargo/ámbito, fundamento de autoridad y fecha acreditada no futura.");
    }
    if (c.operation === "CONTRAST_EXTERNAL") {
      const registration = decisions.find(d => d.id === c.registrationId && d.operation === "REGISTER_EXTERNAL");
      const reset = decisions.findLast(d => d.operation === "RECTIFY")?.sequence || 0;
      if (!registration || registration.sequence <= reset || !["ACCEPTED", "INSUFFICIENT", "REJECTED"].includes(c.result || "")) throw new Error("Seleccione un registro externo vigente y resultado del contraste.");
      if (details(registration).function === "APPROVAL" && r.status !== "PENDING_APPROVAL") throw new Error("Aprobación fuera de su fase documental.");
      const evidence = details(registration).evidenceIds;
      if (JSON.stringify([...evidence].sort()) !== JSON.stringify([...c.evidenceIds].sort())) throw new Error("El contraste debe identificar las mismas evidencias del registro externo.");
    }
    if (["SUBMIT", "PLAN", "ACTIVATE"].includes(c.operation)) {
      const accepted = await requirements(tx, revisionId, decisions);
      if (!accepted.PREPARATION || !accepted.REVIEW) throw new Error("Faltan preparación y revisión externas contrastadas y aceptadas.");
      if (c.operation === "SUBMIT") status = "PENDING_APPROVAL";
      else {
        if (!accepted.APPROVAL) throw new Error("Falta aprobación externa contrastada y aceptada.");
        if (normalizedPerson(details(accepted.PREPARATION).externalPerson!) === normalizedPerson(details(accepted.APPROVAL).externalPerson!)) throw new Error("Preparador y aprobador deben ser personas distintas (GC-00/001/03).");
        const plan = c.operation === "PLAN" ? c : details(decisions.findLast(d => d.operation === "PLAN")!);
        if (!plan || !plan.separationConfirmed || !plan.finalDocumentId || !plan.evidenceIds.includes(plan.finalDocumentId)) throw new Error("Identifique el documento final y confirme el contraste de separación de personas.");
        const final = await objects(tx, revisionId, [plan.finalDocumentId], plan.referenceBasis);
        const verification = decisions.findLast(d => d.operation === "VERIFY");
        if (!details(verification).evidenceIds.includes(plan.finalDocumentId) || !details(accepted.APPROVAL).evidenceIds.includes(plan.finalDocumentId)) throw new Error("El documento final debe estar identificado en la verificación y en el registro externo de aprobación contrastado.");
        if (!["DOCUMENT_PDF", "EXTERNAL_SIGNED_PDF"].includes(final[0].kind) || final[0].state === "WORKING") throw new Error("Word de trabajo u otro anexo no acredita el contenido controlado final.");
        const approval = details(accepted.APPROVAL).accreditedDate!;
        if ([accepted.PREPARATION, accepted.REVIEW].some(d => details(d).accreditedDate! > approval)) throw new Error("Aprobación anterior a preparación o revisión.");
        plannedDates(approval, plan.effectiveFrom, plan.reviewDueAt, today);
        if (c.operation === "PLAN") {
          await tx.controlledRevisionLifecycle.update({ where: { revisionId }, data: { approvalAt: new Date(approval), effectiveFrom: new Date(plan.effectiveFrom!), reviewDueAt: new Date(plan.reviewDueAt!) } });
          status = "APPROVED_PENDING_EFFECTIVE";
        } else {
          if (plan.effectiveFrom! > today || plan.reviewDueAt! <= today) throw new Error("Vigencia futura o revisión prevista vencida; no se puede activar.");
          const previous = await tx.controlledDocumentRevision.findFirst({ where: { documentId, status: "IN_FORCE" } });
          if ((previous?.id || null) !== c.previousRevisionId) throw new Error("Confirme explícitamente la revisión vigente anterior (o ausencia de ella).");
          if (!master.baseCode || !master.title || !master.departmentId) throw new Error("Complete el maestro antes de activar.");
          if (master.baseCode !== r.baseCodeSnapshot) throw new Error("El código del maestro no coincide con el código congelado de la revisión.");
          if (previous) {
            const previousProjection = await tx.controlledRevisionLifecycle.upsert({ where: { revisionId: previous.id }, create: { revisionId: previous.id, documentId, legacyOrigin: true, effectiveFrom: previous.effectiveFrom, reviewDueAt: previous.reviewDueAt }, update: {} });
            if (day(previousProjection.effectiveFrom) && plan.effectiveFrom! < day(previousProjection.effectiveFrom)!) throw new Error("Vigencia anterior incompatible.");
            const old = { revision: previous, projection: previousProjection };
            const obsolete = await tx.controlledDocumentRevision.update({ where: { id: previous.id }, data: { status: "OBSOLETE" } });
            const updated = await tx.controlledRevisionLifecycle.update({ where: { revisionId: previous.id }, data: { obsoletedAt: new Date(plan.effectiveFrom!) } });
            // Preserve original dates and objects; the previous decision carries its own revision evidence.
            const oldObjects = await tx.controlledRevisionDocument.findMany({ where: { revisionId: previous.id, replacement: null }, select: { id: true, externalReference: true } });
            const retirement: LifecycleCommand = { ...c, requestId: randomUUID(), operation: "RETIRE", evidenceIds: oldObjects.slice(0, 20).map(o => o.id), referenceBasis: "Retirada enlazada a activación explícita de revisión sucesora.", notes: `Revisión sucesora ${r.id}` };
            await append(tx, obsolete, retirement, principal, previous.status, old, { revision: obsolete, projection: updated }, hash);
          }
          await tx.controlledDocument.update({ where: { id: documentId }, data: { administrativeStatus: "ACTIVE" } });
          status = "IN_FORCE";
        }
      }
    }
    if (c.operation === "RETIRE" || c.operation === "ANNUL") {
      status = c.operation === "RETIRE" ? "OBSOLETE" : "ANNULLED";
      if (r.status === "IN_FORCE") await tx.controlledRevisionLifecycle.update({ where: { revisionId }, data: { obsoletedAt: new Date(today) } });
    }
    if (c.operation === "RECTIFY") {
      if (!decisions.some(d => d.id === c.rectifiesId)) throw new Error("Seleccione la decisión de esta revisión que se rectifica.");
      if (!["OBSOLETE", "ANNULLED"].includes(status)) {
        status = "IN_REVIEW";
        await tx.controlledRevisionLifecycle.update({ where: { revisionId }, data: { approvalAt: null, effectiveFrom: null, reviewDueAt: null } });
      }
    }
    const favorable = c.operation === "VERIFY" && c.result === "FAVORABLE";
    r = await tx.controlledDocumentRevision.update({ where: { id: revisionId }, data: { status,
      ...(favorable ? { verificationStatus: "VERIFIED", verifiedAt: new Date(), verifiedByText: principal.name } : {}),
      ...(c.operation === "VERIFY" && c.result === "DISCREPANCY" && oldState === "IN_REVIEW" || c.operation === "RECTIFY" && !["OBSOLETE", "ANNULLED"].includes(status) ? { verificationStatus: "REVIEW_REQUIRED" } : {}),
      ...(status === "IN_FORCE" ? { consolidatedAt: new Date() } : {}),
    } });
    const after = { revision: r, projection: await tx.controlledRevisionLifecycle.findUnique({ where: { revisionId } }) };
    return append(tx, r, c, principal, oldState, before, after, hash);
  }, { timeout: 30_000 });
}

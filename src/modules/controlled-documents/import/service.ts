import { Prisma, PrismaClient, type ControlledDocumentImportRow } from "@prisma/client";
import { importDb as prisma } from "./database";
import { previewIndex } from "../preview/service";
import type { PreviewReport, PreviewRow } from "../preview/types";
import { validateDepartmentForBaseCode } from "../domain";
import { bulkEligibility, bulkResolution } from "./bulk";
import { actorSchema, bulkDecisionSchema, decisionSchema, hash, validateCandidate, MAX_BATCH_BYTES, MAX_PENDING_BATCHES, RETENTION_DAYS, type DecisionInput, type Resolution } from "./domain";
import { auditPolicyState } from "@/lib/audit/activation";
import { assertAuditProtection, assertAuditApplicationRole } from "@/lib/audit/protection";
import { requireUser } from "@/lib/auth/session";
import { importAuditCommand, importActor, type ImportAuditRequest } from "./audit";
import { logServerError } from "@/lib/log/server-log";
type Tx = Prisma.TransactionClient;
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v));
const rowValue = (r: ControlledDocumentImportRow) => r.data as unknown as PreviewRow;
const date = (s: string) => s ? new Date(`${s}T00:00:00Z`) : null;
async function event(tx: Tx, batchId: string, action: string, actor: string, detail: unknown) {
    return tx.controlledDocumentImportEvent.create({ data: { batchId, action, actor, detail: json(detail) } });
}
async function transaction<T>(db: PrismaClient, fn: (tx: Tx) => Promise<T>): Promise<T> {
    try { return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 60000 }); }
    catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && (["P2034", "P2002"].includes(e.code) || e.code === "P2010" && e.meta?.code === "40001")) throw new Error("Confirmación concurrente: recupera el lote y revisa de nuevo. No se han repetido escrituras.");
        throw e;
    }
}
async function lockedBatch(tx: Tx, id: string, version?: number) {
    await tx.$queryRaw`SELECT id FROM "ControlledDocumentImportBatch" WHERE id = ${id} FOR UPDATE`;
    const b = await tx.controlledDocumentImportBatch.findUniqueOrThrow({ where: { id }, include: { rows: { orderBy: { sourceKey: "asc" } } } });
    if (version !== undefined && b.version !== version) throw new Error("El lote ha cambiado. Recupéralo antes de continuar.");
    return b;
}
function editable(b: { state: string; expiresAt: Date }) {
    if (!["PENDING", "PARTIAL"].includes(b.state) || b.expiresAt <= new Date()) throw new Error("El lote está cerrado o ha caducado.");
}
// Expiration removes only pending staging, never operational PNT/revisions or confirmed receipts.
export async function expireBatches(db: PrismaClient = prisma) {
    if ((await auditPolicyState(db)).required) {
        const principal = await requireUser();
        return transaction(db, async tx => {
            await assertAuditProtection(tx); await assertAuditApplicationRole(tx);
            const [result] = await tx.$queryRaw<{ expired: number }[]>`SELECT covex_b2_expire_staging(${principal.id}::uuid) AS expired`;
            return result.expired;
        });
    }
    return transaction(db, async tx => {
        const expired = await tx.controlledDocumentImportBatch.findMany({ where: { state: { in: ["PENDING", "PARTIAL"] }, expiresAt: { lte: new Date() } }, select: { id: true } });
        for (const item of expired) {
            const b = await lockedBatch(tx, item.id);
            if (!["PENDING", "PARTIAL"].includes(b.state)) continue;
            await tx.controlledDocumentImportRow.deleteMany({ where: { batchId: b.id, result: { equals: Prisma.DbNull } } });
            await tx.controlledDocumentImportBatch.update({ where: { id: b.id }, data: { state: "EXPIRED", version: { increment: 1 } } });
            await event(tx, b.id, "EXPIRED", "Retención de staging", { retainedConfirmedRows: b.rows.filter(r => r.result).length });
        }
        return expired.length;
    });
}
export async function createBatch(buffer: Buffer, fileName: string, actorValue: string, db: PrismaClient = prisma, request?: ImportAuditRequest) {
    const actor = actorSchema.parse(importActor(actorValue));
    const report = await previewIndex(buffer, fileName, {
        departments: () => db.department.findMany({ select: { id: true, code: true, isActive: true, name: true } }),
        documents: codes => db.controlledDocument.findMany({ where: { baseCode: { in: codes } }, include: { revisions: true } })
    });
    if (Buffer.byteLength(JSON.stringify(report)) > MAX_BATCH_BYTES) throw new Error("El análisis supera el límite de staging de 16 MiB.");
    await expireBatches(db);
    return importAuditCommand(db, "CREATE_BATCH", { fileName, sha256: report.sha256 }, null, request, () => transaction(db, async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(81724001)`;
        const count = await tx.controlledDocumentImportBatch.count({ where: { state: { in: ["PENDING", "PARTIAL"] } } });
        if (count >= MAX_PENDING_BATCHES) throw new Error("Límite de 100 lotes pendientes alcanzado. Resuelve o espera su caducidad.");
        const { rows, ...metadata } = report;
        const b = await tx.controlledDocumentImportBatch.create({ data: { fileName: report.fileName, sha256: report.sha256, analyzedAt: new Date(), actor, summary: json(report.summary), reportMetadata: json(metadata), expiresAt: new Date(Date.now() + RETENTION_DAYS * 86400000) } });
        await tx.controlledDocumentImportRow.createMany({ data: rows.map(r => ({ batchId: b.id, sourceKey: r.sourceKey, baseCode: r.normalized.baseCode, data: json(r), decision: r.classification === "PNT" ? "PENDING" : "EXCLUDED" })) });
        await event(tx, b.id, "CREATED", actor, { summary: report.summary, expiresAt: b.expiresAt });
        return b.id;
    }));
}
export async function getBatch(id: string, db: PrismaClient = prisma) {
    await expireBatches(db);
    return db.controlledDocumentImportBatch.findUniqueOrThrow({ where: { id }, include: { rows: { orderBy: { sourceKey: "asc" } }, events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } });
}
export async function listBatches(db: PrismaClient = prisma) {
    await expireBatches(db);
    return db.controlledDocumentImportBatch.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, fileName: true, actor: true, state: true, createdAt: true, expiresAt: true } });
}
async function current(tx: Tx, baseCode: string, departmentId: string) {
    const document = await tx.controlledDocument.findUnique({ where: { baseCode }, include: { revisions: { orderBy: { revisionCode: "asc" } } } });
    const department = await tx.department.findUnique({ where: { id: departmentId } });
    return { document, department, fingerprint: hash({ document, department }) };
}
export async function decide(id: string, input: DecisionInput, db: PrismaClient = prisma, request?: ImportAuditRequest) {
    const v = decisionSchema.parse({ ...input, actor: importActor(input.actor) });
    return importAuditCommand(db, "DECIDE", { id, input: v }, v.reason, request, () => transaction(db, async tx => {
        const b = await lockedBatch(tx, id, v.version); editable(b);
        const target = b.rows.find(r => r.sourceKey === v.sourceKey);
        if (!target || target.result) throw new Error("Fila no disponible para conciliación.");
        const source = rowValue(target);
        if (source.classification !== "PNT" && v.decision !== "EXCLUDED") throw new Error("Las familias no PNT permanecen excluidas.");
        let baseline: string | null = null;
        if (v.decision === "INCLUDE") {
            if (!v.resolution) throw new Error("Resuelve los datos y confirma su revisión manual.");
            validateCandidate(source, v.resolution);
            const now = await current(tx, target.baseCode!, v.resolution.departmentId);
            if (!now.department) throw new Error("Selecciona un departamento existente. No se creará ni reactivará.");
            validateDepartmentForBaseCode(target.baseCode!, now.department.code);
            baseline = now.fingerprint;
            const competing = b.rows.filter(r => r.baseCode === target.baseCode && r.id !== target.id && r.decision === "INCLUDE");
            if (competing.some(r => r.result)) throw new Error("El grupo ya tiene una procedencia confirmada.");
            if (competing.length && v.scope !== "GROUP") throw new Error("Selecciona explícitamente la procedencia válida del grupo.");
        }
        const affected = v.scope === "GROUP" && target.baseCode ? b.rows.filter(r => r.baseCode === target.baseCode && !r.result) : [target];
        for (const r of affected.sort((a, b) => Number(a.id === target.id) - Number(b.id === target.id))) {
            const decision = r.id === target.id ? v.decision : v.decision === "INCLUDE" ? "EXCLUDED" : v.decision;
            if (decision === "INCLUDE" && rowValue(r).classification !== "PNT") throw new Error("Las familias no PNT permanecen excluidas.");
            await tx.controlledDocumentImportRow.update({ where: { id: r.id }, data: { decision, resolution: decision === "INCLUDE" ? json(v.resolution!) : Prisma.DbNull, baseline: decision === "INCLUDE" ? baseline : null, decidedBy: v.actor, decidedAt: new Date() } });
        }
        await tx.controlledDocumentImportBatch.update({ where: { id }, data: { version: { increment: 1 } } });
        await event(tx, id, "DECISION", v.actor, { sourceKey: v.sourceKey, scope: v.scope, decision: v.decision, reason: v.reason, resolution: v.resolution || null, affectedKeys: affected.map(r => r.sourceKey) });
    }));
}
/**
 * Inclusión en bloque (D-093): incluye con los datos del índice las filas pendientes vigentes
 * sin incidencias y las anuladas según el índice. Una sola operación auditada (PN06) y un
 * evento DECISION con las claves afectadas; el resto se sigue decidiendo fila a fila.
 */
export async function decideBulk(id: string, input: { actor: string; reason: string; version: number }, db: PrismaClient = prisma, request?: ImportAuditRequest) {
    const v = bulkDecisionSchema.parse({ ...input, actor: importActor(input.actor) });
    return importAuditCommand(db, "DECIDE_BULK", { id, input: v }, v.reason, request, () => transaction(db, async tx => {
        const b = await lockedBatch(tx, id, v.version); editable(b);
        const candidates = b.rows.filter(r => r.decision === "PENDING" && !r.result).map(r => ({ r, source: rowValue(r) })).filter(c => bulkEligibility(c.source));
        if (!candidates.length) throw new Error("No hay filas que puedan incluirse en bloque.");
        // Misma huella que current() por fila, leída de una vez para no hacer cientos de consultas.
        const codes = [...new Set(candidates.map(c => c.source.normalized.baseCode!))];
        const documents = new Map((await tx.controlledDocument.findMany({ where: { baseCode: { in: codes } }, include: { revisions: { orderBy: { revisionCode: "asc" } } } })).map(d => [d.baseCode, d]));
        const departments = new Map((await tx.department.findMany({ where: { code: { in: [...new Set(codes.map(code => code.split("/")[0]))] } } })).map(d => [d.code, d]));
        const included: string[] = [], skipped: string[] = [];
        for (const { r, source } of candidates) {
            const baseCode = source.normalized.baseCode!, department = departments.get(baseCode.split("/")[0]);
            if (!department || b.rows.some(other => other.id !== r.id && other.baseCode === baseCode && other.decision === "INCLUDE")) { skipped.push(r.sourceKey); continue; }
            const resolution = validateCandidate(source, bulkResolution(source, department.id, v.reason));
            await tx.controlledDocumentImportRow.update({ where: { id: r.id }, data: { decision: "INCLUDE", resolution: json(resolution), baseline: hash({ document: documents.get(baseCode) ?? null, department }), decidedBy: v.actor, decidedAt: new Date() } });
            included.push(r.sourceKey);
        }
        await tx.controlledDocumentImportBatch.update({ where: { id }, data: { version: { increment: 1 } } });
        await event(tx, id, "DECISION", v.actor, { scope: "BULK", decision: "INCLUDE", reason: v.reason, affectedKeys: included, skippedKeys: skipped });
        return { included: included.length, skipped: skipped.length };
    }));
}
export type Proposal = { sourceKey: string; baseCode: string; kind: "NEW_DOCUMENT" | "NEW_REVISION" | "EXISTING" | "CONFLICT"; writes: number; reason?: string; fingerprint: string };
async function planRows(tx: Tx, rows: ControlledDocumentImportRow[]) {
    const proposals: Proposal[] = [];
    for (const r of rows.filter(r => r.decision === "INCLUDE" && !r.result)) {
        const source = rowValue(r), v = validateCandidate(source, r.resolution as unknown as Resolution);
        const now = await current(tx, r.baseCode!, v.departmentId), m = now.document, d = now.department;
        const existing = m?.revisions.find(rev => rev.revisionCode === v.revisionCode);
        const candidate: Proposal = { sourceKey: r.sourceKey, baseCode: r.baseCode!, kind: !m ? "NEW_DOCUMENT" : v.revisionCode && !existing ? "NEW_REVISION" : "EXISTING", writes: !m ? (v.revisionCode ? 4 : 2) : v.revisionCode && !existing ? 2 : 0, fingerprint: now.fingerprint };
        let reason: string | undefined;
        if (r.baseline !== now.fingerprint) reason = "La BD o el departamento cambiaron desde la decisión. Conciliar de nuevo.";
        else if (!d) reason = "Departamento desconocido.";
        else {
            try { validateDepartmentForBaseCode(r.baseCode!, d.code); }
            catch { /* Entrada mal formada: se trata como vacía o no válida. */ reason = "El código base no corresponde al departamento responsable."; }
        }
        if (!reason && m && m.documentType !== "PNT") reason = "Tipo documental incompatible.";
        else if (!reason && m?.administrativeStatus === "ANNULLED") reason = "Maestro anulado: omitir sin modificar.";
        else if (!reason && m && ((existing ? existing.titleSnapshot : m.title) !== v.title || (existing ? existing.departmentCodeSnapshot : m.departmentCodeSnapshot) !== d?.code || (!existing && m.departmentId !== v.departmentId))) reason = "Título o departamento difieren del registro existente. No se sobrescribe.";
        else if (!reason && existing && ((existing.effectiveFrom?.toISOString().slice(0,10) || "") !== v.effectiveFrom || (existing.reviewDueAt?.toISOString().slice(0,10) || "") !== v.reviewDueAt)) reason = "Fechas diferentes de la revisión existente. No se sobrescribe.";
        if (reason) { candidate.kind = "CONFLICT"; candidate.writes = 0; candidate.reason = reason; }
        proposals.push(candidate);
    }
    return proposals;
}
function planSummary(rows: ControlledDocumentImportRow[], proposals: Proposal[]) {
    const pendingConflicts = new Set(rows.filter(r => r.decision === "PENDING" && rowValue(r).issues.some(i => ["REVISION_DISCREPANCY", "DATA_CONFLICT", "TITLE_DISCREPANCY", "PERSISTED_CONFLICT", "STATE_CONFLICT"].includes(i))).map(r => r.baseCode || r.sourceKey)).size;
    const eligible = proposals.filter(p => p.kind !== "CONFLICT").length;
    return { newDocuments: proposals.filter(p => p.kind === "NEW_DOCUMENT").length, newRevisions: proposals.filter(p => p.kind === "NEW_REVISION" || p.kind === "NEW_DOCUMENT" && p.writes === 4).length, existing: proposals.filter(p => p.kind === "EXISTING").length, excluded: rows.filter(r => r.decision === "EXCLUDED").length, pending: rows.filter(r => r.decision === "PENDING").length, conflicts: proposals.filter(p => p.kind === "CONFLICT").length + pendingConflicts, businessWrites: proposals.reduce((n,p) => n + p.writes,0), writes: eligible ? proposals.reduce((n,p) => n + p.writes,0) + eligible + rows.filter(r => r.decision === "EXCLUDED").length + 2 : 0 };
}
export async function prepare(id: string, db: PrismaClient = prisma, actorValue?: string, request?: ImportAuditRequest) {
    const reference = await importAuditCommand(db, "PREPARE", { id }, null, request, () => transaction(db, async tx => {
        const b = await lockedBatch(tx, id); editable(b);
        const proposals = await planRows(tx, b.rows), summary = planSummary(b.rows, proposals);
        const eligibleKeys = proposals.filter(p => p.kind !== "CONFLICT").map(p => p.sourceKey);
        // Preserve the original protocol's digest before JSONB normalizes key
        // order. This proposal fingerprint is not an authentication credential.
        const token = hash({ id, version: b.version, proposals });
        const receipt = await event(tx, id, "PROPOSED", actorSchema.parse(importActor(actorValue ?? b.actor)), { version: b.version, summary, proposals, eligibleKeys, token });
        return { eventId: receipt.id };
    }));
    const receipt = await db.controlledDocumentImportEvent.findUniqueOrThrow({ where: { id: reference.eventId } });
    return receipt.detail as unknown as { version: number; proposals: Proposal[]; summary: ReturnType<typeof planSummary>; eligibleKeys: string[]; token: string };
}
export async function confirm(id: string, input: { actor: string; version: number; token: string; eligibleKeys: string[]; explicitlyConfirmed: boolean }, db: PrismaClient = prisma, request?: ImportAuditRequest) {
    const actor = actorSchema.parse(importActor(input.actor));
    if (input.explicitlyConfirmed !== true || !Array.isArray(input.eligibleKeys) || !input.eligibleKeys.length) throw new Error("Confirma explícitamente los registros elegibles de la propuesta.");
    let reference: { retried: boolean; eventId: string };
    try {
        reference = await importAuditCommand(db, "CONFIRM", { id, input: { ...input, actor } }, null, request, () => transaction(db, async tx => {
            const b = await lockedBatch(tx, id);
            // A successful request retried with the same proposal returns its receipt without any writes.
            const receipt = await tx.controlledDocumentImportEvent.findFirst({ where: { batchId: id, action: "CONFIRMED", detail: { path: ["token"], equals: input.token } } });
            if (receipt) return { retried: true, eventId: receipt.id };
            editable(b);
            if (b.version !== input.version) throw new Error("El lote ha cambiado. Revisa otra vez la propuesta.");
            const proposals = await planRows(tx, b.rows);
            if (hash({ id, version: b.version, proposals }) !== input.token) throw new Error("La BD ha cambiado desde la propuesta. Revisa de nuevo los registros afectados.");
            const eligible = proposals.filter(p => p.kind !== "CONFLICT");
            if (hash([...input.eligibleKeys].sort()) !== hash(eligible.map(p => p.sourceKey).sort())) throw new Error("La confirmación no coincide con los registros elegibles mostrados.");
            if (!eligible.length) throw new Error("No hay registros elegibles.");
            const result: { sourceKey: string; documentId: string; revisionId: string | null; outcome: string }[] = [];
            for (const p of eligible) {
                const r = b.rows.find(r => r.sourceKey === p.sourceKey)!, source = rowValue(r), v = r.resolution as unknown as Resolution;
                const now = await current(tx, p.baseCode, v.departmentId), d = now.department!;
                validateDepartmentForBaseCode(p.baseCode, d.code);
                const provenance = b.rows.filter(row => row.baseCode === p.baseCode).map(row => { const src = rowValue(row).source; return { sourceKey: row.sourceKey, sheet: src.sheet, row: src.row, originalCode: src.originalCode, decision: row.decision }; });
                const metadata = { indexImport: { batchId: id, sha256: b.sha256, fileName: b.fileName, sheet: source.source.sheet, row: source.source.row, sourceKey: r.sourceKey, originalCode: source.source.originalCode, originalDepartmentCode: source.normalized.departmentCode, originalDepartmentLabel: source.source.sheet, originalDepartmentName: null, declaredState: v.declaredState, originalDeclaredState: source.normalized.declaredState, stateBasis: source.normalized.stateBasis, normalizedOriginal: source.normalized, resolution: v, decidedBy: r.decidedBy, decidedAt: r.decidedAt, provenance, pendingDocumentaryVerification: true } };
                const m = now.document || await tx.controlledDocument.create({ data: { baseCode: p.baseCode, title: v.title, departmentId: d.id, departmentCodeSnapshot: d.code, departmentNameSnapshot: d.name, administrativeStatus: "DRAFT", verificationStatus: "UNVERIFIED", sourceMetadata: json(metadata), createdByText: actor } });
                const oldRevision = now.document?.revisions.find(rev => rev.revisionCode === v.revisionCode);
                let revisionId = oldRevision?.id || null;
                if (!now.document) await tx.controlledDocumentChange.create({ data: { documentId: m.id, action: "Importación de maestro pendiente de verificación", changedByText: actor, reason: v.reason, newValue: json({ batchId: id, baseCode: m.baseCode, sourceMetadata: metadata }), source: "IMPORT" } });
                if (v.revisionCode && !oldRevision) {
                    const revision = await tx.controlledDocumentRevision.create({ data: { documentId: m.id, revisionCode: v.revisionCode, baseCodeSnapshot: p.baseCode, titleSnapshot: v.title, departmentCodeSnapshot: d.code, departmentNameSnapshot: d.name, status: "IMPORTED_PENDING", verificationStatus: "UNVERIFIED", effectiveFrom: date(v.effectiveFrom), reviewDueAt: date(v.reviewDueAt), sourceReference: `${b.fileName} · ${source.source.sheet} · fila ${source.source.row}`, sourceMetadata: json(metadata), registeredByText: actor } });
                    revisionId = revision.id;
                    await tx.controlledDocumentChange.create({ data: { documentId: m.id, revisionId, action: "Importación de revisión pendiente de verificación", changedByText: actor, reason: v.reason, newValue: json({ revisionCode: v.revisionCode, status: "IMPORTED_PENDING", sourceMetadata: metadata }), source: "IMPORT" } });
                }
                const item = { sourceKey: r.sourceKey, documentId: m.id, revisionId, outcome: p.kind === "EXISTING" ? "OMITTED_EXISTING" : "CREATED" };
                result.push(item);
                // Confirmed history retains normalized data/provenance, not raw Excel cells.
                await tx.controlledDocumentImportRow.update({ where: { id: r.id }, data: { result: json(item), data: json({ ...source, source: { ...source.source, values: [] } }) } });
            }
            const summary = planSummary(b.rows, proposals);
            const unresolved = b.rows.some(r => r.decision === "PENDING") || proposals.some(p => p.kind === "CONFLICT");
            await tx.controlledDocumentImportBatch.update({ where: { id }, data: { state: unresolved ? "PARTIAL" : "CONFIRMED", confirmedAt: new Date(), version: { increment: 1 } } });
            // Excluded rows also retain only the minimal history once a confirmation occurs.
            for (const r of b.rows.filter(r => r.decision === "EXCLUDED")) { const src = rowValue(r); await tx.controlledDocumentImportRow.update({ where: { id: r.id }, data: { data: json({ ...src, source: { ...src.source, values: [] } }) } }); }
            const detail = { token: input.token, summary, result, conflicts: proposals.filter(p => p.kind === "CONFLICT") };
            const recorded = await event(tx, id, "CONFIRMED", actor, detail);
            return { retried: false, eventId: recorded.id };
        }));
    } catch (e) {
        // Operational error marker excludes diagnostics and private row contents. No partial business writes survive.
        await db.controlledDocumentImportEvent.create({ data: { batchId: id, action: "ERROR", actor, detail: { category: "CONFIRMATION_REJECTED_OR_ROLLED_BACK" } } }).catch(markerError => { logServerError("controlled-documents.import-marker", markerError, { module: "PNT" }); });
        throw e;
    }
    const receipt = await db.controlledDocumentImportEvent.findUniqueOrThrow({ where: { id: reference.eventId } });
    return { retried: reference.retried, detail: receipt.detail };
}
export function batchReport(b: { reportMetadata: Prisma.JsonValue; rows: ControlledDocumentImportRow[] }): PreviewReport {
    return { ...(b.reportMetadata as unknown as Omit<PreviewReport,"rows">), rows: b.rows.map(rowValue) };
}

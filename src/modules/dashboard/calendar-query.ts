import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAssignedItems, getDatedActionItems, type AssignedItem } from "./assigned-query";
import { sortCalendarItems, type CalendarItem, type CalendarQuery } from "./calendar-domain";
import { utcDay, type DashboardModule } from "./domain";

type Row = { id: string; code: string | null; due: Date; detail?: string | null; scope?: string | null };

/**
 * Calendario (D-120). «Todo»: los plazos del panel (seguimientos, ejecución de cambios, revisiones
 * de auditoría y revisión de PNT vigentes), las auditorías planificadas y las acciones pendientes
 * con fecha de todos los responsables. «Solo lo mío»: exactamente «Mis tareas» con fecha.
 * Mismas reglas de pendiente que el panel y «Mis tareas»; aquí solo cambia el periodo.
 */
export async function getCalendarItems(query: CalendarQuery, range: { from: Date; to: Date }, userId: string | null | undefined, asOf = new Date()) {
  const today = utcDay(asOf);
  const toItem = (input: Omit<CalendarItem, "overdue" | "date"> & { date: Date }): CalendarItem => ({ ...input, date: utcDay(input.date), overdue: utcDay(input.date) < today });
  const fromAssigned = (item: AssignedItem) => toItem({ key: item.key, module: item.module, code: item.code, label: item.label, detail: item.detail, date: item.dueDate!, href: item.href });
  const filters = { department: query.department, module: query.module, asOf };

  if (query.scope === "mine") {
    const assigned = await getAssignedItems(userId, { ...filters, year: null });
    const dated = assigned.filter((item) => item.dueDate);
    return {
      items: sortCalendarItems(dated.filter((item) => item.dueDate! >= range.from && item.dueDate! < range.to).map(fromAssigned)),
      undated: assigned.length - dated.length,
      overdueBefore: dated.filter((item) => item.dueDate! < range.from && item.dueDate! < today).length,
    };
  }

  const wants = (module: DashboardModule) => query.module === "ALL" || query.module === module;
  const between = (column: Prisma.Sql) => Prisma.sql`${column} >= ${range.from} AND ${column} < ${range.to}`;
  const department = (column: Prisma.Sql) => query.department ? Prisma.sql`AND ${column} = ${query.department}` : Prisma.empty;
  const latestFollowup = (table: string, child: string, parent: string, order: string, detail: string, statuses: string[], status: string) => prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT r.id, q."businessCode" AS code, f."nextFollowupDate" AS due, f.detail
    FROM ${Prisma.raw(`"${table}"`)} r JOIN "QmsRecord" q ON q.id = r."qmsRecordId"
    JOIN LATERAL (SELECT f."nextFollowupDate", ${Prisma.raw(detail)} AS detail FROM ${Prisma.raw(`"${child}"`)} f
      WHERE f.${Prisma.raw(`"${parent}"`)} = r.id ORDER BY ${Prisma.raw(order)} LIMIT 1) f ON true
    WHERE q."isActive" = true AND r.${Prisma.raw(`"${status}"`)}::text IN (${Prisma.join(statuses)})
      ${department(Prisma.sql`r."departmentId"`)} AND ${between(Prisma.sql`f."nextFollowupDate"`)}
  `);
  const none = Promise.resolve([] as Row[]);

  const [deviationFollowups, capaFollowups, changeFollowups, complaintFollowups, returnFollowups, changeExecution, auditReviews, auditPlanned, pntReviews, actions] = await Promise.all([
    // Mismas reglas que el panel (DEV-F) y que las fuentes de las alertas (CAPA-F, CC-F, REC-F, RET-F).
    wants("DEVIATION") ? latestFollowup("Deviation", "DeviationFollowup", "deviationId", 'f."followupDate" DESC, f."createdAt" DESC', "f.comment", ["OPEN"], "status") : none,
    wants("CAPA") ? latestFollowup("Capa", "CapaFollowup", "capaId", '"sequenceNumber" DESC', "COALESCE(f.description, f.observations)", ["OPEN", "CLOSED"], "status") : none,
    wants("CHANGE_CONTROL") ? latestFollowup("ChangeControl", "ChangeControlFollowup", "changeControlId", '"sequenceNumber" DESC', 'f."remainOpenReason"', ["OPEN"], "finalStatus") : none,
    wants("COMPLAINT") ? latestFollowup("Complaint", "ComplaintFollowup", "complaintId", '"followupDate" DESC, "createdAt" DESC', "f.comment", ["OPEN"], "status") : none,
    wants("RETURN") ? latestFollowup("ReturnRecord", "ReturnFollowup", "returnRecordId", '"followupDate" DESC, "createdAt" DESC', "f.comment", ["OPEN"], "status") : none,
    wants("CHANGE_CONTROL") ? prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT r.id, q."businessCode" AS code, r."plannedImplementationDate" AS due, r.description AS detail
      FROM "ChangeControl" r JOIN "QmsRecord" q ON q.id = r."qmsRecordId"
      WHERE q."isActive" = true AND r."finalStatus" = 'OPEN' AND r."executionStatus" = 'NOT_EXECUTED'
        ${department(Prisma.sql`r."departmentId"`)} AND ${between(Prisma.sql`r."plannedImplementationDate"`)}
    `) : none,
    wants("AUDIT") ? prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT a.id, q."businessCode" AS code, f."nextReviewDate" AS due, f."findingId" AS scope
      FROM "Audit" a JOIN "QmsRecord" q ON q.id = a."qmsRecordId"
      JOIN LATERAL (
        SELECT DISTINCT ON (f."findingId") f."findingId", f."nextReviewDate"
        FROM "AuditFollowup" f WHERE f."auditId" = a.id
          AND (f."findingId" IS NULL OR EXISTS (SELECT 1 FROM "AuditFinding" n WHERE n.id = f."findingId" AND n."auditId" = a.id AND n."isActive" = true))
        ORDER BY f."findingId", f."followupDate" DESC, f."createdAt" DESC, f.id DESC
      ) f ON true
      WHERE q."isActive" = true AND a.status = 'OPEN'
        ${query.department ? Prisma.sql`AND EXISTS (SELECT 1 FROM "AuditDepartment" d WHERE d."auditId" = a.id AND d."departmentId" = ${query.department} AND d."isActive" = true)` : Prisma.empty}
        AND ${between(Prisma.sql`f."nextReviewDate"`)}
    `) : none,
    wants("AUDIT") ? prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT a.id, q."businessCode" AS code, a."plannedDate" AS due, a.title AS detail
      FROM "Audit" a JOIN "QmsRecord" q ON q.id = a."qmsRecordId"
      WHERE q."isActive" = true AND a.status <> 'CLOSED' AND a."performedDate" IS NULL
        ${query.department ? Prisma.sql`AND EXISTS (SELECT 1 FROM "AuditDepartment" d WHERE d."auditId" = a.id AND d."departmentId" = ${query.department} AND d."isActive" = true)` : Prisma.empty}
        AND ${between(Prisma.sql`a."plannedDate"`)}
    `) : none,
    // Revisión de la vigente más reciente de cada PNT no anulado; el ciclo de vida manda si existe (como el panel).
    wants("PNT") ? prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT id, code, due, detail FROM (
        SELECT DISTINCT ON (m.id) m.id, m."baseCode" AS code, m.title AS detail,
          CASE WHEN l."revisionId" IS NOT NULL THEN l."reviewDueAt" ELSE r."reviewDueAt" END AS due
        FROM "ControlledDocument" m
        JOIN "ControlledDocumentRevision" r ON r."documentId" = m.id AND r.status = 'IN_FORCE'
        LEFT JOIN "ControlledRevisionLifecycle" l ON l."revisionId" = r.id
        WHERE m."administrativeStatus" <> 'ANNULLED' ${department(Prisma.sql`m."departmentId"`)}
        ORDER BY m.id, r."revisionCode" DESC, r.id DESC
      ) vigentes WHERE due IS NOT NULL AND ${between(Prisma.sql`due`)}
    `) : none,
    getDatedActionItems(filters, range),
  ]);

  const code = (value: string | null) => value ?? "Sin código";
  const detail = (value: string | null | undefined, fallback: string) => {
    const text = (value ?? "").replace(/\s+/g, " ").trim();
    return text ? (text.length > 120 ? text.slice(0, 117) + "…" : text) : fallback;
  };
  const followupItems = (rows: Row[], module: DashboardModule, prefix: string, route: string, label: string, tab = "") => rows.map((row) => toItem({
    key: prefix + row.id, module, code: code(row.code), label, detail: detail(row.detail, "Seguimiento programado"), date: row.due, href: `/${route}/${row.id}${tab}`,
  }));
  const items = [
    ...followupItems(deviationFollowups, "DEVIATION", "DEV-F-", "deviations", "Próximo seguimiento"),
    ...followupItems(capaFollowups, "CAPA", "CAPA-F-", "capa", "Seguimiento CAPA", "?tab=followups"),
    ...followupItems(changeFollowups, "CHANGE_CONTROL", "CC-F-", "changes", "Seguimiento de cambio", "?tab=followups"),
    ...followupItems(complaintFollowups, "COMPLAINT", "REC-F-", "complaints", "Seguimiento de reclamación", "?tab=followups"),
    ...followupItems(returnFollowups, "RETURN", "RET-F-", "returns", "Seguimiento de devolución", "?tab=followups"),
    ...changeExecution.map((row) => toItem({ key: "CC-E-" + row.id, module: "CHANGE_CONTROL", code: code(row.code), label: "Ejecución de cambio", detail: detail(row.detail, "Fecha prevista de ejecución"), date: row.due, href: "/changes/" + row.id })),
    ...auditReviews.map((row) => toItem({ key: `AUD-F-${row.id}-${row.scope ?? "GENERAL"}`, module: "AUDIT", code: code(row.code), label: row.scope ? "Seguimiento de hallazgo" : "Revisión de auditoría", detail: "Próxima revisión", date: row.due, href: "/audits/" + row.id })),
    ...auditPlanned.map((row) => toItem({ key: "AUD-P-" + row.id, module: "AUDIT", code: code(row.code), label: "Auditoría planificada", detail: detail(row.detail, "Fecha planificada"), date: row.due, href: "/audits/" + row.id })),
    ...pntReviews.map((row) => toItem({ key: "PNT-R-" + row.id, module: "PNT", code: code(row.code), label: "Revisión documental", detail: detail(row.detail, "Revisión prevista de la vigente"), date: row.due, href: "/controlled-documents/" + row.id })),
    ...actions.map(fromAssigned),
  ];
  return { items: sortCalendarItems(items), undated: 0, overdueBefore: null };
}

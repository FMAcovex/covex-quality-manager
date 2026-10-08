"use client";
import { useMemo, useState, useRef, type FormEvent } from "react";
import { type PreviewReport, issueLabels, declaredStateLabels, reconciliationLabels } from "../preview/types";
import { DocumentLink } from "./document-link";
import { displayDate } from "../domain";
export function IndexPreview() {
    const fileRef = useRef<File | null>(null);
    const [actor, setActor] = useState("");
    async function saveBatch() {
        if (!fileRef.current || !actor.trim()) { setError("Indica el responsable del lote."); return; }
        setPending(true); setError("");
        try { const form = new FormData(); form.set("file", fileRef.current); form.set("actor", actor); form.set("saveBatch", "on");
            const response = await fetch("/api/controlled-documents/index-preview", { method: "POST", body: form }); const value = await response.json();
            if (!response.ok) throw new Error(value.error || "No se pudo guardar el lote.");
            window.location.assign(`/controlled-documents/import-index/${value.batchId}`);
        } catch(e) { setError(e instanceof Error ? e.message : "No se pudo guardar el lote."); setPending(false); }
    }
    const [report, setReport] = useState<PreviewReport | null>(null), [error, setError] = useState(""), [pending, setPending] = useState(false);
    const [query, setQuery] = useState(""), [issue, setIssue] = useState(""), [page, setPage] = useState(1);
    const [kind, setKind] = useState("");
    const filtered = useMemo(() => report?.rows.filter(r => (!query || `${r.source.originalCode} ${r.normalized.baseCode || ""} ${r.normalized.title}`.toUpperCase().includes(query.trim().toUpperCase())) && (!issue || r.issues.includes(issue as keyof typeof issueLabels)) && (!kind || r.reconciliation.kind === kind)) || [], [report, query, issue, kind]);
    const pages = Math.max(1, Math.ceil(filtered.length / 25)), current = Math.min(page, pages), visible = filtered.slice((current - 1) * 25, current * 25);
    async function analyze(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        fileRef.current = form.get("file") as File;
        setError("");
        setPending(true);
        setReport(null);
        try {
            const response = await fetch("/api/controlled-documents/index-preview", { method: "POST", body: form, cache: "no-store" });
            const value = await response.json();
            if (!response.ok || !value.report)
                throw new Error(value.error || "No se ha podido analizar el archivo.");
            setReport(value.report);
            setQuery("");
            setIssue("");
            setKind("");
            setPage(1);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "No se ha podido analizar el archivo.");
        }
        finally {
            setPending(false);
        }
    }
    return <div>
 <DocumentLink href="/controlled-documents/import-index/batches">Recuperar lote / resultados</DocumentLink>
 <p>Previsualización de solo lectura. El índice declara datos; no acredita la verificación del Word/PDF firmado. Ningún PNT, revisión o departamento se crea ni modifica.</p>
 <p>Fuente GC-00: se utiliza exclusivamente <strong>GC-00(</strong>, con departamento GC-00. La hoja <strong>GC-00 queda descartada</strong> del análisis, estadísticas y conciliación.</p>
 <form onSubmit={analyze} className="inline-form"><label>Excel del índice maestro<input name="file" type="file" accept=".xlsx" required disabled={pending}/></label><button disabled={pending}>{pending ? "Analizando…" : "Analizar Excel"}</button></form>
 <p>Hasta 8 MiB. El archivo no se guarda permanentemente. La previsualización permanece en esta página hasta recargarla o analizar otro archivo.</p>
 {error && <p role="alert">{error}</p>}
 {report && <>
 <div className="inline-form"><label>Responsable del lote<input value={actor} maxLength={200} onChange={e => setActor(e.target.value)}/></label><button disabled={pending} onClick={saveBatch}>Guardar previsualización como lote pendiente</button></div><p>El staging dura 30 días y no conserva el binario XLSX. Las decisiones y resultados confirmados conservan su historial mínimo.</p>
 <h2>Resumen</h2><p>{report.fileName} · {report.interpretedSheets.length} hojas interpretadas de {report.sheetCount}</p><p>SHA-256: <code>{report.sha256}</code> · Referencia temporal: {displayDate(report.asOf)}</p>
 <dl>{([
                ["Filas analizadas", report.summary.analyzedRows], ["PNT candidatos (formato y clasificación)", report.summary.pntCandidates], ["Códigos únicos", report.summary.uniqueCodes], ["Grupos duplicados", report.summary.duplicateGroups], ["Apariciones adicionales", report.summary.additionalAppearances], ["Grupos con discrepancias", report.summary.discrepancyGroups], ["Grupos con revisiones distintas", report.summary.revisionDiscrepancyGroups], ["Otros documentos", report.summary.otherDocuments], ["Datos incompletos del índice", report.summary.incompleteRows], ["Correspondencia departamental a revisar", report.summary.departmentReviewRows], ["Anulados según índice", report.summary.annulledRows], ["En elaboración", report.summary.inPreparationRows], ["Revisión prevista vencida", report.summary.overdueRows], ["Pendientes de verificación documental", report.summary.pendingVerification], ["Documentos nuevos", report.summary.newDocuments], ["Maestros existentes / revisión no registrada", report.summary.existingDocuments], ["Revisiones ya existentes", report.summary.existingRevisions], ["Conflictos con datos persistidos", report.summary.persistedConflicts], ["No importables sin resolver incidencias", report.summary.notImportable]
            ] as [
                string,
                number
            ][]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
 <details><summary>Hojas y exclusiones</summary><p>Interpretadas: {report.interpretedSheets.join(", ")}</p><ul>{report.excludedSheets.map(s => <li key={s.name}>{s.name}: {s.reason}</li>)}</ul></details>
 <h2>Examinar filas</h2><div className="inline-form">
 <label>Buscar código o título<input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/></label>
 <label>Incidencia<select value={issue} onChange={e => { setIssue(e.target.value); setPage(1); }}><option value="">Todas</option>{Object.entries(issueLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
 <label>Conciliación<select value={kind} onChange={e => { setKind(e.target.value); setPage(1); }}><option value="">Todas</option>{Object.entries(reconciliationLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label></div>
 <p>{filtered.length} filas para estos filtros. Ninguna revisión se selecciona automáticamente como vigente.</p>
 <div className="table-wrap"><table className="data-table"><thead><tr><th>Código</th><th>Título</th><th>Revisión</th><th>Vigencia</th><th>Revisión prevista</th><th>Estado declarado</th><th>Departamento</th><th>Procedencia</th><th>Resultado</th></tr></thead><tbody>{visible.map(row => <tr key={row.sourceKey}>
 <td>{row.normalized.baseCode || row.source.originalCode || "Sin código"}</td><td>{row.normalized.title || "—"}</td><td>{row.normalized.revisionCode || "Sin determinar"}</td><td>{displayDate(row.normalized.effectiveFrom)}</td><td>{displayDate(row.normalized.reviewDueAt)}</td><td>{declaredStateLabels[row.normalized.declaredState]}{row.normalized.reviewOverdue && <p>Revisión prevista vencida</p>}</td><td>{row.normalized.departmentCode || "Revisión manual"}</td><td>{row.source.sheet} · fila {row.source.row}</td>
 <td><p>{row.classification === "PNT" ? "PNT candidato" : `Otra familia: ${row.family}`}</p><p>{reconciliationLabels[row.reconciliation.kind]}</p>{row.reconciliation.documentId && <DocumentLink href={`/controlled-documents/${row.reconciliation.documentId}`}>Consultar registro existente</DocumentLink>}{row.classification === "PNT" && <p>Pendiente de verificación documental</p>}<ul>{row.issues.map(i => <li key={i}>{issueLabels[i]}</li>)}</ul>
 <details><summary>Valores originales y decisión</summary><p>{row.source.fileName} · {row.source.sha256}</p><p>Código original: {row.source.originalCode || "—"}</p><ul>{row.source.values.map(c => <li key={c.reference}>{c.reference}: {c.value || "—"}{c.formula !== null ? " (fórmula; valor almacenado)" : ""}</li>)}</ul><p>Decisión: {row.decision === "PENDING" ? "Pendiente de conciliación y confirmación explícita" : "Excluido de candidatos PNT"}.</p><p>Verificación del índice: sin verificar documentalmente.</p>{row.reconciliation.differences?.length && <ul>{row.reconciliation.differences.map((d, i) => <li key={i}>{d.field}: índice «{d.indexed || "sin dato"}» / persistido «{d.persisted || "sin dato"}»</li>)}</ul>}{row.reconciliation.consolidated && <p>Revisión consolidada en base de datos; se conserva sin cambios.</p>}</details></td>
 </tr>)}</tbody></table></div>
 <nav aria-label="Paginación de filas"><button disabled={current <= 1} onClick={() => setPage(current - 1)}>Anterior</button> <span>Página {current} de {pages}</span> <button disabled={current >= pages} onClick={() => setPage(current + 1)}>Siguiente</button></nav>
 <details><summary>Grupos de duplicados y discrepancias ({report.groups.length})</summary>{report.groups.map(g => <article key={g.baseCode}><h3>{g.baseCode}</h3><p>{g.kinds.map(k => issueLabels[k]).join(" · ")}</p><ul>{g.rowKeys.map(key => { const r = report.rows.find(x => x.sourceKey === key)!; return <li key={key}>{r.source.sheet}, fila {r.source.row}: revisión {r.normalized.revisionCode || "sin determinar"}; {r.normalized.title}; vigencia {displayDate(r.normalized.effectiveFrom)}; revisión prevista {displayDate(r.normalized.reviewDueAt)}</li>; })}</ul></article>)}</details>
 </>}
 </div>;
}

import { validDate } from "../domain";
export const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().replace(/\s+/g, " ").trim();
export function departmentFromSheet(name: string) {
    const s = name.trim().toUpperCase();
    if (s === "GC-00(")
        return "GC-00";
    return s.match(/^([A-Z]{2}-\d{2})(?:_\d+)?$/)?.[1] || null;
}
export function normalizeCode(value: string) { const v = value.trim().toUpperCase().replace(/[–—]/g, "-").replace(/\s+/g, ""); const m = v.match(/^([A-Z]{2}-\d{2})[/.](\d{3})(?:[/.](\d{1,2}))?$/); return m ? { baseCode: `${m[1]}/${m[2]}`, embeddedRevision: m[3]?.padStart(2, "0") || null } : null; }
export function normalizeRevision(value: string) {
    const v = value.trim();
    if (/^\d{1,2}(?:\.0+)?$/.test(v))
        return String(Number(v)).padStart(2, "0");
    return null;
}
export function marker(value: string) {
    const v = fold(value);
    if (/\bANULAD[OA]S?\b/.test(v))
        return "ANNULLED" as const;
    if (/\bEN ELABORACION\b/.test(v))
        return "IN_PREPARATION" as const;
    if (/^VIGENTE$/.test(v))
        return "IN_FORCE" as const;
    return null;
}
export function normalizeDate(value: string, type: string, date1904: boolean): {
    value: string | null;
    invalid: boolean;
} {
    const raw = value.trim();
    if (!raw || /^(N\/?A|NO APLICA|SIN FECHA|-)$/i.test(raw) || marker(raw))
        return { value: null, invalid: false };
    let date: string | null = null;
    if (type === "n" && /^\d+(?:\.\d+)?$/.test(raw)) {
        const serial = Math.floor(Number(raw));
        if (serial <= 2958465 && serial >= (date1904 ? 0 : 1) && !(serial === 60 && !date1904)) {
            const epoch = Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 31);
            date = new Date(epoch + (serial - (date1904 || serial < 60 ? 0 : 1)) * 86400000).toISOString().slice(0, 10);
        }
    }
    else {
        const iso = raw.match(/^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?$/);
        const european = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
        if (iso)
            date = iso[1];
        else if (european)
            date = `${european[3]}-${european[2].padStart(2, "0")}-${european[1].padStart(2, "0")}`;
    }
    return { value: date && validDate(date) ? date : null, invalid: !date || !validDate(date) };
}
export function family(code: string, title: string) {
    const v = fold(code);
    for (const f of ["PAM", "PAF", "PV", "IV", "PL", "PF", "VO", "DC", "PE", "PAN"])
        if (new RegExp(`^${f}(?:[^A-Z]|$)`).test(v))
            return f;
    if (/^PLAN(?:ES)? MAESTR/.test(fold(title)) || /^PM(?:[^A-Z]|$)/.test(v))
        return "PLAN_MAESTRO";
    return "OTHER";
}

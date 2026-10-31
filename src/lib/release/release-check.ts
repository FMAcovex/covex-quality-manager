/**
 * D-131: reglas de una versión de la aplicación. Puras, para que las prueben los tests y las use
 * `pnpm release:check` antes de entregar una versión a IT.
 *
 * Número `MAYOR.MENOR.CORRECCIÓN`:
 * - CORRECCIÓN: arreglos sin cambios en la base de datos;
 * - MENOR: novedades, o cualquier cambio en la base de datos (migraciones);
 * - MAYOR: cambios que obligan a reorganizar el trabajo o los datos (por ejemplo, la puesta en marcha 1.0.0).
 */
export type Version = readonly [number, number, number];

export type ReleaseNote = {
  version: string;
  /** Fecha de preparación (AAAA-MM-DD). */
  date: string;
  /** Una o dos frases para los usuarios. */
  summary: string;
  changes: readonly string[];
  fixes: readonly string[];
  /** Lo que tienen que hacer Calidad o IT con esta versión (permisos, plantillas…). Vacío si nada. */
  actions: readonly string[];
  /** La versión cambia la base de datos (migraciones): IT hace copia previa y aplica las migraciones. */
  database: boolean;
};

export function parseVersion(value: string): Version | null {
  const match = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function compareVersions(a: Version, b: Version) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** Problemas de las notas de versión en conjunto: versiones válidas, sin repetir, de la más reciente a la más antigua. */
export function releaseNotesProblems(notes: readonly ReleaseNote[]): string[] {
  const problems: string[] = [];
  let previous: Version | null = null;
  for (const note of notes) {
    const version = parseVersion(note.version);
    if (!version) { problems.push(`Notas: «${note.version}» no es un número de versión MAYOR.MENOR.CORRECCIÓN.`); continue; }
    if (previous && compareVersions(version, previous) >= 0) problems.push(`Notas: la ${note.version} debe ir después de una versión mayor (de la más reciente a la más antigua, sin repetir).`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(note.date)) problems.push(`Notas ${note.version}: la fecha debe ser AAAA-MM-DD.`);
    if (!note.summary.trim()) problems.push(`Notas ${note.version}: falta el resumen.`);
    if (!note.changes.length && !note.fixes.length) problems.push(`Notas ${note.version}: no hay novedades ni correcciones.`);
    previous = version;
  }
  return problems;
}

export type ReleaseCheckInput = {
  /** Versión de package.json. */
  version: string;
  /** Versión de la entrega anterior (su package.json), si se conoce. */
  previousVersion: string | null;
  notes: readonly ReleaseNote[];
  /** Migraciones añadidas desde la entrega anterior; null si no se conoce la anterior. */
  newMigrations: readonly string[] | null;
};

/** Problemas que impiden entregar la versión. Lista vacía = se puede entregar. */
export function releaseProblems({ version, previousVersion, notes, newMigrations }: ReleaseCheckInput): string[] {
  const problems = releaseNotesProblems(notes);
  const current = parseVersion(version);
  if (!current) return [...problems, `package.json: «${version}» no es un número de versión MAYOR.MENOR.CORRECCIÓN.`];
  const note = notes.find((item) => item.version === version);
  if (!note) problems.push(`Faltan las notas de la versión ${version} (src/lib/release/release-notes.ts).`);
  else if (notes[0] !== note) problems.push(`Las notas de la versión ${version} deben ser las primeras de la lista.`);
  const previous = previousVersion === null ? null : parseVersion(previousVersion);
  if (previousVersion !== null && !previous) problems.push(`La entrega anterior tiene un número de versión no válido («${previousVersion}»).`);
  if (previous && compareVersions(current, previous) <= 0) problems.push(`La versión ${version} debe ser mayor que la de la entrega anterior (${previousVersion}).`);
  if (note && newMigrations) {
    if (newMigrations.length && !note.database) problems.push(`Hay ${newMigrations.length} migración(es) nueva(s), pero las notas de la ${version} no indican cambios en la base de datos.`);
    if (!newMigrations.length && note.database) problems.push(`Las notas de la ${version} indican cambios en la base de datos, pero no hay migraciones nuevas.`);
  }
  if (previous && newMigrations?.length && current[0] === previous[0] && current[1] === previous[1]) problems.push(`Con cambios en la base de datos la versión sube al menos el número MENOR (${previous[0]}.${previous[1] + 1}.0), no solo la corrección.`);
  return problems;
}

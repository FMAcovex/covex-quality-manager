import { readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { installSafeLogging } from './logging.mjs';

export function productionEnvironment(env = process.env) {
  const result = { ...env };
  for (const key of ['DATABASE_URL', 'AUTH_ENTRA_CLIENT_SECRET']) {
    if (result[key] && result[key + '_FILE']) throw new Error('Ambiguous secret source.');
    if (result[key + '_FILE']) {
      const file = result[key + '_FILE'];
      const stat = statSync(file);
      if (!stat.isFile() || (stat.mode & 0o077)) throw new Error('Secret permissions must be private.');
      result[key] = readFileSync(file, 'utf8').trim();
      delete result[key + '_FILE'];
    }
  }
  if (result.NODE_ENV !== 'production' || result.APP_ENV !== 'production' || result.ALLOW_DEMO_DATA !== 'false' || result.AUTH_PROVIDER !== 'entra' || result.AUTH_SYNTHETIC_IDENTITY !== '0' || result.AUTH_TEST_ISSUER || result.PNT_DOCUMENT_ACCESS_MODE === 'demo' || result.DEBUG) throw new Error('Production configuration refused.');
  const origin = new URL(result.AUTH_ORIGIN);
  const db = new URL(result.DATABASE_URL);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password || /\.invalid$/.test(origin.hostname)) throw new Error('Approved HTTPS origin required.');
  if (!uuid.test(result.AUTH_ENTRA_TENANT_ID ?? '') || !uuid.test(result.AUTH_ENTRA_CLIENT_ID ?? '') || (result.AUTH_ENTRA_CLIENT_SECRET ?? '').length < 16) throw new Error('Corporate identity configuration incomplete.');
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || !db.hostname || !db.pathname.slice(1) || !db.username || ['postgres', 'covex_migrator', 'covex_recovery'].includes(decodeURIComponent(db.username)) || db.pathname.includes('test_')) throw new Error('Application database configuration refused.');
  // Prisma uses sslcert/sslaccept (libpq backup tools use verify-full/sslrootcert).
  if (db.searchParams.get('sslmode') !== 'require' || db.searchParams.get('sslaccept') !== 'strict' || !db.searchParams.get('sslcert')) throw new Error('Strict database TLS required.');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const env = productionEnvironment();
    for (const [key, value] of Object.entries(env)) if (value !== undefined) process.env[key] = value;
    delete process.env.DATABASE_URL_FILE;
    delete process.env.AUTH_ENTRA_CLIENT_SECRET_FILE;
    installSafeLogging();
    const fatal = () => { process.stderr.write('{"service":"covex-quality-manager","event":"fatal-server-error"}\n'); process.exit(1); };
    process.on('uncaughtException', fatal);
    process.on('unhandledRejection', fatal);
    await import(pathToFileURL(process.cwd() + '/server.js').href);
  } catch {
    console.error('COVEX startup refused; review approved configuration privately.');
    process.exitCode = 1;
  }
}

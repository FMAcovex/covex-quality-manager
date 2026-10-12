import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { productionEnvironment } from './start.mjs';
import { installSafeLogging } from './logging.mjs';

const valid = { NODE_ENV: 'production', APP_ENV: 'production', ALLOW_DEMO_DATA: 'false', AUTH_PROVIDER: 'entra', AUTH_SYNTHETIC_IDENTITY: '0', AUTH_ORIGIN: 'https://example.org', AUTH_ENTRA_TENANT_ID: '11111111-1111-4111-8111-111111111111', AUTH_ENTRA_CLIENT_ID: '22222222-2222-4222-8222-222222222222', AUTH_ENTRA_CLIENT_SECRET: 'synthetic-unit-test-only-secret', DATABASE_URL: 'postgresql://covex_app:synthetic@database.example.invalid/covex_quality?sslmode=require&sslaccept=strict&sslcert=/synthetic-ca.pem' };
test('approved production configuration is accepted without contacting external services', () => assert.equal(productionEnvironment(valid).AUTH_ORIGIN, valid.AUTH_ORIGIN));
for (const mutation of [{ APP_ENV: 'development' }, { ALLOW_DEMO_DATA: 'true' }, { AUTH_PROVIDER: 'synthetic' }, { AUTH_SYNTHETIC_IDENTITY: '1' }, { AUTH_TEST_ISSUER: 'http://localhost:5459' }, { AUTH_ORIGIN: 'http://example.org' }, { AUTH_ORIGIN: 'https://example.invalid' }, { AUTH_ENTRA_CLIENT_SECRET: '' }, { DATABASE_URL: 'postgresql://postgres:synthetic@localhost/covex_quality' }, { DATABASE_URL: 'postgresql://covex_migrator:synthetic@localhost/covex_quality' }]) {
  test('rejects unsafe startup: ' + Object.keys(mutation)[0] + '=' + (mutation.DATABASE_URL ? 'privileged role' : Object.values(mutation)[0]), () => assert.throws(() => productionEnvironment({ ...valid, ...mutation })));
}
test('loads private file secrets and refuses permissive or ambiguous secrets', () => {
  const root = mkdtempSync(join(tmpdir(), 'covex-secret-test-'));
  const file = join(root, 'secret');
  try {
    writeFileSync(file, valid.AUTH_ENTRA_CLIENT_SECRET, { mode: 0o600 });
    const { AUTH_ENTRA_CLIENT_SECRET: _secret, ...env } = valid;
    assert.equal(productionEnvironment({ ...env, AUTH_ENTRA_CLIENT_SECRET_FILE: file }).AUTH_ENTRA_CLIENT_SECRET, valid.AUTH_ENTRA_CLIENT_SECRET);
    assert.throws(() => productionEnvironment({ ...valid, AUTH_ENTRA_CLIENT_SECRET_FILE: file }));
    chmodSync(file, 0o644);
    assert.throws(() => productionEnvironment({ ...env, AUTH_ENTRA_CLIENT_SECRET_FILE: file }));
  } finally { rmSync(root, { recursive: true }); }
});
test('production console discards SQL, record content, cookies and secrets', () => {
  const events = [];
  const fake = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir'].map(k => [k, () => {}]));
  const restore = installSafeLogging(fake, event => events.push(event));
  for (const level of Object.keys(fake)) fake[level]('DO-NOT-LOG synthetic password, token, cookie and record content', new Error('sensitive SQL'));
  restore();
  assert.equal(events.length, 7);
  for (const event of events) { assert(!event.includes('DO-NOT-LOG')); assert(!event.includes('sensitive SQL')); assert.equal(JSON.parse(event).event, 'server-message'); }
});

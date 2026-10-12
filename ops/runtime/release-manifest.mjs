import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const sha = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('Exact release SHA required.');
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const migrations = readdirSync('prisma/migrations').filter(n => /^\d/.test(n)).sort().map(name => ({ name, sha256: hash(`prisma/migrations/${name}/migration.sql`) }));
writeFileSync('release-manifest.json', JSON.stringify({ format: 1, commit: sha, version: pkg.version, node: process.version, lockSha256: hash('pnpm-lock.yaml'), migrations }, null, 2) + '\n');

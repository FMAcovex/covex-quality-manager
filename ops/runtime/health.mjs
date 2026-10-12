// Only a generic result leaves this probe; never print response bodies or URLs.
try {
  const response = await fetch(process.argv[2] ?? 'http://127.0.0.1:3000/api/health', { signal: AbortSignal.timeout(4000), redirect: 'error' });
  const body = await response.json();
  if (!response.ok || body.status !== 'ok' || body.database !== 'ok' || body.service !== 'covex-quality-manager') throw new Error();
  console.log('COVEX health OK');
} catch {
  console.error('COVEX health failed');
  process.exitCode = 1;
}

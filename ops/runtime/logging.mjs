// Production console arguments may contain Prisma queries, forms or tokens.
// Emit only fixed technical metadata; private investigation uses approved tooling.
export function installSafeLogging(consoleObject = console, emit = line => process.stdout.write(line + '\n')) {
  const methods = ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir'];
  const originals = new Map(methods.map(level => [level, consoleObject[level]]));
  for (const level of methods) consoleObject[level] = () => emit(JSON.stringify({ service: 'covex-quality-manager', event: 'server-message', level, at: new Date().toISOString() }));
  return () => { for (const [level, original] of originals) consoleObject[level] = original; };
}

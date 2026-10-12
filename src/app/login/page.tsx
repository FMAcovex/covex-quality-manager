export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <section className="panel"><h1>Acceso a COVEX</h1><p>Inicia sesión con tu cuenta corporativa autorizada.</p>{error && <p role="alert">No se ha podido autorizar el acceso. Contacta con el administrador.</p>}<a className="button" href="/auth/login">Iniciar sesión con Microsoft</a></section>;
}

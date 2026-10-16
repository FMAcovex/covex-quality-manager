import { listDemoUsers } from "@/lib/auth/demo";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const demoUsers = await listDemoUsers();
  if (demoUsers.length) return <section className="panel"><h1>Demo local de COVEX</h1><p>Entorno de demostración con datos ficticios. Elige un perfil para entrar; no es un sistema validado ni contiene datos reales.</p>{error && <p role="alert">No se ha podido abrir la sesión de demostración.</p>}<div className="demo-profiles">{demoUsers.map(user => <form key={user.id} method="post" action="/auth/demo" className="demo-profile"><input type="hidden" name="userId" value={user.id} /><button className="button primary" type="submit">{user.name.replace("Demo · ", "")}</button><span>{user.description}</span></form>)}</div></section>;
  return <section className="panel"><h1>Acceso a COVEX</h1><p>Inicia sesión con tu cuenta corporativa autorizada.</p>{error && <p role="alert">No se ha podido autorizar el acceso. Contacta con el administrador.</p>}<a className="button" href="/auth/login">Iniciar sesión con Microsoft</a></section>;
}

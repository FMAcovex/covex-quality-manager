import Link from "next/link";

const items=[
  ["/settings","Resumen"],
  ["/settings/catalogs","Catálogos"],
  ["/settings/versions","Versiones y plantillas"],
  ["/settings/parameters","Parámetros"],
  ["/settings/alerts","Vencimientos"],
  ["/settings/history","Historial"],
] as const;

export function SettingsNav({active}:{active:string}){
  return <nav className="record-tabs settings-nav" aria-label="Administración">
    {items.map(([href,label])=><Link key={href} className={active===href?"active":""} href={href}>{label}</Link>)}
  </nav>;
}

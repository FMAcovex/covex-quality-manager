import { canPreview, previewHref } from "@/lib/qms/file-preview";

/** «Ver» (D-121): abre un PDF o una imagen en una pestaña nueva, sin descargarlo. Va junto a la descarga y con su mismo permiso. */
export function PreviewLink({ href, mimeType, className = "button small", label = "Ver" }: { href: string; mimeType: string | null | undefined; className?: string; label?: string }) {
  if (!canPreview(mimeType)) return null;
  return <a className={className} href={previewHref(href)} target="_blank" rel="noopener noreferrer" aria-label={`${label} (se abre en una pestaña nueva)`}>{label}</a>;
}

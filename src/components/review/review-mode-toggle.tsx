import Link from "next/link";

export function ReviewModeToggle({ active, href }: { active: boolean; href: string }) {
  return (
    <Link
      className={`button review-mode-toggle${active ? " active" : ""}`}
      href={href}
      aria-pressed={active}
    >
      {active ? "Salir de Modo revisión" : "Modo revisión"}
    </Link>
  );
}

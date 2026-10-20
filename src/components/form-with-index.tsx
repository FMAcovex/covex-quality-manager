import type { ReactNode } from "react";
import { SectionIndex } from "./section-index";

/** Formulario (o ficha) con índice lateral de apartados a partir de 1200 px (D-111, V2). */
export function FormWithIndex({ id, label, children }: { id: string; label?: string; children: ReactNode }) {
  return <div className="form-with-index">
    <SectionIndex targetId={id} label={label} />
    <div id={id} className="form-with-index-body">{children}</div>
  </div>;
}

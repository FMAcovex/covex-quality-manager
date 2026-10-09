import type { ReactNode } from "react";
import "./pnt.css";

export default function ControlledDocumentsLayout({ children }: { children: ReactNode }) {
  return <div className="pnt-module">{children}</div>;
}

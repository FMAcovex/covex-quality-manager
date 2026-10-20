"use client";
import { useEffect } from "react";

/** Baja a un apartado al cargar si la dirección no trae ya otra ancla (enlaces antiguos a pestañas de Desviaciones). */
export function ScrollToAnchor({ id }: { id: string }) {
  useEffect(() => {
    if (!window.location.hash) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [id]);
  return null;
}

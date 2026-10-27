import type { ControlledDocumentRevisionStatus } from "@prisma/client";

/**
 * D-118: responsables de las funciones de cada revisión de PNT (GC-00/001/03: elabora, revisa,
 * aprueba) y responsable de la revisión periódica del maestro. Texto libre + usuario opcional,
 * como D-101. Sirven para repartir el trabajo y para «Mis tareas»; no sustituyen al registro de
 * las funciones externas ni a la firma.
 */
export const revisionFunctions = [
  { key: "preparation", label: "Elabora", task: "Elaborar", status: "DRAFT" },
  { key: "review", label: "Revisa", task: "Revisar", status: "IN_REVIEW" },
  { key: "approval", label: "Aprueba", task: "Aprobar", status: "PENDING_APPROVAL" },
] as const satisfies readonly { key: string; label: string; task: string; status: ControlledDocumentRevisionStatus }[];
export type RevisionFunctionKey = (typeof revisionFunctions)[number]["key"];

/** Fases en las que se pueden asignar o cambiar los responsables de una revisión. */
export const assignableRevisionStatuses: readonly ControlledDocumentRevisionStatus[] = revisionFunctions.map(f => f.status);
export const canAssignRevision = (status: ControlledDocumentRevisionStatus) => assignableRevisionStatuses.includes(status);

/** Función que tiene trabajo pendiente en la fase actual de la revisión (o ninguna). */
export const currentRevisionFunction = (status: ControlledDocumentRevisionStatus) => revisionFunctions.find(f => f.status === status) ?? null;

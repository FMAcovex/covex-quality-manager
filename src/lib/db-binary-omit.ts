import type { Prisma } from "@prisma/client";

/**
 * BE1-A (D-112): los bytes de fichero no se leen salvo que una consulta los pida. Quien los necesita usa
 * `omit: withBytes` o un `select` con `fileData: true`. El inventario de consumidores está en el test.
 */
export const binaryOmit = {
  templateVersion: { fileData: true },
  recordVersionDocument: { fileData: true },
  generatedDocument: { fileData: true },
  controlledRevisionDocument: { fileData: true },
  auditAnnualProgrammeVersion: { fileData: true },
  auditCapaPlanVersion: { fileData: true },
  auditTrailExport: { fileData: true },
} as const satisfies Prisma.GlobalOmitConfig;

/** Pide los bytes en una consulta sin `select` (`omit: withBytes`). */
export const withBytes = { fileData: false } as const;

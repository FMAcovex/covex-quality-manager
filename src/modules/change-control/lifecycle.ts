/** Estado final que fija un seguimiento de Control de Cambios (alta o corrección del último). */
export function followupFinalStatus(closeChange: boolean) {
  return closeChange ? "CLOSED" as const : "OPEN" as const;
}

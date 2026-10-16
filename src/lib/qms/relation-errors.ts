// Separado de relation-rules para que los contratos de módulo puedan lanzar
// el error sin crear un ciclo de importación con el registro.
export class QmsRelationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QmsRelationValidationError";
  }
}

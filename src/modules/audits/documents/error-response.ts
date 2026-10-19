import { documentUnavailableResponse, templateUnavailableResponse } from "@/lib/http/template-error-response";
import { TemplateAssetError } from "@/modules/configuration/template-assets";

/**
 * Respuesta legible de la descarga de documentos de auditoría (R5A). El audit trail (B2) envuelve los
 * errores de la operación; se muestra el motivo original si es de plantilla o de negocio (Error simple),
 * nunca el de un fallo técnico interno.
 */
export function auditDocumentErrorResponse(error: unknown): Response {
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : null;
  if (error instanceof TemplateAssetError) return templateUnavailableResponse(error.message);
  if (cause instanceof TemplateAssetError) return templateUnavailableResponse(cause.message);
  if (cause && cause.constructor === Error) return documentUnavailableResponse(cause.message);
  return documentUnavailableResponse(error instanceof Error ? error.message : "Documento no disponible.");
}

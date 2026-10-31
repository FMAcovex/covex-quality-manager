import { AccessError } from "@/lib/auth/context";
import { authorizedRoute } from "@/lib/auth/route-guard";
import { documentUnavailableResponse, templateUnavailableResponse } from "@/lib/http/template-error-response";
import { logServerError } from "@/lib/log/server-log";
import { TemplateAssetError } from "@/modules/configuration/template-assets";
import { generateTemplateTrial } from "@/modules/configuration/template-trial";
import { TemplateTrialError } from "@/modules/configuration/template-trial-rules";

export const runtime = "nodejs";

/**
 * D-129: «Probar con un expediente». Genera el anexo con esta versión de la plantilla (activa o no) y un
 * expediente real, sin guardar nada en el expediente. `ref` es el código del expediente o el año del listado.
 */
async function GETAuthenticatedContent(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const file = await generateTemplateTrial(id, new URL(request.url).searchParams.get("ref"));
    return new Response(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof TemplateTrialError) return documentUnavailableResponse(error.message, error.status);
    if (error instanceof TemplateAssetError) return templateUnavailableResponse(error.message);
    if (error instanceof AccessError) return documentUnavailableResponse(`${error.message} La prueba exige los mismos permisos que descargar ese documento desde el expediente.`, error.status);
    // Un fallo del generador con esta plantilla es justo lo que la prueba debe enseñar, sin detalles internos.
    const ref = logServerError("configuration.template-trial", error, { module: "SYSTEM" });
    return documentUnavailableResponse(`La aplicación no ha podido rellenar esta versión de la plantilla. No la actives: avisa a quien mantiene la aplicación con la versión y esta referencia: ${ref}.`, 422);
  }
}

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/settings/templates/[id]/trial/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}

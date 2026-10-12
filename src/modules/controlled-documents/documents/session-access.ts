import { currentIdentity, identityContext } from "@/lib/auth/context";
import { resourceScope } from "@/lib/auth/resources";
import { requireUser } from "@/lib/auth/session";
import { documentPrincipal } from "./access";
import { lifecyclePrincipal } from "../lifecycle/access";
import { authConfiguration } from "@/lib/auth/config";
export function expectedDocumentOrigin(request: Request) {
  if (currentIdentity()?.unitTest && process.env.VITEST === "true" && process.env.APP_ENV === "test") return process.env.PNT_DOCUMENT_ALLOWED_ORIGIN || new URL(request.url).origin;
  return authConfiguration().origin;
}
export async function sessionDocumentPrincipal(documentId: string, headers: Pick<Headers, "get">) {
  if (currentIdentity()?.unitTest && process.env.VITEST === "true" && process.env.APP_ENV === "test") return documentPrincipal(headers);
  const principal = await requireUser(), resource = await resourceScope("PNT", documentId);
  return identityContext.run({ principal, resource, module: "PNT" }, () => documentPrincipal(headers));
}
export async function sessionLifecyclePrincipal(documentId: string, headers: Pick<Headers, "get">) {
  if (currentIdentity()?.unitTest && process.env.VITEST === "true" && process.env.APP_ENV === "test") return lifecyclePrincipal(headers);
  const principal = await requireUser(), resource = await resourceScope("PNT", documentId);
  return identityContext.run({ principal, resource, module: "PNT" }, () => lifecyclePrincipal(headers));
}

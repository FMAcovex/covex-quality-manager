import { redirect } from "next/navigation";
import { AccessError, currentIdentity, identityContext, type AccessModule } from "./context";
import { assertPermission } from "./policy";
import { requireUser } from "./session";

export async function authorizedPage<T>(file: string, run: () => T | Promise<T>): Promise<T> {
  try {
    const user = await requireUser();
    const accessModule = file.includes("/settings/") ? "SYSTEM" : "DEVIATION";
    assertPermission(user, accessModule as AccessModule, "READ");
    const context = currentIdentity();
    return await identityContext.run({ principal: user, ...(context?.unitTest ? { unitTest: true } : {}), ...(context?.testHarness ? { testHarness: true } : {}) }, run);
  } catch (error) {
    if (error instanceof AccessError) redirect(error.status === 401 ? "/login" : "/login?error=access");
    throw error;
  }
}

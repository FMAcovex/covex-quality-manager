import { expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { auditPolicyState } from "./activation";

it("refuses missing required-policy metadata after its migration was installed", async () => {
  const query = vi.fn().mockResolvedValueOnce([{ installed: false }]).mockResolvedValueOnce([{ present: true }]).mockResolvedValueOnce([{ installed: true }]);
  await expect(auditPolicyState({ $queryRaw: query } as unknown as Prisma.TransactionClient)).rejects.toMatchObject({ code: "PROTECTION" });
});
it("keeps an actual legacy schema unrequired and never infers corporate activation from installation", async () => {
  const legacy = vi.fn().mockResolvedValueOnce([{ installed: false }]).mockResolvedValueOnce([{ present: false }]);
  expect(await auditPolicyState({ $queryRaw: legacy } as unknown as Prisma.TransactionClient)).toMatchObject({ installed: false, required: false, activated: false, corporateUseAuthorized: false });
  const installed = vi.fn().mockResolvedValueOnce([{ installed: true }]).mockResolvedValueOnce([{ required: true }]);
  expect(await auditPolicyState({ $queryRaw: installed } as unknown as Prisma.TransactionClient)).toMatchObject({ installed: true, required: true, prepared: false, activated: false, corporateUseAuthorized: false });
});

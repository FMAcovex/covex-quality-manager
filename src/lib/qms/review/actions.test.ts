import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { createReviewThreadAction, replyToReviewThreadAction, acceptReviewThreadAction, resolveReviewThreadAction } from "./actions";
import { createValidatedReviewThread } from "./mutation-service";
import { getReviewThreadsForDisplay } from "./ui-queries";
import { ReviewThreadError } from "./service";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { qmsRecord: { findUniqueOrThrow: vi.fn(async () => ({ recordType: "CAPA" })) } } }));
vi.mock("./mutation-service", () => ({
  createValidatedReviewThread: vi.fn(async () => ({ id: "thread", status: "PENDING" })),
  replyToValidatedReviewThread: vi.fn(async () => ({ id: "message", reviewThreadId: "thread" })),
  acceptValidatedReviewThread: vi.fn(async () => ({ id: "thread", status: "ACCEPTED" })),
  resolveValidatedReviewThread: vi.fn(async () => ({ id: "thread", status: "RESOLVED" })),
}));
vi.mock("./ui-queries", () => ({ getReviewThreadsForDisplay: vi.fn(async () => []) }));

const input = { qmsRecordId: "record", reviewThreadId: "thread", targetKind: "FIELD" as const, fieldPath: "rootCause", initialMessage: "Observación", message: "Respuesta" };

describe("adaptadores Server Action de revisión", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["crear", createReviewThreadAction], ["responder", replyToReviewThreadAction],
    ["aceptar", acceptReviewThreadAction], ["resolver", resolveReviewThreadAction],
  ] as const)("%s devuelve datos persistidos e invalida solo el módulo afectado", async (_name, action) => {
    const result = await action(input);
    expect(result.error).toBeNull();
    expect(result.reviewThreadId).toBe("thread");
    expect(result.threads).toEqual([]);
    expect(getReviewThreadsForDisplay).toHaveBeenCalledExactlyOnceWith("record");
    expect(revalidatePath).toHaveBeenCalledWith("/capa");
    expect(revalidatePath).toHaveBeenCalledWith("/capa/[id]", "page");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("no invalida ni expone hilos cuando la validación rechaza la operación", async () => {
    vi.mocked(createValidatedReviewThread).mockRejectedValueOnce(new ReviewThreadError("INVALID_INPUT", "Objetivo no permitido"));
    const result = await createReviewThreadAction(input);
    expect(result.error).toBe("Objetivo no permitido");
    expect(result.threads).toBeUndefined();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(getReviewThreadsForDisplay).not.toHaveBeenCalled();
  });
});

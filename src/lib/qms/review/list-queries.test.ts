import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { withActiveReviewCounts } from "./list-queries";

vi.mock("@/lib/db", () => ({ prisma: { reviewThread: { groupBy: vi.fn() } } }));

describe("agregación transversal de revisión sin N+1", () => {
  beforeEach(() => vi.mocked(prisma.reviewThread.groupBy).mockReset());

  it("no consulta si no hay filas visibles", async () => {
    expect(await withActiveReviewCounts([])).toEqual([]);
    expect(prisma.reviewThread.groupBy).not.toHaveBeenCalled();
  });

  it("usa exclusivamente el cliente recibido dentro de una transacción", async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { qmsRecordId: "record", status: "PENDING", _count: { _all: 2 } },
      { qmsRecordId: "record", status: "ACCEPTED", _count: { _all: 1 } },
    ]);
    const tx = { reviewThread: { groupBy } } as unknown as NonNullable<Parameters<typeof withActiveReviewCounts>[1]>;
    expect(await withActiveReviewCounts([{ qmsRecordId: "record" }], tx)).toEqual([
      { qmsRecordId: "record", reviewCounts: { pending: 2, accepted: 1 } },
    ]);
    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.reviewThread.groupBy).not.toHaveBeenCalled();
  });

  it("realiza una única consulta para todas las filas y limita estados/expedientes", async () => {
    vi.mocked(prisma.reviewThread.groupBy).mockResolvedValue([]);
    const rows = Array.from({ length: 300 }, (_, index) => ({ qmsRecordId: `record-${index}` }));
    const enriched = await withActiveReviewCounts(rows);
    expect(prisma.reviewThread.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.reviewThread.groupBy).toHaveBeenCalledWith({
      by: ["qmsRecordId", "status"],
      where: { qmsRecordId: { in: rows.map((row) => row.qmsRecordId) }, status: { in: ["PENDING", "ACCEPTED"] } },
      _count: { _all: true },
    });
    expect(enriched).toHaveLength(300);
    expect(enriched.every((row) => row.reviewCounts.pending === 0 && row.reviewCounts.accepted === 0)).toBe(true);
  });
});

import "server-only";
import { QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getConfigurationOverview() {
  const [deviationForm, capaForm, deviationTemplate, capaTemplate] = await Promise.all([
    prisma.formVersion.findFirst({
      where: { module: QmsRecordType.DEVIATION, status: "ACTIVE", isActive: true },
      include: { fieldConfigs: { orderBy: [{ sectionKey: "asc" }, { sortOrder: "asc" }] } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    }),
    prisma.formVersion.findFirst({
      where: { module: QmsRecordType.CAPA, status: "ACTIVE", isActive: true },
      include: { fieldConfigs: { orderBy: [{ sectionKey: "asc" }, { sortOrder: "asc" }] } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    }),
    prisma.templateVersion.findFirst({
      where: {
        module: QmsRecordType.DEVIATION,
        documentType: "DEVIATION_ANNEX_III",
        isActive: true,
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    }),
    prisma.templateVersion.findFirst({
      where: {
        module: QmsRecordType.CAPA,
        documentType: "CAPA_ANNEX_III",
        isActive: true,
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    deviation: { form: deviationForm, template: deviationTemplate },
    capa: { form: capaForm, template: capaTemplate },
  };
}

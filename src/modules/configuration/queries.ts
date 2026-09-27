import "server-only";
import { QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getConfigurationOverview() {
  const [
    deviationForm,
    capaForm,
    changeForm,
    deviationTemplate,
    capaTemplate,
    changeAnnexIII,
    changeAnnexIV,
    changeAnnexV,
    changeAnnexVII,
  ] = await Promise.all([
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
    prisma.formVersion.findFirst({
      where: { module: QmsRecordType.CHANGE_CONTROL, status: "ACTIVE", isActive: true },
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
    prisma.templateVersion.findFirst({
      where: { module: QmsRecordType.CHANGE_CONTROL, documentType: "CHANGE_ANNEX_III", isActive: true },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    }),
    prisma.templateVersion.findFirst({
      where: { module: QmsRecordType.CHANGE_CONTROL, documentType: "CHANGE_ANNEX_IV", isActive: true },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    }),
    prisma.templateVersion.findFirst({
      where: { module: QmsRecordType.CHANGE_CONTROL, documentType: "CHANGE_ANNEX_V", isActive: true },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    }),
    prisma.templateVersion.findFirst({
      where: { module: QmsRecordType.CHANGE_CONTROL, documentType: "CHANGE_ANNEX_VII", isActive: true },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    deviation: { form: deviationForm, template: deviationTemplate },
    capa: { form: capaForm, template: capaTemplate },
    changeControl: {
      form: changeForm,
      annexIII: changeAnnexIII,
      annexIV: changeAnnexIV,
      annexV: changeAnnexV,
      annexVII: changeAnnexVII,
    },
  };
}

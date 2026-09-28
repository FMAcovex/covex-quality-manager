import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

import { readZip } from "../src/lib/ooxml/zip";
import { generateAnnexIII } from "../src/modules/deviations/documents/annex-iii";
import { generateAnnexV } from "../src/modules/deviations/documents/xlsx";
import { generateCapaAnnexIII } from "../src/modules/capa/documents/annex-iii";
import { generateCapaAnnexIV } from "../src/modules/capa/documents/xlsx";
import { generateChangeAnnexIII } from "../src/modules/change-control/documents/annex-iii";
import { generateChangeAnnexIV } from "../src/modules/change-control/documents/annex-iv";
import { generateChangeAnnexV } from "../src/modules/change-control/documents/annex-v";
import { generateChangeAnnexVII } from "../src/modules/change-control/documents/xlsx";
import { generateComplaintAnnexIII } from "../src/modules/complaints/documents/docx";
import { generateComplaintAnnexV } from "../src/modules/complaints/documents/xlsx";
import { generateReturnAnnexIII, generateReturnAnnexIV, generateReturnAnnexV } from "../src/modules/returns/documents/docx";
import { generateReturnAnnexVI } from "../src/modules/returns/documents/xlsx";

const prisma = new PrismaClient();
const YEAR = 2026;

type Output = {
  fileName: string;
  buffer: Buffer;
  kind: "docx" | "xlsx";
};

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function assertOfficeFile(output: Output) {
  if (output.buffer.length < 3000) {
    throw new Error(`${output.fileName}: archivo anormalmente pequeño (${output.buffer.length} bytes).`);
  }
  const entries = readZip(output.buffer);
  const names = new Set(entries.map((entry) => entry.name));
  if (!names.has("[Content_Types].xml")) {
    throw new Error(`${output.fileName}: paquete OOXML incompleto.`);
  }
  if (output.kind === "docx" && !names.has("word/document.xml")) {
    throw new Error(`${output.fileName}: word/document.xml no encontrado.`);
  }
  if (
    output.kind === "xlsx" &&
    (!names.has("xl/workbook.xml") ||
      !entries.some((entry) => entry.name.startsWith("xl/worksheets/sheet")))
  ) {
    throw new Error(`${output.fileName}: estructura XLSX incompleta.`);
  }

  const searchable = entries
    .filter((entry) => entry.name.endsWith(".xml"))
    .map((entry) => entry.data.toString("utf8"))
    .join("\n");
  if (!searchable.includes("DEMO")) {
    throw new Error(`${output.fileName}: no contiene datos DEMO; posible fallo de mapeo.`);
  }
}

async function loadDemoRecords() {
  const deviation = await prisma.deviation.findFirst({
    where: { qmsRecord: { businessCode: "DEMO-DES-001-2026" } },
    include: {
      qmsRecord: true,
      immediateActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: { orderBy: [{ followupDate: "desc" }, { createdAt: "desc" }] },
      capaPlans: { orderBy: { createdAt: "asc" }, include: { linkedCapaRecord: true } },
      formVersion: true,
      anexoIIITemplateVersion: true,
    },
  });

  const capa = await prisma.capa.findFirst({
    where: { qmsRecord: { businessCode: "DEMO-CAPA-001-2026" } },
    include: {
      qmsRecord: true,
      plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: { orderBy: [{ followupDate: "desc" }, { sequenceNumber: "desc" }] },
      formVersion: true,
      annexIIITemplateVersion: true,
    },
  });

  const change = await prisma.changeControl.findFirst({
    where: { qmsRecord: { businessCode: "DEMO-CC-001-2026" } },
    include: {
      qmsRecord: true,
      tasks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { department: true },
      },
      followups: {
        orderBy: [{ sequenceNumber: "desc" }, { followupDate: "desc" }],
        include: {
          taskStates: {
            include: { task: { include: { department: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      formVersion: true,
      annexIIITemplateVersion: true,
      annexIVTemplateVersion: true,
      annexVTemplateVersion: true,
    },
  });

  const complaint = await prisma.complaint.findFirst({
    where: { qmsRecord: { businessCode: "DEMO-REC-001-2026" } },
    include: {
      qmsRecord: true,
      followups: { orderBy: [{ followupDate: "desc" }, { createdAt: "desc" }] },
      capaPlans: { orderBy: { createdAt: "asc" }, include: { linkedCapaRecord: true } },
      derivedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      formVersion: true,
      annexIIITemplateVersion: true,
      annexIVTemplateVersion: true,
      annexVTemplateVersion: true,
    },
  });

  const returnRecord = await prisma.returnRecord.findFirst({
    where: { qmsRecord: { businessCode: "DEMO-DEVOL-001-2026" } },
    include: {
      qmsRecord: true,
      products: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { department: true } },
      followups: { orderBy: [{ followupDate: "desc" }, { createdAt: "desc" }] },
      formVersion: true,
      annexIIITemplateVersion: true,
      annexIVTemplateVersion: true,
      annexVTemplateVersion: true,
      annexVITemplateVersion: true,
    },
  });

  if (!deviation || !capa || !change || !complaint || !returnRecord) {
    throw new Error("Dataset DEMO incompleto. Ejecuta pnpm demo:seed antes de generar anexos.");
  }
  if (!change.followups.length) {
    throw new Error("El Control de Cambio DEMO no tiene Seguimiento 00. Vuelve a ejecutar pnpm demo:seed.");
  }
  if (!returnRecord.products.length) {
    throw new Error("La Devolución DEMO no tiene producto/lote.");
  }

  return { deviation, capa, change, complaint, returnRecord };
}

async function loadAnnualRows() {
  const [deviations, capas, changes, complaints, returns] = await Promise.all([
    prisma.deviation.findMany({
      where: { qmsRecord: { year: YEAR, businessCode: { startsWith: "DEMO-" } } },
      include: { qmsRecord: true, immediateActions: true, capaPlans: { include: { linkedCapaRecord: true } } },
      orderBy: [{ issueDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.capa.findMany({
      where: { qmsRecord: { year: YEAR, businessCode: { startsWith: "DEMO-" } } },
      include: {
        qmsRecord: true,
        plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        followups: { orderBy: [{ followupDate: "desc" }, { sequenceNumber: "desc" }] },
      },
      orderBy: [{ openedAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.changeControl.findMany({
      where: { qmsRecord: { year: YEAR, businessCode: { startsWith: "DEMO-" } } },
      include: {
        qmsRecord: true,
        tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        followups: { orderBy: [{ sequenceNumber: "desc" }, { followupDate: "desc" }] },
      },
      orderBy: [{ requestDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.complaint.findMany({
      where: { qmsRecord: { year: YEAR, businessCode: { startsWith: "DEMO-" } } },
      include: {
        qmsRecord: true,
        capaPlans: { orderBy: { createdAt: "asc" } },
        followups: { orderBy: [{ followupDate: "desc" }, { createdAt: "desc" }] },
      },
      orderBy: [{ openedAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.returnRecord.findMany({
      where: { qmsRecord: { year: YEAR, businessCode: { startsWith: "DEMO-" } } },
      include: {
        qmsRecord: true,
        products: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        followups: { orderBy: [{ followupDate: "desc" }, { createdAt: "desc" }] },
      },
      orderBy: [{ communicationDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  return { deviations, capas, changes, complaints, returns };
}

async function main() {
  if (process.env.ALLOW_DEMO_DATA !== "true" || process.env.APP_ENV === "production") {
    throw new Error("Generación documental DEMO bloqueada fuera del entorno de demostración.");
  }

  const outputArg = process.argv.find((arg) => arg.startsWith("--out="));
  const outputDir = path.resolve(process.cwd(), outputArg?.slice(6) || "demo-annexes");
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const { deviation, capa, change, complaint, returnRecord } = await loadDemoRecords();
  const annual = await loadAnnualRows();
  const changeSequence = change.followups[0].sequenceNumber;
  const returnProduct = returnRecord.products[0];

  const outputs: Output[] = [
    { fileName: "01_Desviaciones_Anexo_III_DEMO.docx", buffer: await generateAnnexIII(deviation), kind: "docx" },
    { fileName: "02_Desviaciones_Anexo_V_2026.xlsx", buffer: await generateAnnexV(YEAR, annual.deviations), kind: "xlsx" },
    { fileName: "03_CAPA_Anexo_III_DEMO.docx", buffer: await generateCapaAnnexIII(capa), kind: "docx" },
    { fileName: "04_CAPA_Anexo_IV_2026.xlsx", buffer: await generateCapaAnnexIV(YEAR, annual.capas), kind: "xlsx" },
    { fileName: "05_CC_Anexo_III_DEMO.docx", buffer: await generateChangeAnnexIII(change), kind: "docx" },
    { fileName: "06_CC_Anexo_IV_DEMO.docx", buffer: await generateChangeAnnexIV(change), kind: "docx" },
    { fileName: `07_CC_Anexo_V_Seguimiento_${String(changeSequence).padStart(2, "0")}_DEMO.docx`, buffer: await generateChangeAnnexV(change, changeSequence), kind: "docx" },
    { fileName: "08_CC_Anexo_VII_2026.xlsx", buffer: await generateChangeAnnexVII(YEAR, annual.changes), kind: "xlsx" },
    { fileName: "09_Reclamaciones_Anexo_III_DEMO.docx", buffer: await generateComplaintAnnexIII(complaint), kind: "docx" },
    { fileName: "10_Reclamaciones_Anexo_V_2026.xlsx", buffer: await generateComplaintAnnexV(YEAR, annual.complaints), kind: "xlsx" },
    { fileName: "11_Devoluciones_Anexo_III_DEMO.docx", buffer: await generateReturnAnnexIII(returnRecord), kind: "docx" },
    { fileName: "12_Devoluciones_Anexo_IV_DEMO.docx", buffer: await generateReturnAnnexIV(returnRecord, returnProduct), kind: "docx" },
    { fileName: "13_Devoluciones_Anexo_V_DEMO.docx", buffer: await generateReturnAnnexV(returnRecord), kind: "docx" },
    { fileName: "14_Devoluciones_Anexo_VI_2026.xlsx", buffer: await generateReturnAnnexVI(YEAR, annual.returns), kind: "xlsx" },
  ];

  const manifest = [];
  for (const output of outputs) {
    assertOfficeFile(output);
    const target = path.join(outputDir, output.fileName);
    await writeFile(target, output.buffer);
    manifest.push({
      fileName: output.fileName,
      kind: output.kind,
      bytes: output.buffer.length,
      sha256: sha256(output.buffer),
      structuralCheck: "OK",
    });
  }

  await writeFile(
    path.join(outputDir, "MANIFEST.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dataset: "DEMO-* · datos ficticios",
        year: YEAR,
        count: outputs.length,
        files: manifest,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(`Generados y verificados ${outputs.length} anexos DEMO en ${outputDir}`);
  for (const file of manifest) console.log(`OK ${file.fileName} · ${file.bytes} bytes`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { describe, expect, it } from "vitest";
import { QmsRecordType } from "@prisma/client";
import {
  buildDeviationCode,
  buildOperationalBusinessCode,
  deviationCodePrefix,
  extractDeviationSequence,
  extractOperationalBusinessCodeSequence,
  operationalBusinessCodeFormat,
  operationalBusinessCodePrefix,
} from "@/lib/qms/business-code";

describe("business-code", () => {
  it("genera el formato D/XX-NN/ZZZ/YYYY", () => {
    expect(buildDeviationCode("GC-00", 15, 2026)).toBe("D/GC-00/015/2026");
    expect(deviationCodePrefix("PM-10")).toBe("D/PM-10/");
  });

  it("extrae solo correlativos del departamento y año correctos", () => {
    expect(extractDeviationSequence("D/GC-00/015/2026", "GC-00", 2026)).toBe(15);
    expect(extractDeviationSequence("D/PM-10/015/2026", "GC-00", 2026)).toBeNull();
    expect(extractDeviationSequence("D/GC-00/015/2025", "GC-00", 2026)).toBeNull();
    expect(extractDeviationSequence("DEMO-DES-001-2026", "GC-00", 2026)).toBeNull();
  });

  it("rechaza correlativos fuera del rango de tres cifras", () => {
    expect(() => buildDeviationCode("GC-00", 0, 2026)).toThrow();
    expect(() => buildDeviationCode("GC-00", 1000, 2026)).toThrow();
  });

  it("genera los formatos controlados por módulo de D5.3", () => {
    const capaCorrective = {
      recordType: QmsRecordType.CAPA,
      year: 2026,
      departmentCode: "GC-00",
      actionType: "CORRECTIVE" as const,
    };
    const capaPreventive = { ...capaCorrective, actionType: "PREVENTIVE" as const };
    const change = {
      recordType: QmsRecordType.CHANGE_CONTROL,
      year: 2026,
      departmentCode: "GC-00",
    };
    const customerComplaint = {
      recordType: QmsRecordType.COMPLAINT,
      year: 2026,
      complaintType: "CUSTOMER" as const,
    };
    const providerComplaint = { ...customerComplaint, complaintType: "PROVIDER" as const };
    const returned = {
      recordType: QmsRecordType.RETURN,
      year: 2026,
      departmentCode: "LG-30",
    };

    expect(buildOperationalBusinessCode(capaCorrective, 1)).toBe("AC/GC-00/001/2026");
    expect(buildOperationalBusinessCode(capaPreventive, 12)).toBe("AP/GC-00/012/2026");
    expect(buildOperationalBusinessCode(change, 3)).toBe("C/GC-00/003/2026");
    expect(buildOperationalBusinessCode(customerComplaint, 4)).toBe("R/C/004/2026");
    expect(buildOperationalBusinessCode(providerComplaint, 5)).toBe("R/P/005/2026");
    expect(buildOperationalBusinessCode(returned, 6)).toBe("DEV/LG-30/006/2026");

    expect(operationalBusinessCodePrefix(change)).toBe("C/GC-00/");
    expect(operationalBusinessCodeFormat(returned)).toBe("DEV/LG-30/ZZZ/2026");
  });

  it("extrae correlativos solo cuando tipo, contexto y año coinciden", () => {
    const capa = {
      recordType: QmsRecordType.CAPA,
      year: 2026,
      departmentCode: "GC-00",
      actionType: "CORRECTIVE" as const,
    };
    expect(extractOperationalBusinessCodeSequence("AC/GC-00/015/2026", capa)).toBe(15);
    expect(extractOperationalBusinessCodeSequence("AP/GC-00/015/2026", capa)).toBeNull();
    expect(extractOperationalBusinessCodeSequence("AC/GC-00/015/2025", capa)).toBeNull();
    expect(extractOperationalBusinessCodeSequence("DEMO-CAPA-001-2026", capa)).toBeNull();
  });

  it("rechaza contextos incompletos o correlativos fuera de rango", () => {
    expect(() =>
      buildOperationalBusinessCode(
        { recordType: QmsRecordType.RETURN, year: 2026 },
        1,
      ),
    ).toThrow(/área\/almacén/);
    expect(() =>
      buildOperationalBusinessCode(
        {
          recordType: QmsRecordType.COMPLAINT,
          year: 2026,
          complaintType: "CUSTOMER",
        },
        1000,
      ),
    ).toThrow(/001 y 999/);
  });
});

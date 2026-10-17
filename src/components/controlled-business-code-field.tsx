"use client";

import { authenticatedFetch } from "@/lib/auth/client";

import { useEffect, useState } from "react";
export function ControlledBusinessCodeField({
  recordType,
  name = "businessCode",
  label,
  initialValue,
  mode,
  yearSource,
  departmentId,
  actionType,
  complaintType,
  auditType,
  auditScenario,
  entityCode,
  oosArea,
  locked,
  onValueChange,
}: {
  recordType: "AUDIT" | "CAPA" | "CHANGE_CONTROL" | "COMPLAINT" | "RETURN" | "OOS";
  name?: string;
  label: string;
  initialValue?: string;
  mode: "create" | "edit";
  yearSource?: string;
  departmentId?: string;
  actionType?: "CORRECTIVE" | "PREVENTIVE" | null;
  complaintType?: "CUSTOMER" | "PROVIDER" | null;
  auditType?: "INTERNAL" | "EXTERNAL" | null;
  auditScenario?: "INTERNAL_COVEX" | "INTERNAL_CONTRACTED" | "SUPPLIER" | "CLIENT" | "AUTHORITY" | null;
  entityCode?: string;
  oosArea?: "API" | "MD" | null;
  locked?: boolean;
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [suggestion, setSuggestion] = useState("");
  const [format, setFormat] = useState("");
  const [error, setError] = useState("");
  const isLocked = locked ?? mode === "edit";

  useEffect(() => {
    if (isLocked) {
      setSuggestion("");
      setError("");
      return;
    }

    const year =
      yearSource && /^\d{4}-/.test(yearSource)
        ? Number(yearSource.slice(0, 4))
        : new Date().getFullYear();

    if (
      ((recordType === "AUDIT" && auditType === "INTERNAL") || recordType === "CAPA" ||
        recordType === "CHANGE_CONTROL" ||
        recordType === "RETURN") &&
      !departmentId
    ) {
      setSuggestion("");
      setFormat("");
      return;
    }
    if (recordType === "CAPA" && !actionType) {
      setSuggestion("");
      setFormat("");
      return;
    }
    if (recordType === "OOS" && !oosArea) {
      setSuggestion("");
      setFormat("");
      return;
    }
    if (recordType === "COMPLAINT" && !complaintType) {
      setSuggestion("");
      setFormat("");
      return;
    }

    if (recordType === "AUDIT" && (!auditType || !auditScenario || (auditType === "EXTERNAL" && !entityCode))) { setSuggestion(""); setFormat(""); return; }

    const params = new URLSearchParams({
      recordType,
      year: String(year),
    });
    if (auditType) params.set("auditType", auditType);
    if (auditScenario) params.set("auditScenario", auditScenario);
    if (entityCode) params.set("entityCode", entityCode);
    if (departmentId) params.set("departmentId", departmentId);
    if (actionType) params.set("actionType", actionType);
    if (complaintType) params.set("complaintType", complaintType);
    if (oosArea) params.set("oosArea", oosArea);

    const controller = new AbortController();
    authenticatedFetch(`/api/qms/business-code-suggestion?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          suggestion?: string;
          format?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error || "No se ha podido calcular la sugerencia.");
        setSuggestion(data.suggestion ?? "");
        setFormat(data.format ?? "");
        setError("");
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setSuggestion("");
        setError(cause instanceof Error ? cause.message : "No se ha podido calcular la sugerencia.");
      });
    return () => controller.abort();
  }, [actionType, complaintType, departmentId, isLocked, recordType, yearSource, auditType, auditScenario, entityCode, oosArea]);

  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        value={value}
        onChange={(event) => { setValue(event.target.value); onValueChange?.(event.target.value); }}
        readOnly={isLocked}
        placeholder={
          isLocked
            ? undefined
            : suggestion || format || "Se asignará automáticamente al guardar"
        }
      />
      <small className="muted-note">
        {isLocked
          ? "La codificación queda fijada al salir de Borrador."
          : suggestion
            ? <>Sugerencia correlativa: <button type="button" className="link-button-inline" onClick={() => { setValue(suggestion); onValueChange?.(suggestion); }}>{suggestion}</button>. Si se deja vacío, se asignará automáticamente al guardar.</>
            : error
              ? error
              : format
                ? `Formato: ${format}. Si se deja vacío, se asignará automáticamente.`
                : "Selecciona los datos de identificación para calcular la sugerencia."}
      </small>
    </label>
  );
}

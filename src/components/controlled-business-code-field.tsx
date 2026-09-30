"use client";

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
  locked,
}: {
  recordType: "CAPA" | "CHANGE_CONTROL" | "COMPLAINT" | "RETURN";
  name?: string;
  label: string;
  initialValue?: string;
  mode: "create" | "edit";
  yearSource?: string;
  departmentId?: string;
  actionType?: "CORRECTIVE" | "PREVENTIVE" | null;
  complaintType?: "CUSTOMER" | "PROVIDER" | null;
  locked?: boolean;
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
      (recordType === "CAPA" ||
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
    if (recordType === "COMPLAINT" && !complaintType) {
      setSuggestion("");
      setFormat("");
      return;
    }

    const params = new URLSearchParams({
      recordType,
      year: String(year),
    });
    if (departmentId) params.set("departmentId", departmentId);
    if (actionType) params.set("actionType", actionType);
    if (complaintType) params.set("complaintType", complaintType);

    const controller = new AbortController();
    fetch(`/api/qms/business-code-suggestion?${params.toString()}`, {
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
  }, [actionType, complaintType, departmentId, isLocked, recordType, yearSource]);

  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
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
            ? <>Sugerencia correlativa: <button type="button" className="link-button-inline" onClick={() => setValue(suggestion)}>{suggestion}</button>. Si se deja vacío, se asignará automáticamente al guardar.</>
            : error
              ? error
              : format
                ? `Formato: ${format}. Si se deja vacío, se asignará automáticamente.`
                : "Selecciona los datos de identificación para calcular la sugerencia."}
      </small>
    </label>
  );
}

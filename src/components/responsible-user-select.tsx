"use client";
import { responsibleTextAfterPick, type AppUserOption } from "@/lib/qms/responsible-user";

function Options({ users, value }: { users: AppUserOption[]; value: string }) {
  return (
    <>
      <option value="">Sin usuario</option>
      {users.filter((user) => user.active || user.id === value).map((user) => (
        <option key={user.id} value={user.id}>{user.name}{user.active ? "" : " (inactivo)"}</option>
      ))}
    </>
  );
}

/**
 * Usuario de la aplicación junto a un responsable en texto libre (D-101), para filas que se editan
 * en estado React. Al elegir un usuario, si el texto está vacío se propone su nombre.
 */
export function ResponsibleUserPicker({ users, value, text, onChange, label = "Usuario de la aplicación" }: {
  users: AppUserOption[];
  value: string | null | undefined;
  text: string;
  onChange: (patch: { userId: string; text: string }) => void;
  label?: string;
}) {
  const current = value ?? "";
  return (
    <label className="field">
      <span>{label}</span>
      <select value={current} onChange={(event) => {
        const userId = event.target.value;
        onChange({ userId, text: responsibleTextAfterPick(text, users.find((user) => user.id === userId)) });
      }}>
        <Options users={users} value={current} />
      </select>
    </label>
  );
}

/** Variante para formularios con campos con nombre: rellena el texto `textName` si está vacío. */
export function ResponsibleUserSelect({ users, name, textName, defaultValue, label = "Usuario de la aplicación", className = "field" }: {
  users: AppUserOption[];
  name: string;
  textName: string;
  defaultValue?: string | null;
  label?: string;
  className?: string;
}) {
  const current = defaultValue ?? "";
  return (
    <label className={className}>
      <span>{label}</span>
      <select name={name} defaultValue={current} onChange={(event) => {
        const input = event.currentTarget.form?.elements.namedItem(textName);
        if (input instanceof HTMLInputElement) input.value = responsibleTextAfterPick(input.value, users.find((user) => user.id === event.target.value));
      }}>
        <Options users={users} value={current} />
      </select>
    </label>
  );
}

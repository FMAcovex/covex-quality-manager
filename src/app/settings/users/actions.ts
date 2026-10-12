"use server";
import { administerUser, configureRole } from "@/lib/auth/administration";
import { revalidatePath } from "next/cache";
export async function saveUserAuthorization(form: FormData) {
  await administerUser({
    ...(form.get("id") ? { id: String(form.get("id")) } : {}), objectId: String(form.get("objectId")), displayName: String(form.get("displayName")), email: String(form.get("email")), active: form.get("active") === "on",
    roleIds: form.getAll("roleId").map(String), departmentIds: form.getAll("departmentId").map(String), assignments: JSON.parse(String(form.get("assignments") || "[]")), reason: String(form.get("reason")),
  }, form);
  revalidatePath("/settings/users");
}
export async function saveRolePolicy(form: FormData) {
  await configureRole({ roleId: String(form.get("roleId")), grants: JSON.parse(String(form.get("grants") || "[]")), reason: String(form.get("reason")) }, form);
  revalidatePath("/settings/users");
}

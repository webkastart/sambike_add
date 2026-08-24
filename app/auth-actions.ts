"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSession,
  createAdminSession,
  isAdminAuthenticationConfigured,
  verifyAdminPassword,
} from "@/lib/admin-auth";

function safeNextPath(value: FormDataEntryValue | null) {
  const path = String(value ?? "");
  return path.startsWith("/admin") && !path.startsWith("//") ? path : "/admin";
}

export async function loginAdmin(formData: FormData) {
  const nextPath = safeNextPath(formData.get("next"));
  if (!isAdminAuthenticationConfigured()) redirect("/prihlasenie?config=1");

  if (!verifyAdminPassword(String(formData.get("password") ?? ""))) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    redirect(`/prihlasenie?error=1&next=${encodeURIComponent(nextPath)}`);
  }

  await createAdminSession();
  redirect(nextPath);
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/prihlasenie");
}

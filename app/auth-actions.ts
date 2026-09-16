"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  adminCookieName,
  adminSessionCookieOptions,
  createAdminSessionValue,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { safeAdminReturnTo } from "@/lib/session-core";

function safeNext(value: FormDataEntryValue | null) {
  return safeAdminReturnTo(value);
}

export async function loginAdmin(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const limit = await consumeRateLimit("admin-login", 5, 15 * 60 * 1000, await requestIp());
  if (!limit) {
    redirect(`/prihlasenie?rate=1&next=${encodeURIComponent(next)}`);
  }
  if (!verifyAdminPassword(String(formData.get("password") ?? ""))) {
    redirect(`/prihlasenie?error=1&next=${encodeURIComponent(next)}`);
  }
  (await cookies()).set(adminCookieName, createAdminSessionValue(), adminSessionCookieOptions());
  redirect(next);
}

export async function logoutAdmin() {
  (await cookies()).delete(adminCookieName);
  redirect("/prihlasenie");
}

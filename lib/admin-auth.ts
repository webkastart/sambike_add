import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminPassword, adminSessionSecret } from "@/lib/security-config";
import {
  adminSessionCookie,
  adminSessionLifetimeSeconds,
  createSessionToken,
  verifySessionToken,
} from "@/lib/session-core";

const cookieName = adminSessionCookie;

export function adminAuthConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD?.trim() && process.env.ADMIN_SESSION_SECRET?.trim());
}

export function verifyAdminPassword(candidate: string) {
  const secret = adminSessionSecret();
  const expected = createHmac("sha256", secret).update(adminPassword()).digest();
  const supplied = createHmac("sha256", secret).update(candidate).digest();
  return timingSafeEqual(expected, supplied);
}

export function createAdminSessionValue() {
  return createSessionToken(adminSessionSecret());
}

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: adminSessionLifetimeSeconds,
  };
}

export async function isAdminAuthenticated() {
  const value = (await cookies()).get(cookieName)?.value;
  return verifySessionToken(value, adminSessionSecret());
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("Neautorizovaný prístup.");
  return { actor: "Administrátor" };
}

export async function requireAdminPage(nextPath = "/admin") {
  if (!(await isAdminAuthenticated())) {
    redirect(`/prihlasenie?next=${encodeURIComponent(nextPath)}`);
  }
}

export const adminCookieName = cookieName;

import "server-only";

import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const adminSessionCookie = "sambike_admin_session";
const sessionDurationSeconds = 60 * 60 * 12;

function configuredPassword() {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || configuredPassword();
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function sign(expiresAt: number) {
  return createHmac("sha256", sessionSecret()).update(String(expiresAt)).digest("base64url");
}

export function isAdminAuthenticationConfigured() {
  return Boolean(configuredPassword());
}

export function verifyAdminPassword(candidate: string) {
  const password = configuredPassword();
  if (!password) return false;
  return timingSafeEqual(digest(candidate), digest(password));
}

export async function createAdminSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + sessionDurationSeconds;
  const cookieStore = await cookies();
  cookieStore.set(adminSessionCookie, `${expiresAt}.${sign(expiresAt)}`, {
    httpOnly: true,
    maxAge: sessionDurationSeconds,
    path: "/admin",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(adminSessionCookie);
}

export async function hasAdminSession() {
  if (!isAdminAuthenticationConfigured()) {
    return process.env.NODE_ENV !== "production";
  }

  const token = (await cookies()).get(adminSessionCookie)?.value;
  if (!token) return false;
  const [expiresText, providedSignature, ...rest] = token.split(".");
  const expiresAt = Number(expiresText);
  if (rest.length > 0 || !Number.isInteger(expiresAt) || !providedSignature) return false;
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false;
  if (expiresAt > Math.floor(Date.now() / 1000) + sessionDurationSeconds + 60) return false;

  const expectedSignature = sign(expiresAt);
  return timingSafeEqual(digest(providedSignature), digest(expectedSignature));
}

export async function requireAdmin() {
  if (!(await hasAdminSession())) redirect("/prihlasenie");
}

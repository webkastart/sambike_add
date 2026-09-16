import { NextRequest, NextResponse } from "next/server";
import { adminSessionSecret } from "@/lib/security-config";
import { adminSessionCookie, verifySessionToken } from "@/lib/session-core";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/kampan/")) {
    const response = NextResponse.next();
    const slug = request.nextUrl.pathname.split("/")[2]?.replace(/[^a-z0-9-]/g, "").slice(0, 120);
    if (slug) {
      const cookieName = `sambike_variant_${slug}`;
      const existing = request.cookies.get(cookieName)?.value;
      if (existing !== "A" && existing !== "B") {
        const granted = request.cookies.get("sambike_marketing_consent")?.value === "granted";
        response.cookies.set(cookieName, Math.random() < 0.5 ? "A" : "B", {
          httpOnly: true,
          sameSite: "lax",
          secure: request.nextUrl.protocol === "https:",
          path: `/kampan/${slug}`,
          ...(granted ? { maxAge: 365 * 24 * 60 * 60 } : {}),
        });
      }
    }
    return response;
  }
  const session = request.cookies.get(adminSessionCookie)?.value;
  if (verifySessionToken(session, adminSessionSecret())) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  const login = new URL("/prihlasenie", request.url);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/admin/:path*", "/kampan/:path*"] };

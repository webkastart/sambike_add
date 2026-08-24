import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const adminSessionCookie = "sambike_admin_session";

export function proxy(request: NextRequest) {
  if (!process.env.ADMIN_PASSWORD?.trim() && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }
  if (request.cookies.has(adminSessionCookie)) return NextResponse.next();

  const loginUrl = new URL("/prihlasenie", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: "/admin/:path*",
};

import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const ADMIN_PREFIX = "/admin";
const KASIR_PREFIX = "/kasir";
const PELANGGAN_PREFIX = "/pelanggan";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessionCookie = getSessionCookie(req);

  const protectedPrefix =
    pathname.startsWith(ADMIN_PREFIX) ||
    pathname.startsWith(KASIR_PREFIX) ||
    pathname.startsWith(PELANGGAN_PREFIX);

  if (protectedPrefix && !sessionCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/kasir/:path*", "/pelanggan/:path*"],
};

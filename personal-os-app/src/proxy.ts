import { NextResponse, type NextRequest } from "next/server";
import {
  configuredReadTokens,
  isPersonalOsAuthDisabled,
  requestHasReadAccess,
} from "@/lib/auth";

export function proxy(request: NextRequest) {
  if (
    process.env.NODE_ENV !== "production" ||
    isPersonalOsAuthDisabled() ||
    isPublicPath(request.nextUrl.pathname)
  ) {
    return NextResponse.next();
  }

  const tokens = configuredReadTokens();
  if (tokens.length === 0) {
    return new NextResponse(
      "PERSONAL_OS_READ_TOKEN or PERSONAL_OS_API_TOKEN must be set in production",
      { status: 503 },
    );
  }

  if (requestHasReadAccess(request.headers, tokens)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/auth/read";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

function isPublicPath(pathname: string) {
  return pathname === "/auth/read";
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

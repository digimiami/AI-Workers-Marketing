import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

const ADMIN_PREFIX = "/admin";
const PROTECTED_API_PREFIXES = ["/api/admin/", "/api/growth/", "/api/workspace/"];

function isProtectedApi(pathname: string) {
  return PROTECTED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith(ADMIN_PREFIX) || isProtectedApi(pathname)) {
    const { supabase, response } = createSupabaseMiddlewareClient(request);
    // Refresh session cookies for server components and API routes.
    const { data } = await supabase.auth.getUser();

    if (pathname.startsWith(ADMIN_PREFIX)) {
      if (!data.user) {
        const url = new URL("/login", request.url);
        url.searchParams.set("redirectTo", request.nextUrl.pathname);
        return NextResponse.redirect(url);
      }
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/growth/:path*", "/api/workspace/:path*"],
};

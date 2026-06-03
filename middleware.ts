import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

const ADMIN_PREFIX = "/admin";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith(ADMIN_PREFIX)) {
    const { supabase, response } = createSupabaseMiddlewareClient(request);
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      const url = new URL("/login", request.url);
      url.searchParams.set("redirectTo", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

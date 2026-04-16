import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

const ADMIN_PREFIX = "/admin";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request);

  if (request.nextUrl.pathname.startsWith(ADMIN_PREFIX)) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      const url = new URL("/login", request.url);
      url.searchParams.set("redirectTo", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};


import { NextResponse, type NextRequest } from "next/server";

import {
  agentsRewritePath,
  isAgentsSubdomain,
  shouldRewriteForAgentsSite,
} from "@/lib/agents-site/subdomain";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

const ADMIN_PREFIX = "/admin";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isAgentsSubdomain(request) && shouldRewriteForAgentsSite(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = agentsRewritePath(pathname);
    return NextResponse.rewrite(url);
  }

  if (pathname.startsWith(ADMIN_PREFIX)) {
    const { supabase, response } = createSupabaseMiddlewareClient(request);
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      const url = new URL("/login", request.url);
      url.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};


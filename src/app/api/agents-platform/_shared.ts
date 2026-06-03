import { NextResponse } from "next/server";

import { env } from "@/lib/env";

const DEFAULT_AGENTS_ORIGINS = [
  "https://agents.aiworkers.vip",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

export function getAgentsSiteOrigins(): string[] {
  const extra = (env.server.AGENTS_SITE_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_AGENTS_ORIGINS, ...extra])];
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin");
  const allowed = getAgentsSiteOrigins();
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function jsonWithCors(req: Request, body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...corsHeaders(req), ...(init?.headers ?? {}) },
  });
}

export function optionsResponse(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export function withPlatformAdmin(req: Request): { error: NextResponse | null } {
  const secret = env.server.AGENTS_PLATFORM_ADMIN_SECRET;
  if (!secret) {
    return {
      error: jsonWithCors(
        req,
        { ok: false, message: "Platform admin is not configured on the server." },
        { status: 503 },
      ),
    };
  }

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token || token !== secret) {
    return {
      error: jsonWithCors(req, { ok: false, message: "Unauthorized" }, { status: 401 }),
    };
  }

  return { error: null };
}

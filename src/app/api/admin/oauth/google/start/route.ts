import crypto from "crypto";
import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { env } from "@/lib/env";
import { signOAuthState } from "@/services/oauth/oauthState";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  returnTo: z.string().min(1).default("/admin/settings"),
});

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const clientId = env.server.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.server.GOOGLE_OAUTH_CLIENT_SECRET;
  const appBase = env.server.APP_BASE_URL;
  if (!clientId || !clientSecret || !appBase) {
    return NextResponse.json(
      { ok: false, message: "OAuth not configured (set GOOGLE_OAUTH_CLIENT_ID/SECRET and APP_BASE_URL)" },
      { status: 503 },
    );
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  const state = signOAuthState({
    organizationId: parsed.data.organizationId,
    userId: ctx.user.id,
    returnTo: parsed.data.returnTo,
    nonce,
  });

  const redirectUri = `${appBase.replace(/\/$/, "")}/api/admin/oauth/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", state);

  // Return URL to client (it will redirect the browser).
  return NextResponse.json({ ok: true, url: url.toString() });
}


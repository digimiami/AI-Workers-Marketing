import { NextResponse } from "next/server";

import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { encryptJson, redactCredentials } from "@/services/platforms/credentialsCrypto";
import { verifyOAuthState } from "@/services/oauth/oauthState";
import { writeAuditLog } from "@/services/audit/auditService";

const qSchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(10).optional(),
  error: z.string().optional(),
});

async function exchangeCode(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}) {
  const body = new URLSearchParams();
  body.set("code", params.code);
  body.set("client_id", params.clientId);
  body.set("client_secret", params.clientSecret);
  body.set("redirect_uri", params.redirectUri);
  body.set("grant_type", "authorization_code");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Token exchange failed: HTTP ${res.status}`);
  return json as Record<string, unknown>;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = qSchema.safeParse({
    code: url.searchParams.get("code") ?? undefined,
    state: url.searchParams.get("state") ?? undefined,
    error: url.searchParams.get("error") ?? undefined,
  });
  if (!parsed.success) return NextResponse.redirect("/admin/settings?oauth=invalid");

  const appBase = env.server.APP_BASE_URL;
  const clientId = env.server.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.server.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!appBase || !clientId || !clientSecret) {
    return NextResponse.redirect("/admin/settings?oauth=not_configured");
  }

  const st = parsed.data.state ? verifyOAuthState(parsed.data.state) : null;
  if (!st) return NextResponse.redirect("/admin/settings?oauth=bad_state");
  if (parsed.data.error) {
    return NextResponse.redirect(`${st.returnTo}?oauth=error&reason=${encodeURIComponent(parsed.data.error)}`);
  }
  if (!parsed.data.code) return NextResponse.redirect(`${st.returnTo}?oauth=missing_code`);

  const redirectUri = `${appBase.replace(/\/$/, "")}/api/admin/oauth/google/callback`;
  let token: Record<string, unknown>;
  try {
    token = await exchangeCode({
      code: parsed.data.code,
      redirectUri,
      clientId,
      clientSecret,
    });
  } catch (e) {
    return NextResponse.redirect(`${st.returnTo}?oauth=exchange_failed`);
  }

  // Persist encrypted token bundle in settings as "oauth_google".
  const admin = createSupabaseAdminClient();
  const encrypted = encryptJson({
    provider: "google",
    scopes: token.scope ?? null,
    access_token: token.access_token ?? null,
    refresh_token: token.refresh_token ?? null,
    expires_in: token.expires_in ?? null,
    token_type: token.token_type ?? null,
    obtained_at: new Date().toISOString(),
  });

  await admin.from("settings" as never).upsert(
    {
      organization_id: st.organizationId,
      key: "oauth_google",
      value: { encrypted },
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "organization_id,key" },
  );

  await writeAuditLog({
    organizationId: st.organizationId,
    actorUserId: st.userId,
    action: "settings.updated",
    entityType: "settings",
    entityId: "oauth_google",
    metadata: { provider: "google", token: redactCredentials(token as any) },
  });

  return NextResponse.redirect(`${st.returnTo}?oauth=connected`);
}


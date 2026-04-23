import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator, withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { writeAuditLog } from "@/services/audit/auditService";
import { encryptJson, decryptJson, redactCredentials } from "@/services/platforms/credentialsCrypto";

const platformSchema = z.enum(["facebook", "google_ads", "tiktok"]);

const querySchema = z.object({
  organizationId: z.string().uuid(),
});

const upsertSchema = z.object({
  organizationId: z.string().uuid(),
  platform: platformSchema,
  credentials: z.record(z.string(), z.unknown()),
});

function computeStatus(platform: z.infer<typeof platformSchema>, creds: Record<string, unknown>) {
  const has = (k: string) => typeof creds[k] === "string" && (creds[k] as string).trim().length > 0;
  if (platform === "facebook") {
    return {
      connected: has("app_id") && has("app_secret") && has("ad_account_id"),
      missing: ["app_id", "app_secret", "ad_account_id"].filter((k) => !has(k)),
    };
  }
  if (platform === "google_ads") {
    return {
      connected: has("developer_token") && has("client_id") && has("client_secret"),
      missing: ["developer_token", "client_id", "client_secret"].filter((k) => !has(k)),
    };
  }
  return {
    connected: has("advertiser_id") && has("access_token"),
    missing: ["advertiser_id", "access_token"].filter((k) => !has(k)),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ organizationId: url.searchParams.get("organizationId") });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const ctx = await withOrgMember(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const { data, error } = await ctx.supabase
    .from("organization_ad_credentials" as never)
    .select("platform,encrypted,status,updated_at")
    .eq("organization_id", parsed.data.organizationId);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{
    platform: string;
    encrypted: unknown;
    status: unknown;
    updated_at: string;
  }>;

  const out = rows.map((r) => {
    let decrypted: Record<string, unknown> = {};
    try {
      decrypted = decryptJson(r.encrypted);
    } catch {
      decrypted = {};
    }
    return {
      platform: r.platform,
      status: r.status,
      updated_at: r.updated_at,
      credentials_redacted: redactCredentials(decrypted),
    };
  });

  return NextResponse.json({ ok: true, platforms: out });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body", issues: parsed.error.flatten() }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const status = computeStatus(parsed.data.platform, parsed.data.credentials);
  const encrypted = encryptJson(parsed.data.credentials);

  const { data, error } = await ctx.supabase
    .from("organization_ad_credentials" as never)
    .upsert(
      {
        organization_id: parsed.data.organizationId,
        platform: parsed.data.platform,
        encrypted,
        status,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "organization_id,platform" },
    )
    .select("platform,status,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: ctx.user.id,
    action: "settings.updated",
    entityType: "organization_ad_credentials",
    entityId: String(parsed.data.platform),
    metadata: { platform: parsed.data.platform, connected: status.connected, missing: status.missing },
  });

  return NextResponse.json({ ok: true, platform: data });
}


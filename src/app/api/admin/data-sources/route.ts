import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import {
  DEFAULT_DATA_SOURCES,
  getDataSources,
  type DataSourceRow,
  type DataSourceStatus,
  upsertDataSources,
} from "@/services/dataSources/dataSources";

const getSchema = z.object({ organizationId: z.string().uuid() });

const patchSchema = z.object({
  organizationId: z.string().uuid(),
  sources: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        status: z.enum(["connected", "pending", "disconnected", "stubbed"]) as z.ZodType<DataSourceStatus>,
        details: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = getSchema.safeParse({ organizationId: url.searchParams.get("organizationId") });
  if (!parsed.success) return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const sources = await getDataSources(ctx.supabase as any, parsed.data.organizationId).catch(() =>
    DEFAULT_DATA_SOURCES.map((s) => ({ ...s })),
  );

  return NextResponse.json({ ok: true, sources });
}

export async function PATCH(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  // Keep stable ordering using defaults; accept client-changed labels/details/status.
  const byKey = new Map<string, DataSourceRow>();
  for (const s of parsed.data.sources) {
    byKey.set(s.key, { key: s.key as any, label: s.label, status: s.status, details: s.details });
  }
  const merged: DataSourceRow[] = DEFAULT_DATA_SOURCES.map((d) => byKey.get(d.key) ?? { ...d });

  await upsertDataSources(ctx.supabase as any, parsed.data.organizationId, { sources: merged });
  return NextResponse.json({ ok: true, sources: merged });
}


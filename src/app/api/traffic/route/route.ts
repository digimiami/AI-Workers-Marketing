import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { routeTrafficToVariant, variantLetterToDbKey } from "@/services/growth/trafficRouterService";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  trafficSource: z.string().min(1),
  device: z.string().min(1).default("unknown"),
  intentLevel: z.enum(["low", "medium", "high", "unknown"]).default("unknown"),
  location: z.string().optional(),
  userBehavior: z.record(z.string(), z.unknown()).optional(),
  variantPerformance: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const d = parsed.data;
  const router = await routeTrafficToVariant({
    trafficSource: d.trafficSource,
    device: d.device,
    intentLevel: d.intentLevel,
    location: d.location ?? null,
    userBehavior: d.userBehavior ?? null,
    variantPerformance: d.variantPerformance ?? null,
  });

  const letter = typeof router.selectedVariant === "string" ? router.selectedVariant : "A";
  const selectedVariantDbKey = variantLetterToDbKey(letter);
  const fallbackDbKey = variantLetterToDbKey(typeof router.fallbackVariant === "string" ? router.fallbackVariant : "B");

  return NextResponse.json({
    ok: true,
    router,
    selectedVariantDbKey,
    fallbackDbKey,
  });
}

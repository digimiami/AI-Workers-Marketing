"use server";

import { redirect } from "next/navigation";

import { z } from "zod";

import { setCurrentOrgIdCookie } from "@/lib/cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/services/auth/authService";

function redirectOnboardingError(message: string): never {
  redirect(`/admin/onboarding?error=${encodeURIComponent(message)}`);
}

const schema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes."),
});

export async function createOrganizationAction(formData: FormData) {
  const user = await requireUser();

  const parsed = schema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });

  if (!parsed.success) {
    redirectOnboardingError("Invalid organization details.");
  }

  const supabase = await createSupabaseServerClient();
  // Organization creation requires a bootstrap path under RLS.
  // Use a SECURITY DEFINER RPC that also inserts the creator as org admin.
  const { data: org, error } = await supabase.rpc("create_organization_with_owner" as any, {
    org_name: parsed.data.name,
    org_slug: parsed.data.slug,
  } as any);

  if (error) redirectOnboardingError(error.message);
  if (!org) redirectOnboardingError("Failed to create organization.");

  await setCurrentOrgIdCookie((org as any).id);
  redirect("/admin");
}

export async function selectOrganizationAction(formData: FormData) {
  const orgId = String(formData.get("orgId") ?? "");
  if (!orgId) redirectOnboardingError("Organization is required.");
  await setCurrentOrgIdCookie(orgId);
  redirect("/admin/campaigns");
}


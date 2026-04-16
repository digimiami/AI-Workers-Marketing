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
  const { data: org, error } = await supabase
    .from("organizations" as any)
    .insert({ name: parsed.data.name, slug: parsed.data.slug } as any)
    .select("id,name,slug")
    .single();

  if (error) redirectOnboardingError(error.message);

  const { error: memberErr } = await supabase
    .from("organization_members" as any)
    .insert({
      organization_id: (org as any).id,
      user_id: user.id,
      role: "admin",
    } as any);

  if (memberErr) redirectOnboardingError(memberErr.message);

  await setCurrentOrgIdCookie((org as any).id);
  redirect("/admin");
}

export async function selectOrganizationAction(formData: FormData) {
  const orgId = String(formData.get("orgId") ?? "");
  if (!orgId) redirectOnboardingError("Organization is required.");
  await setCurrentOrgIdCookie(orgId);
  redirect("/admin/campaigns");
}


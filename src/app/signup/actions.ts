"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";

import { z } from "zod";

import { setCurrentOrgIdCookie } from "@/lib/cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  orgName: z.string().min(2),
});

function redirectSignupError(message: string): never {
  redirect(`/signup?error=${encodeURIComponent(message)}`);
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export async function signUpAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    orgName: formData.get("orgName"),
  });
  if (!parsed.success) redirectSignupError("Invalid signup details.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) redirectSignupError(error.message);
  const user = data.user;
  if (!user) redirectSignupError("Signup failed. Try again.");

  // Create an org for this user via SECURITY DEFINER RPC (also inserts membership).
  const slug = `${slugify(parsed.data.orgName)}-${crypto.randomUUID().slice(0, 6)}`;
  const { data: org, error: orgErr } = await supabase.rpc("create_organization_with_owner" as any, {
    org_name: parsed.data.orgName,
    org_slug: slug,
  } as any);
  if (orgErr || !org) redirectSignupError(orgErr?.message ?? "Failed to create workspace.");

  await setCurrentOrgIdCookie(String((org as any).id));
  redirect("/admin/onboarding/growth");
}


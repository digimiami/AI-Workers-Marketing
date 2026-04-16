"use server";

import { redirect } from "next/navigation";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  redirectTo: z.string().optional(),
});

function redirectLoginError(message: string, redirectTo?: string): never {
  const q = new URLSearchParams();
  q.set("error", message);
  if (redirectTo) q.set("redirectTo", redirectTo);
  redirect(`/login?${q.toString()}`);
}

export async function signInWithPasswordAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo"),
  });

  if (!parsed.success) {
    const rt = String(formData.get("redirectTo") ?? "");
    redirectLoginError(
      "Invalid email or password format.",
      rt ? rt : undefined,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    redirectLoginError(error.message, parsed.data.redirectTo || undefined);
  }

  redirect(parsed.data.redirectTo || "/admin");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}


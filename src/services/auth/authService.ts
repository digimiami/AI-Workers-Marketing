import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "operator" | "viewer" | "client";

export async function getAuthedUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return { user: null, error };
  return { user: data.user, error: null };
}

export async function requireUser(redirectTo = "/login") {
  const { user } = await getAuthedUser();
  if (!user) redirect(redirectTo);
  return user;
}


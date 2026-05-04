import { createClient } from "@supabase/supabase-js";

import { env, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/** Returns a human-readable config error, or null when the service-role client can be created. */
export function getSupabaseAdminConfigError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase is not configured. Set SUPABASE_URL + SUPABASE_ANON_KEY (+ public equivalents).";
  }
  if (!env.server.SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY is required for admin operations.";
  }
  return null;
}

export function createSupabaseAdminClient() {
  const err = getSupabaseAdminConfigError();
  if (err) throw new Error(err);
  return createClient<Database>(
    env.server.SUPABASE_URL,
    env.server.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}


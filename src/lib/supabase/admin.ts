import { createClient } from "@supabase/supabase-js";

import { env, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export function createSupabaseAdminClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL + SUPABASE_ANON_KEY (+ public equivalents).");
  }
  if (!env.server.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations.");
  }
  return createClient<Database>(
    env.server.SUPABASE_URL,
    env.server.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}


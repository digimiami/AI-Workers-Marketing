import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),

  // Resend
  RESEND_API_KEY: z.string().min(10).optional(),
  // Resend allows formats like: "Team <noreply@domain.com>"
  RESEND_FROM_EMAIL: z.string().min(3).optional(),

  // OpenClaw
  OPENCLAW_BASE_URL: z.string().url().optional(),
  OPENCLAW_API_KEY: z.string().min(10).optional(),
  OPENCLAW_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),

  // Analytics
  POSTHOG_API_KEY: z.string().min(10).optional(),
  POSTHOG_HOST: z.string().url().optional(),

  // App
  APP_BASE_URL: z.string().url().optional(),

  // Cron (Vercel / external)
  CRON_SECRET: z.string().min(8).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_POSTHOG_API_KEY: z.string().min(10).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
});

function getProcessEnv() {
  // Next exposes env differently in edge/runtime; rely on process.env where available.
  // eslint-disable-next-line no-process-env
  return process.env ?? {};
}

/** Lets `npm run build` succeed without secrets; runtime still needs real values. */
const PLACEHOLDER_SUPABASE_URL = "https://placeholder.localhost";
const PLACEHOLDER_SUPABASE_ANON_KEY =
  "00000000000000000000000000000000"; // 32 chars — replace in .env

function withOptionalBuildPlaceholders(raw: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const skip =
    raw.SKIP_ENV_VALIDATION === "true" ||
    raw.SKIP_ENV_VALIDATION === "1" ||
    raw.CI === "true";

  const duringNpmBuild = raw.npm_lifecycle_event === "build";
  const supabaseMissing =
    !raw.SUPABASE_URL ||
    !raw.SUPABASE_ANON_KEY ||
    !raw.NEXT_PUBLIC_SUPABASE_URL ||
    !raw.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const usePlaceholders = skip || (duringNpmBuild && supabaseMissing);
  if (!usePlaceholders) return raw;

  return {
    ...raw,
    SUPABASE_URL: raw.SUPABASE_URL ?? PLACEHOLDER_SUPABASE_URL,
    SUPABASE_ANON_KEY: raw.SUPABASE_ANON_KEY ?? PLACEHOLDER_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL:
      raw.NEXT_PUBLIC_SUPABASE_URL ?? PLACEHOLDER_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      raw.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? PLACEHOLDER_SUPABASE_ANON_KEY,
  };
}

export const env = (() => {
  const raw = withOptionalBuildPlaceholders(getProcessEnv());
  const serverParsed = serverSchema.safeParse(raw);
  const clientParsed = clientSchema.safeParse(raw);

  if (!serverParsed.success) {
    throw new Error(
      `Invalid server environment variables:\n${serverParsed.error.message}`,
    );
  }
  if (!clientParsed.success) {
    throw new Error(
      `Invalid client environment variables:\n${clientParsed.error.message}`,
    );
  }

  return {
    server: serverParsed.data,
    client: clientParsed.data,
  } as const;
})();


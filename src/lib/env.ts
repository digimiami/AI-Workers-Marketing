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

  // Internal LLM (OpenAI-compatible)
  INTERNAL_LLM_PROVIDER: z.enum(["openai"]).optional(),
  INTERNAL_LLM_API_KEY: z.string().min(10).optional(),
  INTERNAL_LLM_MODEL: z.string().min(2).optional(),
  INTERNAL_LLM_BASE_URL: z.string().url().optional(),

  // Analytics
  POSTHOG_API_KEY: z.string().min(10).optional(),
  POSTHOG_HOST: z.string().url().optional(),

  // App
  APP_BASE_URL: z.string().url().optional(),

  // OAuth (Google) - used for connecting Analytics/Search Console via admin
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(10).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(10).optional(),

  // Cron (Vercel / external)
  CRON_SECRET: z.string().min(8).optional(),

  // Affiliate postback security (optional)
  POSTBACK_SECRET: z.string().min(8).optional(),

  // GitHub Actions (optional) - used for approval-gated automation like applying Supabase migrations
  GITHUB_ACTIONS_TOKEN: z.string().min(10).optional(),
  GITHUB_REPO_OWNER: z.string().min(1).optional(),
  GITHUB_REPO_NAME: z.string().min(1).optional(),
  GITHUB_MIGRATIONS_WORKFLOW_FILE: z.string().min(1).optional(),
  GITHUB_MIGRATIONS_REF: z.string().min(1).optional(),

  // Platform credentials (encryption)
  PLATFORM_CREDENTIALS_ENCRYPTION_KEY: z.string().min(16).optional(),

  // Zapier MCP (remote Streamable HTTP server)
  ZAPIER_MCP_SERVER_URL: z.string().url().optional(),
  ZAPIER_MCP_SECRET: z.string().min(10).optional(),

  /** When "1", workspace provisioning may seed demo lead/analytics in development only. */
  WORKSPACE_DEV_SEED: z.string().optional(),
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
  const isBrowser =
    // eslint-disable-next-line no-restricted-globals
    typeof window !== "undefined";
  const skip =
    raw.SKIP_ENV_VALIDATION === "true" ||
    raw.SKIP_ENV_VALIDATION === "1" ||
    raw.CI === "true";

  const duringNpmBuild = raw.npm_lifecycle_event === "build";
  const duringDev = raw.npm_lifecycle_event === "dev";
  const supabaseMissing =
    !raw.SUPABASE_URL ||
    !raw.SUPABASE_ANON_KEY ||
    !raw.NEXT_PUBLIC_SUPABASE_URL ||
    !raw.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // In dev, allow the app to boot without Supabase configured so routes can
  // return a clear 503 instead of crashing at import-time.
  // In the browser bundle, server-only env vars are never present; always use placeholders there.
  const usePlaceholders =
    isBrowser || skip || ((duringNpmBuild || duringDev) && supabaseMissing);
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

export function isSupabaseConfigured() {
  return (
    env.server.SUPABASE_URL !== PLACEHOLDER_SUPABASE_URL &&
    env.server.SUPABASE_ANON_KEY !== PLACEHOLDER_SUPABASE_ANON_KEY &&
    env.client.NEXT_PUBLIC_SUPABASE_URL !== PLACEHOLDER_SUPABASE_URL &&
    env.client.NEXT_PUBLIC_SUPABASE_ANON_KEY !== PLACEHOLDER_SUPABASE_ANON_KEY
  );
}


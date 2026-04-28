import { NextResponse } from "next/server";

/**
 * Public deployment metadata for debugging.
 * No secrets are returned.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    vercel: {
      env: process.env.VERCEL_ENV ?? null,
      deployment_url: process.env.VERCEL_URL ?? null,
      git: {
        commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        commit_message: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
        commit_ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      },
    },
  });
}


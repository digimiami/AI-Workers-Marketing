import { cookies } from "next/headers";

export const ORG_COOKIE = "aiw_org";

export async function getCurrentOrgIdFromCookie() {
  const c = await cookies();
  return c.get(ORG_COOKIE)?.value ?? null;
}

export async function setCurrentOrgIdCookie(orgId: string) {
  const c = await cookies();
  // Browsers ignore `secure` cookies on http://localhost, which breaks onboarding locally.
  // In production (HTTPS), keep it secure.
  const isProd =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";
  c.set(ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function clearCurrentOrgIdCookie() {
  const c = await cookies();
  const isProd =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";
  c.set(ORG_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 0,
  });
}


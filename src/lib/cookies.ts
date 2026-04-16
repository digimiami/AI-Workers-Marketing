import { cookies } from "next/headers";

export const ORG_COOKIE = "aiw_org";

export async function getCurrentOrgIdFromCookie() {
  const c = await cookies();
  return c.get(ORG_COOKIE)?.value ?? null;
}

export async function setCurrentOrgIdCookie(orgId: string) {
  const c = await cookies();
  c.set(ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}


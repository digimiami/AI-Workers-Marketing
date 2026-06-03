import { MAIN_APP_URL } from "@/lib/constants";

export const PLATFORM_TOKEN_KEY = "agents_platform_admin_token";

export function getStoredPlatformToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PLATFORM_TOKEN_KEY);
}

export function setStoredPlatformToken(token: string) {
  sessionStorage.setItem(PLATFORM_TOKEN_KEY, token);
}

export function clearStoredPlatformToken() {
  sessionStorage.removeItem(PLATFORM_TOKEN_KEY);
}

export async function platformFetch(path: string, init?: RequestInit) {
  const token = getStoredPlatformToken();
  if (!token) throw new Error("Not signed in to platform admin");

  const url = `${MAIN_APP_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
  if (!res.ok) {
    throw new Error(json.message ?? `Request failed (${res.status})`);
  }
  return { res, json };
}

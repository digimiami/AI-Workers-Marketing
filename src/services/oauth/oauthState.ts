import { createHmac } from "crypto";

import { env } from "@/lib/env";

type StatePayloadV1 = {
  v: 1;
  organizationId: string;
  userId: string;
  returnTo: string;
  nonce: string;
  createdAt: string;
};

function getSigningKey() {
  const k = env.server.PLATFORM_CREDENTIALS_ENCRYPTION_KEY ?? env.server.CRON_SECRET;
  if (!k) throw new Error("Missing signing secret (set PLATFORM_CREDENTIALS_ENCRYPTION_KEY or CRON_SECRET)");
  return k;
}

function b64url(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

export function signOAuthState(payload: Omit<StatePayloadV1, "v" | "createdAt"> & { createdAt?: string }): string {
  const full: StatePayloadV1 = {
    v: 1,
    createdAt: payload.createdAt ?? new Date().toISOString(),
    organizationId: payload.organizationId,
    userId: payload.userId,
    returnTo: payload.returnTo,
    nonce: payload.nonce,
  };
  const body = Buffer.from(JSON.stringify(full), "utf8");
  const sig = createHmac("sha256", getSigningKey()).update(body).digest();
  return `${b64url(body)}.${b64url(sig)}`;
}

export function verifyOAuthState(state: string): StatePayloadV1 | null {
  const [bodyB64, sigB64] = state.split(".", 2);
  if (!bodyB64 || !sigB64) return null;
  const body = fromB64url(bodyB64);
  const sig = fromB64url(sigB64);
  const expected = createHmac("sha256", getSigningKey()).update(body).digest();
  if (expected.length !== sig.length) return null;
  // constant-time compare
  let ok = 0;
  for (let i = 0; i < expected.length; i++) ok |= expected[i] ^ sig[i];
  if (ok !== 0) return null;
  try {
    const parsed = JSON.parse(body.toString("utf8")) as StatePayloadV1;
    if (!parsed || parsed.v !== 1) return null;
    if (typeof parsed.organizationId !== "string" || typeof parsed.userId !== "string") return null;
    if (typeof parsed.returnTo !== "string" || typeof parsed.nonce !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}


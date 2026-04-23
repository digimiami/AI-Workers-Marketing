import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { env } from "@/lib/env";

type EnvelopeV1 = {
  v: 1;
  alg: "aes-256-gcm";
  iv: string; // base64
  tag: string; // base64
  ciphertext: string; // base64
};

function getKeyBytes(): Buffer {
  const raw = env.server.PLATFORM_CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) throw new Error("PLATFORM_CREDENTIALS_ENCRYPTION_KEY not configured");
  // Derive stable 32-byte key from the provided string.
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptJson(payload: Record<string, unknown>): EnvelopeV1 {
  const key = getKeyBytes();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload ?? {}), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptJson(envelope: unknown): Record<string, unknown> {
  const e = envelope as Partial<EnvelopeV1>;
  if (!e || e.v !== 1 || e.alg !== "aes-256-gcm" || !e.iv || !e.tag || !e.ciphertext) {
    throw new Error("Invalid credentials envelope");
  }
  const key = getKeyBytes();
  const iv = Buffer.from(e.iv, "base64");
  const tag = Buffer.from(e.tag, "base64");
  const ciphertext = Buffer.from(e.ciphertext, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const obj = JSON.parse(plaintext.toString("utf8"));
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  return obj as Record<string, unknown>;
}

export function redactCredentials(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload ?? {})) {
    if (typeof v === "string" && v.length > 0) {
      out[k] = v.length <= 6 ? "******" : `${v.slice(0, 2)}***${v.slice(-2)}`;
    } else {
      out[k] = v;
    }
  }
  return out;
}


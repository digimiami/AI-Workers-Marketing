/**
 * Deep-merge plain JSON object trees for jsonb-style metadata.
 * - Nested plain objects are merged recursively.
 * - Arrays, primitives, and null replace the previous value at that key.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function mergeJsonbRecords(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = mergeJsonbRecords(existing, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function asMetadataRecord(value: unknown): Record<string, unknown> {
  if (isPlainObject(value)) return value;
  return {};
}

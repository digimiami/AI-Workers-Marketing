import { Cron } from "croner";

/**
 * Next fire time after `from` for a standard cron expression (croner supports 5- and 6-field patterns).
 * Returns null if the expression is invalid or has no future occurrence.
 */
export function computeNextRunIso(
  cronExpression: string,
  timezone: string,
  from: Date = new Date(),
): string | null {
  const pattern = cronExpression.trim();
  if (!pattern) return null;
  const tz = timezone?.trim() || "UTC";
  try {
    const cron = new Cron(pattern, { timezone: tz });
    const next = cron.nextRun(from);
    return next ? next.toISOString() : null;
  } catch {
    return null;
  }
}

export function isValidCronExpression(cronExpression: string, timezone: string): boolean {
  return computeNextRunIso(cronExpression, timezone, new Date()) !== null;
}

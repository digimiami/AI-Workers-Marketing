export type CalendarProviderKind = "internal" | "calendly" | "google_calendar";

export type CalendarBookingLinkInput = {
  organizationId: string;
  bookingUrl: string | null | undefined;
};

export type CalendarBookingLinkResult = {
  url: string;
  metadata: Record<string, unknown>;
};

export interface CalendarProvider {
  readonly kind: CalendarProviderKind;
  resolveBookingLink(input: CalendarBookingLinkInput): Promise<CalendarBookingLinkResult>;
}

class InternalCalendarProvider implements CalendarProvider {
  readonly kind = "internal" as const;
  async resolveBookingLink(input: CalendarBookingLinkInput): Promise<CalendarBookingLinkResult> {
    const url = String(input.bookingUrl ?? "").trim();
    if (!url) {
      throw new Error("internal calendar provider requires bookingUrl");
    }
    return { url, metadata: { provider: this.kind } };
  }
}

class StubExternalCalendarProvider implements CalendarProvider {
  constructor(readonly kind: Exclude<CalendarProviderKind, "internal">) {}
  async resolveBookingLink(input: CalendarBookingLinkInput): Promise<CalendarBookingLinkResult> {
    const url = String(input.bookingUrl ?? "").trim();
    if (url) {
      return { url, metadata: { provider: this.kind, mode: "configured" } };
    }
    return {
      url: `https://example.invalid/${this.kind}/configure-booking`,
      metadata: { provider: this.kind, mode: "stub_unconfigured" },
    };
  }
}

export function createCalendarProvider(kind: CalendarProviderKind): CalendarProvider {
  if (kind === "internal") return new InternalCalendarProvider();
  if (kind === "calendly") return new StubExternalCalendarProvider("calendly");
  return new StubExternalCalendarProvider("google_calendar");
}

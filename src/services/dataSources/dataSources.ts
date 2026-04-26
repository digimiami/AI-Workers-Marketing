import type { SupabaseClient } from "@supabase/supabase-js";

import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import { upsertSetting } from "@/services/settings/settingsService";

export type DataSourceKey =
  | "website"
  | "crm_leads"
  | "email"
  | "google_analytics"
  | "google_search_console"
  | "documents"
  | "affiliate_links"
  | "client_notes"
  | "social_platforms";

export type DataSourceStatus = "connected" | "pending" | "disconnected" | "stubbed";

export type DataSourceRow = {
  key: DataSourceKey;
  label: string;
  status: DataSourceStatus;
  details?: Record<string, unknown>;
  updated_at?: string;
};

export const DEFAULT_DATA_SOURCES: Array<Pick<DataSourceRow, "key" | "label" | "status">> = [
  { key: "website", label: "Website", status: "pending" },
  { key: "crm_leads", label: "CRM / leads", status: "stubbed" },
  { key: "email", label: "Email", status: "stubbed" },
  { key: "google_analytics", label: "Google Analytics", status: "stubbed" },
  { key: "google_search_console", label: "Google Search Console", status: "stubbed" },
  { key: "documents", label: "Documents", status: "stubbed" },
  { key: "affiliate_links", label: "Affiliate links", status: "pending" },
  { key: "client_notes", label: "Client notes", status: "stubbed" },
  { key: "social_platforms", label: "Social platforms", status: "stubbed" },
];

export const DATA_SOURCES_SETTING_KEY = "data_sources";

export async function getDataSources(db: SupabaseClient, organizationId: string): Promise<DataSourceRow[]> {
  const { data, error } = await db
    .from("settings" as never)
    .select("value,updated_at")
    .eq("organization_id", organizationId)
    .eq("key", DATA_SOURCES_SETTING_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const raw = asMetadataRecord((data as any)?.value);
  const sources = Array.isArray(raw.sources) ? (raw.sources as unknown[]) : [];
  const byKey = new Map<string, DataSourceRow>();
  for (const s of sources) {
    if (!s || typeof s !== "object") continue;
    const row = s as any;
    if (typeof row.key !== "string" || typeof row.status !== "string" || typeof row.label !== "string") continue;
    byKey.set(row.key, {
      key: row.key,
      status: row.status,
      label: row.label,
      details: asMetadataRecord(row.details),
      updated_at: (data as any)?.updated_at,
    });
  }

  // Ensure defaults are present and stable ordering.
  const merged: DataSourceRow[] = DEFAULT_DATA_SOURCES.map((d) => byKey.get(d.key) ?? { ...d });
  return merged;
}

export async function upsertDataSources(
  db: SupabaseClient,
  organizationId: string,
  patch: { sources: DataSourceRow[] },
) {
  // Preserve unknown future fields under the setting via merge.
  const { data: existing, error } = await db
    .from("settings" as never)
    .select("value")
    .eq("organization_id", organizationId)
    .eq("key", DATA_SOURCES_SETTING_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const prev = asMetadataRecord((existing as any)?.value);
  const next = mergeJsonbRecords(prev, { sources: patch.sources as unknown as Record<string, unknown> } as any);
  return upsertSetting(db as any, organizationId, DATA_SOURCES_SETTING_KEY, next);
}


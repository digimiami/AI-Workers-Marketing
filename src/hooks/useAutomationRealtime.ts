"use client";

import * as React from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Lightweight Supabase Realtime bridge for automation dashboards.
 * Calls `onChange` whenever jobs, metrics, content posts, or campaign metadata change in the org.
 */
export function useAutomationRealtime(organizationId: string | null, onChange: () => void) {
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    if (!organizationId) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`automation:${organizationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `organization_id=eq.${organizationId}` },
        () => onChangeRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "metrics", filter: `organization_id=eq.${organizationId}` },
        () => onChangeRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "content_posts", filter: `organization_id=eq.${organizationId}` },
        () => onChangeRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaigns", filter: `organization_id=eq.${organizationId}` },
        () => onChangeRef.current(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId]);
}


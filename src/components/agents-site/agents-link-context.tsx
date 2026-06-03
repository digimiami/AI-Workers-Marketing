"use client";

import * as React from "react";

import { AGENTS_MARKETING_PREFIX } from "@/lib/agents-site/constants";

const AgentsLinkContext = React.createContext<string>(AGENTS_MARKETING_PREFIX);

export function AgentsLinkProvider({
  linkPrefix,
  children,
}: {
  linkPrefix: string;
  children: React.ReactNode;
}) {
  return (
    <AgentsLinkContext.Provider value={linkPrefix}>{children}</AgentsLinkContext.Provider>
  );
}

export function useAgentsHref() {
  const prefix = React.useContext(AgentsLinkContext);
  return React.useCallback(
    (path: string) => {
      const normalized = path.startsWith("/") ? path : `/${path}`;
      if (!prefix) return normalized;
      if (normalized === "/") return prefix;
      return `${prefix}${normalized}`;
    },
    [prefix],
  );
}

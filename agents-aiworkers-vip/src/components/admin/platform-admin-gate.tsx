"use client";

import * as React from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGENTS_SITE_NAME, MAIN_APP_URL } from "@/lib/constants";
import {
  clearStoredPlatformToken,
  getStoredPlatformToken,
  platformFetch,
  setStoredPlatformToken,
} from "@/lib/platform-api";

export function PlatformAdminGate({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    const stored = getStoredPlatformToken();
    if (!stored) {
      setChecking(false);
      return;
    }
    setStoredPlatformToken(stored);
    void platformFetch("/api/agents-platform/catalog")
      .then(() => setToken(stored))
      .catch(() => {
        clearStoredPlatformToken();
        setToken(null);
      })
      .finally(() => setChecking(false));
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = draft.trim();
    if (value.length < 16) {
      setError("Enter the platform admin secret from server env.");
      return;
    }
    setStoredPlatformToken(value);
    try {
      await platformFetch("/api/agents-platform/catalog");
      setToken(value);
      setDraft("");
    } catch (err) {
      clearStoredPlatformToken();
      setToken(null);
      setError(err instanceof Error ? err.message : "Sign-in failed");
    }
  }

  function signOut() {
    clearStoredPlatformToken();
    setToken(null);
  }

  if (checking) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!token) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Platform admin</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sign in to train agent skills and manage the catalog for {AGENTS_SITE_NAME}. Customer workspaces
              stay on{" "}
              <a href={MAIN_APP_URL} className="underline">
                aiworkers.vip
              </a>
              .
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void signIn(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platform-secret">Admin secret</Label>
                <Input
                  id="platform-secret"
                  type="password"
                  autoComplete="off"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="AGENTS_PLATFORM_ADMIN_SECRET"
                  required
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              <Link href="/" className="underline">
                Back to marketing site
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Platform</p>
          <p className="font-display text-lg font-bold">{AGENTS_SITE_NAME} Admin</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>
      {children}
    </div>
  );
}

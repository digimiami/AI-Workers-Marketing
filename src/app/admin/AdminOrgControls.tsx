"use client";

import * as React from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OrgRow = { id: string; name: string; slug: string; role: string };

export function AdminOrgControls({ currentOrgId }: { currentOrgId: string }) {
  const [orgs, setOrgs] = React.useState<OrgRow[]>([]);
  const [loadingOrgs, setLoadingOrgs] = React.useState(false);
  const [selectedOrgId, setSelectedOrgId] = React.useState(currentOrgId);

  const [createName, setCreateName] = React.useState("");
  const [createSlug, setCreateSlug] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<"operator" | "viewer" | "client">("viewer");
  const [inviting, setInviting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoadingOrgs(true);
    fetch("/api/admin/organizations")
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return (await r.json()) as { ok: boolean; organizations: OrgRow[] };
      })
      .then((data) => {
        if (cancelled) return;
        setOrgs(data.organizations ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : "Failed to load organizations");
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingOrgs(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const switchOrg = async () => {
    if (!selectedOrgId || selectedOrgId === currentOrgId) return;
    const res = await fetch("/api/admin/organizations/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: selectedOrgId }),
    });
    if (!res.ok) throw new Error(await res.text());
    // Refresh the whole admin app so server components re-read the cookie.
    window.location.href = "/admin";
  };

  const inviteUser = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviting(true);
    try {
      const res = await fetch("/api/admin/organizations/members/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: currentOrgId,
          email,
          role: inviteRole,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Invite sent / member added");
      setInviteEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  const createOrg = async () => {
    const name = createName.trim();
    const slug = createSlug.trim().toLowerCase();
    if (!name || !slug) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/organizations/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Organization created");
      // Cookie is set server-side; reload into the new org.
      window.location.href = "/admin";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create org failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-background/40 p-3 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="orgSwitch" className="text-xs text-muted-foreground">
          Organization
        </Label>
        <div className="flex items-center gap-2">
          <select
            id="orgSwitch"
            aria-label="Switch organization"
            title="Switch organization"
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm"
            value={selectedOrgId}
            disabled={loadingOrgs}
            onChange={(e) => setSelectedOrgId(e.target.value)}
          >
            {orgs.length ? (
              orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.slug}) — {o.role}
                </option>
              ))
            ) : (
              <option value={currentOrgId}>Current org</option>
            )}
          </select>
          <Button size="sm" variant="outline" onClick={() => void switchOrg()} disabled={loadingOrgs || selectedOrgId === currentOrgId}>
            Switch
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Create organization</Label>
        <div className="space-y-2">
          <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Org name" />
          <Input value={createSlug} onChange={(e) => setCreateSlug(e.target.value)} placeholder="org-slug" />
          <Button size="sm" onClick={() => void createOrg()} disabled={creating || !createName.trim() || !createSlug.trim()}>
            Create
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Slug must be lowercase letters, numbers, and dashes.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inviteEmail" className="text-xs text-muted-foreground">
          Add user (invite)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="inviteEmail"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="user@company.com"
          />
          <select
            aria-label="Invite role"
            title="Invite role"
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as any)}
          >
            <option value="viewer">Viewer</option>
            <option value="operator">Operator</option>
            <option value="client">Client</option>
          </select>
          <Button size="sm" onClick={() => void inviteUser()} disabled={inviting || !inviteEmail.trim()}>
            Invite
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Operators/admins can invite users. The member is added to <code className="font-mono">organization_members</code>.
        </p>
      </div>
    </div>
  );
}


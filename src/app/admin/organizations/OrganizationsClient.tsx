"use client";

import * as React from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OrgRow = { id: string; name: string; slug: string; role: string };

export function OrganizationsClient({ currentOrgId }: { currentOrgId: string }) {
  const [orgs, setOrgs] = React.useState<OrgRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedOrgId, setSelectedOrgId] = React.useState(currentOrgId);

  const [createName, setCreateName] = React.useState("");
  const [createSlug, setCreateSlug] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<"operator" | "viewer" | "client">("viewer");
  const [inviting, setInviting] = React.useState(false);

  const reloadOrgs = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/organizations");
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; organizations: OrgRow[] };
      setOrgs(j.organizations ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reloadOrgs();
  }, [reloadOrgs]);

  const switchOrg = async () => {
    if (!selectedOrgId || selectedOrgId === currentOrgId) return;
    const res = await fetch("/api/admin/organizations/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: selectedOrgId }),
    });
    if (!res.ok) throw new Error(await res.text());
    window.location.href = "/admin";
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
      window.location.href = "/admin";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create org failed");
    } finally {
      setCreating(false);
    }
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
      await reloadOrgs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Switch organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="orgPick">Organization</Label>
            <select
              id="orgPick"
              aria-label="Organization"
              title="Organization"
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm"
              value={selectedOrgId}
              disabled={loading}
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              {(orgs.length ? orgs : [{ id: currentOrgId, name: "Current org", slug: "", role: "" }]).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.slug ? `(${o.slug})` : ""} {o.role ? `— ${o.role}` : ""}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" variant="outline" onClick={() => void switchOrg()} disabled={loading || selectedOrgId === currentOrgId}>
            Switch
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="orgName">Name</Label>
            <Input id="orgName" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="AiWorkers" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="orgSlug">Slug</Label>
            <Input id="orgSlug" value={createSlug} onChange={(e) => setCreateSlug(e.target.value)} placeholder="aiworkers" />
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and dashes.</p>
          </div>
          <Button type="button" onClick={() => void createOrg()} disabled={creating || !createName.trim() || !createSlug.trim()}>
            Create & switch
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Invite user to current organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_200px_auto]">
            <div className="space-y-1">
              <Label htmlFor="inviteEmail">Email</Label>
              <Input id="inviteEmail" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@company.com" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inviteRole">Role</Label>
              <select
                id="inviteRole"
                aria-label="Invite role"
                title="Invite role"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
              >
                <option value="viewer">Viewer</option>
                <option value="operator">Operator</option>
                <option value="client">Client</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={() => void inviteUser()} disabled={inviting || !inviteEmail.trim()}>
                Invite
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Uses Supabase admin invite + upserts <code className="font-mono text-[11px]">organization_members</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


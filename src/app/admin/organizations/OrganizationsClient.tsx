"use client";

import * as React from "react";

import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type OrgRow = { id: string; name: string; slug: string; role: string };

export function OrganizationsClient({ currentOrgId }: { currentOrgId: string }) {
  const [orgs, setOrgs] = React.useState<OrgRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedOrgId, setSelectedOrgId] = React.useState(currentOrgId);
  const [drafts, setDrafts] = React.useState<Record<string, { name: string; slug: string }>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [openingId, setOpeningId] = React.useState<string | null>(null);

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
      const list = j.organizations ?? [];
      setOrgs(list);
      const next: Record<string, { name: string; slug: string }> = {};
      for (const o of list) next[o.id] = { name: o.name, slug: o.slug };
      setDrafts(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reloadOrgs();
  }, [reloadOrgs]);

  const switchOrg = async (orgId: string) => {
    if (!orgId || orgId === currentOrgId) return;
    const res = await fetch("/api/admin/organizations/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: orgId }),
    });
    if (!res.ok) throw new Error(await res.text());
    window.location.href = "/admin";
  };

  const openOrg = async (orgId: string) => {
    setOpeningId(orgId);
    try {
      await switchOrg(orgId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Open failed");
    } finally {
      setOpeningId(null);
    }
  };

  const saveOrg = async (orgId: string) => {
    const d = drafts[orgId];
    if (!d) return;
    const name = d.name.trim();
    const slug = d.slug.trim().toLowerCase();
    if (!name || !slug) {
      toast.error("Name and slug are required");
      return;
    }
    setSavingId(orgId);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      const raw = await res.text();
      let message = raw;
      try {
        const j = JSON.parse(raw) as { message?: string };
        if (typeof j.message === "string") message = j.message;
      } catch {
        /* keep */
      }
      if (!res.ok) throw new Error(message);
      toast.success("Organization saved");
      await reloadOrgs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const deleteOrg = async (orgId: string) => {
    const row = orgs.find((o) => o.id === orgId);
    const ok = window.confirm(
      `Delete workspace "${row?.name ?? orgId}"? This permanently removes its campaigns, funnels, and other org data for all members.`,
    );
    if (!ok) return;
    setDeletingId(orgId);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, { method: "DELETE" });
      const raw = await res.text();
      let message = raw;
      try {
        const j = JSON.parse(raw) as { message?: string };
        if (typeof j.message === "string") message = j.message;
      } catch {
        /* keep */
      }
      if (!res.ok) throw new Error(message);
      toast.success("Organization deleted");
      window.location.href = "/admin";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const isDirty = (orgId: string) => {
    const o = orgs.find((x) => x.id === orgId);
    const d = drafts[orgId];
    if (!o || !d) return false;
    return d.name.trim() !== o.name || d.slug.trim().toLowerCase() !== o.slug;
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
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Workspaces</CardTitle>
          <p className="text-xs text-muted-foreground">
            <strong>Open</strong> switches into that workspace. <strong>Save</strong> updates name/slug.{" "}
            <strong>Delete</strong> is admin-only and removes the entire workspace.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="w-[100px]">Role</TableHead>
                  <TableHead className="text-right w-[260px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(orgs.length ? orgs : [{ id: currentOrgId, name: "Current org", slug: "", role: "" }]).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Input
                        value={drafts[o.id]?.name ?? o.name}
                        disabled={loading}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [o.id]: { name: e.target.value, slug: prev[o.id]?.slug ?? o.slug },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={drafts[o.id]?.slug ?? o.slug}
                        disabled={loading}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [o.id]: { name: prev[o.id]?.name ?? o.name, slug: e.target.value },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.role || "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={loading || openingId === o.id || o.id === currentOrgId}
                        onClick={() => void openOrg(o.id)}
                      >
                        {openingId === o.id ? "Opening…" : "Open"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loading || savingId === o.id || !isDirty(o.id)}
                        onClick={() => void saveOrg(o.id)}
                      >
                        {savingId === o.id ? "Saving…" : "Save"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={loading || deletingId === o.id || o.role !== "admin"}
                        title={o.role !== "admin" ? "Only admins can delete a workspace" : undefined}
                        onClick={() => void deleteOrg(o.id)}
                      >
                        {deletingId === o.id ? "Deleting…" : "Delete"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Slugs must stay unique across the platform.{" "}
            <Link href="/admin" className="underline underline-offset-2">
              Back to admin home
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick switch</CardTitle>
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
          <Button type="button" variant="outline" onClick={() => void switchOrg(selectedOrgId)} disabled={loading || selectedOrgId === currentOrgId}>
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
                onChange={(e) => setInviteRole(e.target.value as "operator" | "viewer" | "client")}
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

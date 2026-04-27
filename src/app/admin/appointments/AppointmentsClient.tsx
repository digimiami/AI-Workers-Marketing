"use client";

import * as React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type LeadEmbed = { email: string | null; full_name: string | null } | null;
type CampaignEmbed = { name: string | null } | null;

type AppointmentRow = {
  id: string;
  status: string;
  provider: string;
  booking_url: string | null;
  scheduled_at: string | null;
  lead_id: string | null;
  campaign_id: string | null;
  created_at: string;
  leads?: LeadEmbed;
  campaigns?: CampaignEmbed;
};

type LeadOption = {
  id: string;
  email: string | null;
  full_name: string | null;
};

export function AppointmentsClient({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [bookingUrl, setBookingUrl] = React.useState("");
  const [leadFilter, setLeadFilter] = React.useState("");
  const [selectedLeadId, setSelectedLeadId] = React.useState("");
  const [selectedCampaignId, setSelectedCampaignId] = React.useState("");
  const [provider, setProvider] = React.useState<"internal" | "calendly" | "google_calendar">("internal");

  const listQuery = useQuery({
    queryKey: ["appointments", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/appointments?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; appointments: AppointmentRow[] };
    },
  });

  const leadsQuery = useQuery({
    queryKey: ["leads", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/leads?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; leads: LeadOption[] };
    },
  });

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/campaigns?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; campaigns: { id: string; name: string }[] };
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          provider,
          bookingUrl: bookingUrl.trim() || undefined,
          leadId: selectedLeadId || undefined,
          campaignId: selectedCampaignId || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Appointment created");
      setBookingUrl("");
      await qc.invalidateQueries({ queryKey: ["appointments", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload: { appointmentId: string; leadId: string; bodyMarkdown: string; subject: string }) => {
      const res = await fetch("/api/admin/appointments/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          appointmentId: payload.appointmentId,
          leadId: payload.leadId,
          subject: payload.subject,
          bodyMarkdown: payload.bodyMarkdown,
          approvalMode: "enforced",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Invite queued (approval-gated)");
      await qc.invalidateQueries({ queryKey: ["appointments", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Invite failed"),
  });

  const leads = leadsQuery.data?.leads ?? [];
  const filteredLeads = React.useMemo(() => {
    const q = leadFilter.trim().toLowerCase();
    if (!q) return leads.slice(0, 80);
    return leads
      .filter((l) => {
        const em = (l.email ?? "").toLowerCase();
        const nm = (l.full_name ?? "").toLowerCase();
        return em.includes(q) || nm.includes(q);
      })
      .slice(0, 80);
  }, [leads, leadFilter]);

  const queueRowInvite = (a: AppointmentRow) => {
    const leadId = a.lead_id;
    const email = a.leads?.email?.trim();
    if (!leadId || !email) {
      toast.error("This appointment needs a linked lead with an email.");
      return;
    }
    const link = (a.booking_url ?? "").trim() || "https://your-booking-link";
    const name = a.leads?.full_name?.trim() || "there";
    inviteMutation.mutate({
      appointmentId: a.id,
      leadId,
      subject: "Book a time with us",
      bodyMarkdown: `Hi ${name} — please pick a time here:\n\n${link}\n\nThanks!`,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create appointment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="provider">Calendar provider</Label>
              <select
                id="provider"
                aria-label="Calendar provider"
                title="Calendar provider"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm"
                value={provider}
                onChange={(e) => setProvider(e.target.value as typeof provider)}
              >
                <option value="internal">Internal (URL)</option>
                <option value="calendly">Calendly (stub)</option>
                <option value="google_calendar">Google Calendar (stub)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="campaign">Campaign (optional)</Label>
              <select
                id="campaign"
                aria-label="Campaign"
                title="Campaign"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm"
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
              >
                <option value="">— None —</option>
                {(campaignsQuery.data?.campaigns ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="leadFilter">Lead (optional)</Label>
            <Input
              id="leadFilter"
              value={leadFilter}
              onChange={(e) => setLeadFilter(e.target.value)}
              placeholder="Filter by email or name…"
            />
            <select
              aria-label="Lead for appointment"
              title="Lead for appointment"
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm"
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
            >
              <option value="">— No lead —</option>
              {filteredLeads.map((l) => (
                <option key={l.id} value={l.id}>
                  {(l.email ?? "no email") + (l.full_name ? ` — ${l.full_name}` : "")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="bookingUrl">Booking URL (Calendly / internal)</Label>
            <Input id="bookingUrl" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} placeholder="https://..." />
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            Create
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(listQuery.data?.appointments ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.status}</TableCell>
                  <TableCell className="font-mono text-xs">{a.provider}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">
                    {a.leads?.email ?? a.lead_id ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-xs">{a.campaigns?.name ?? "—"}</TableCell>
                  <TableCell className="max-w-[280px] truncate font-mono text-xs">{a.booking_url ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={inviteMutation.isPending || !a.lead_id || !a.leads?.email}
                      onClick={() => queueRowInvite(a)}
                    >
                      Queue invite
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {listQuery.isError ? <p className="mt-3 text-sm text-destructive">Failed to load appointments.</p> : null}
          <p className="mt-3 text-xs text-muted-foreground">
            Queue invite creates an <code className="font-mono text-[10px]">email_logs</code> row + approval on{" "}
            <code className="font-mono text-[10px]">email_log</code>. Approve in <strong>Approval Queue</strong> to send.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

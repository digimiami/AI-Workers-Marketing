"use client";

import * as React from "react";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const CampaignType = z.enum(["affiliate", "lead_gen", "internal_test", "client"]);
const CampaignStatus = z.enum(["draft", "active", "paused", "completed"]);

type CampaignRow = {
  id: string;
  organization_id: string;
  name: string;
  type: z.infer<typeof CampaignType>;
  status: z.infer<typeof CampaignStatus>;
  target_audience: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type AdTemplate = {
  ad_name: string;
  platform: string;
  type: string;
  hooks: string;
  cta: string;
  target_audience: string;
};

type EmailStep = { day: number; subject: string; template: string };

type LeadCapture = {
  form_fields: string[];
  incentive: string;
  autoresponder: string;
};

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function readCampaignSections(metadata: Record<string, unknown>) {
  const ads = asArray<Record<string, unknown>>(metadata.ad_templates).map(
    (a): AdTemplate => ({
      ad_name: asString(a.ad_name),
      platform: asString(a.platform),
      type: asString(a.type),
      hooks: asString(a.hooks),
      cta: asString(a.cta),
      target_audience: asString(a.target_audience),
    }),
  );

  const contentHooksScripts = metadata.content_hooks_scripts as
    | { hooks?: unknown; scripts?: unknown }
    | undefined;

  const email = asArray<Record<string, unknown>>(metadata.email_sequence).map(
    (e): EmailStep => ({
      day: asNumber(e.day),
      subject: asString(e.subject),
      template: asString(e.template),
    }),
  );

  const lead = (metadata.lead_capture_settings as Record<string, unknown> | undefined) ?? {};
  const leadCapture: LeadCapture = {
    form_fields: asArray<string>(lead.form_fields).filter((s) => typeof s === "string"),
    incentive: asString(lead.incentive),
    autoresponder: asString(lead.autoresponder),
  };

  return {
    adTemplates: ads,
    contentHooks: asArray<string>(contentHooksScripts?.hooks).filter((s) => typeof s === "string"),
    contentScripts: asArray<string>(contentHooksScripts?.scripts).filter((s) => typeof s === "string"),
    emailSequence: email,
    leadCapture,
  };
}

export function CampaignDetailClient(props: { organizationId: string; campaignId: string }) {
  const qc = useQueryClient();

  const campaignQuery = useQuery({
    queryKey: ["campaign", props.organizationId, props.campaignId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/campaigns/${props.campaignId}?organizationId=${props.organizationId}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; campaign: CampaignRow };
      return j.campaign;
    },
  });

  const [draftName, setDraftName] = React.useState("");
  const [draftAudience, setDraftAudience] = React.useState("");
  const [draftDesc, setDraftDesc] = React.useState("");

  const [adTemplates, setAdTemplates] = React.useState<AdTemplate[]>([]);
  const [hooksText, setHooksText] = React.useState("");
  const [scriptsText, setScriptsText] = React.useState("");
  const [emailSequence, setEmailSequence] = React.useState<EmailStep[]>([]);
  const [leadCapture, setLeadCapture] = React.useState<LeadCapture>({
    form_fields: ["email", "full_name"],
    incentive: "",
    autoresponder: "",
  });

  React.useEffect(() => {
    const c = campaignQuery.data;
    if (!c) return;
    setDraftName(c.name);
    setDraftAudience(c.target_audience ?? "");
    setDraftDesc(c.description ?? "");
    const sections = readCampaignSections(c.metadata ?? {});
    setAdTemplates(sections.adTemplates);
    setHooksText(sections.contentHooks.join("\n"));
    setScriptsText(sections.contentScripts.join("\n\n---\n\n"));
    setEmailSequence(sections.emailSequence);
    setLeadCapture(sections.leadCapture);
  }, [campaignQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const c = campaignQuery.data;
      if (!c) throw new Error("Campaign not loaded");

      const metadataPatch = {
        ad_templates: adTemplates,
        content_hooks_scripts: {
          hooks: hooksText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          scripts: scriptsText
            .split("\n\n---\n\n")
            .map((s) => s.trim())
            .filter(Boolean),
        },
        email_sequence: emailSequence,
        lead_capture_settings: leadCapture,
      };

      const res = await fetch(`/api/admin/campaigns/${c.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: props.organizationId,
          name: draftName,
          targetAudience: draftAudience || null,
          description: draftDesc || null,
          metadata: metadataPatch,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Campaign saved");
      await qc.invalidateQueries({ queryKey: ["campaign", props.organizationId, props.campaignId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const c = campaignQuery.data;
  if (campaignQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading campaign…</p>;
  if (!c) return <p className="text-sm text-muted-foreground">Campaign not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Campaign</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono text-xs">{c.id}</span>
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              className="text-primary underline"
              href={`/admin/campaigns/${c.id}/automation`}
            >
              Automation
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link className="text-primary underline" href="/admin/content">
              Content
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link className="text-primary underline" href="/admin/email">
              Email
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link className="text-primary underline" href="/admin/leads">
              Leads
            </Link>
          </div>
        </div>
        <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          Save
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basics</CardTitle>
          <CardDescription>Name, audience, and description.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audience">Target audience</Label>
            <Input
              id="audience"
              value={draftAudience}
              onChange={(e) => setDraftAudience(e.target.value)}
              placeholder="Busy founders, agency owners, etc."
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              rows={4}
              placeholder="What this campaign is for..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Facebook Ad templates</CardTitle>
          <CardDescription>Stored in campaign metadata: ad_name, platform, type, hooks, CTA, target audience.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {adTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ad templates yet.</p>
          ) : null}
          <div className="space-y-3">
            {adTemplates.map((a, idx) => (
              <div key={idx} className="rounded-lg border border-border/60 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Ad #{idx + 1}</div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAdTemplates((rows) => rows.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Ad name</Label>
                    <Input
                      value={a.ad_name}
                      onChange={(e) =>
                        setAdTemplates((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, ad_name: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Platform</Label>
                    <Input
                      value={a.platform}
                      onChange={(e) =>
                        setAdTemplates((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, platform: e.target.value } : r)),
                        )
                      }
                      placeholder="facebook"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Input
                      value={a.type}
                      onChange={(e) =>
                        setAdTemplates((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, type: e.target.value } : r)),
                        )
                      }
                      placeholder="image / video / carousel"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>CTA</Label>
                    <Input
                      value={a.cta}
                      onChange={(e) =>
                        setAdTemplates((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, cta: e.target.value } : r)),
                        )
                      }
                      placeholder="Get the guide"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Target audience</Label>
                    <Input
                      value={a.target_audience}
                      onChange={(e) =>
                        setAdTemplates((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, target_audience: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Hooks</Label>
                    <Textarea
                      value={a.hooks}
                      onChange={(e) =>
                        setAdTemplates((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, hooks: e.target.value } : r)),
                        )
                      }
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setAdTemplates((rows) => [
                ...rows,
                { ad_name: "", platform: "facebook", type: "image", hooks: "", cta: "", target_audience: draftAudience },
              ])
            }
          >
            Add ad template
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content hooks & scripts</CardTitle>
          <CardDescription>Previously stored only in metadata. Now editable here.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Hooks (one per line)</Label>
            <Textarea value={hooksText} onChange={(e) => setHooksText(e.target.value)} rows={10} />
          </div>
          <div className="space-y-2">
            <Label>Scripts (separate with blank line + ---)</Label>
            <Textarea
              value={scriptsText}
              onChange={(e) => setScriptsText(e.target.value)}
              rows={10}
              placeholder={"Script 1...\n\n---\n\nScript 2..."}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email sequence</CardTitle>
          <CardDescription>Day, subject, template label (stored in campaign metadata).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {emailSequence.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sequence defined yet.</p>
          ) : null}
          <div className="space-y-2">
            {emailSequence.map((s, idx) => (
              <div key={idx} className="grid gap-2 rounded-lg border border-border/60 p-3 md:grid-cols-12">
                <div className="md:col-span-2 space-y-1">
                  <Label>Day</Label>
                  <Input
                    value={String(s.day)}
                    onChange={(e) =>
                      setEmailSequence((rows) =>
                        rows.map((r, i) =>
                          i === idx ? { ...r, day: Number(e.target.value || "0") } : r,
                        ),
                      )
                    }
                  />
                </div>
                <div className="md:col-span-5 space-y-1">
                  <Label>Subject</Label>
                  <Input
                    value={s.subject}
                    onChange={(e) =>
                      setEmailSequence((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, subject: e.target.value } : r)),
                      )
                    }
                  />
                </div>
                <div className="md:col-span-4 space-y-1">
                  <Label>Template</Label>
                  <Input
                    value={s.template}
                    onChange={(e) =>
                      setEmailSequence((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, template: e.target.value } : r)),
                      )
                    }
                  />
                </div>
                <div className="md:col-span-1 flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEmailSequence((rows) => rows.filter((_, i) => i !== idx))}
                  >
                    X
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setEmailSequence((rows) => [...rows, { day: rows.length + 1, subject: "", template: "" }])}
          >
            Add email step
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead capture settings</CardTitle>
          <CardDescription>Form fields, incentive, autoresponder (stored in campaign metadata).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Form fields (comma-separated)</Label>
            <Input
              value={leadCapture.form_fields.join(", ")}
              onChange={(e) =>
                setLeadCapture((s) => ({
                  ...s,
                  form_fields: e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                }))
              }
              placeholder="email, full_name"
            />
          </div>
          <div className="space-y-2">
            <Label>Incentive</Label>
            <Input
              value={leadCapture.incentive}
              onChange={(e) => setLeadCapture((s) => ({ ...s, incentive: e.target.value }))}
              placeholder="Free checklist PDF"
            />
          </div>
          <div className="space-y-2">
            <Label>Autoresponder</Label>
            <Textarea
              value={leadCapture.autoresponder}
              onChange={(e) => setLeadCapture((s) => ({ ...s, autoresponder: e.target.value }))}
              rows={4}
              placeholder="Thanks for requesting... (draft)"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


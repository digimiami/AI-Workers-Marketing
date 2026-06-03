"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { platformFetch } from "@/lib/platform-api";

type CatalogRow = {
  slug: string;
  title: string;
  short_title: string;
  openclaw_agent_key: string;
  stripe_price_id: string | null;
  included_skill_keys: string[];
  status: string;
};

type SkillRow = {
  id: string;
  skill_key: string;
  name: string;
  category: string;
  description: string;
  markdown: string;
  agent_slug: string | null;
  status: string;
};

export function AgentMarketplaceAdmin() {
  const [catalog, setCatalog] = React.useState<CatalogRow[]>([]);
  const [skills, setSkills] = React.useState<SkillRow[]>([]);
  const [selectedSkill, setSelectedSkill] = React.useState<SkillRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [cat, skill] = await Promise.all([
        platformFetch("/api/agents-platform/catalog"),
        platformFetch("/api/agents-platform/skills"),
      ]);
      const catJson = cat.json as { catalog: CatalogRow[] };
      const skillJson = skill.json as { skills: SkillRow[] };
      setCatalog(catJson.catalog ?? []);
      setSkills(skillJson.skills ?? []);
      setSelectedSkill((prev) => prev ?? skillJson.skills?.[0] ?? null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function saveCatalogRow(row: CatalogRow) {
    setMessage(null);
    try {
      await platformFetch("/api/agents-platform/catalog", {
        method: "PATCH",
        body: JSON.stringify({
          slug: row.slug,
          stripe_price_id: row.stripe_price_id || null,
          status: row.status,
        }),
      });
      setMessage(`Updated ${row.short_title}`);
      void load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function saveSkill() {
    if (!selectedSkill) return;
    setMessage(null);
    try {
      await platformFetch("/api/agents-platform/skills", {
        method: "POST",
        body: JSON.stringify({
          skill_key: selectedSkill.skill_key,
          name: selectedSkill.name,
          category: selectedSkill.category,
          description: selectedSkill.description,
          markdown: selectedSkill.markdown,
          agent_slug: selectedSkill.agent_slug,
          status: selectedSkill.status,
        }),
      });
      setMessage(`Skill "${selectedSkill.name}" saved — new purchases get this training`);
      void load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading agent marketplace…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Agent catalog & skill training</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Train platform skills and map Stripe prices. When a customer buys on aiworkers.vip, the worker is
          provisioned with these skills.
        </p>
        {message ? <p className="mt-2 text-sm text-primary">{message}</p> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent catalog & Stripe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {catalog.map((row) => (
            <div
              key={row.slug}
              className="grid gap-3 rounded-lg border border-border/60 p-4 md:grid-cols-[1fr_1fr_auto]"
            >
              <div>
                <p className="font-semibold">{row.title}</p>
                <p className="text-xs text-muted-foreground">
                  {row.slug} → OpenClaw: {row.openclaw_agent_key}
                </p>
              </div>
              <div>
                <Label className="text-xs">Stripe Price ID</Label>
                <Input
                  value={row.stripe_price_id ?? ""}
                  onChange={(e) =>
                    setCatalog((prev) =>
                      prev.map((r) =>
                        r.slug === row.slug ? { ...r, stripe_price_id: e.target.value } : r,
                      ),
                    )
                  }
                  placeholder="price_..."
                />
              </div>
              <Button type="button" size="sm" onClick={() => void saveCatalogRow(row)}>
                Save
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Train skills (markdown instructions)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <div className="space-y-1">
            {skills.map((s) => (
              <button
                key={s.skill_key}
                type="button"
                onClick={() => setSelectedSkill(s)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selectedSkill?.skill_key === s.skill_key
                    ? "bg-primary/15 text-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <span className="font-medium">{s.name}</span>
                <span className="block text-xs text-muted-foreground">{s.category}</span>
              </button>
            ))}
          </div>
          {selectedSkill ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={selectedSkill.name}
                    onChange={(e) =>
                      setSelectedSkill({ ...selectedSkill, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input
                    value={selectedSkill.category}
                    onChange={(e) =>
                      setSelectedSkill({ ...selectedSkill, category: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Training instructions (markdown)</Label>
                <Textarea
                  className="min-h-[320px] font-mono text-xs"
                  value={selectedSkill.markdown}
                  onChange={(e) =>
                    setSelectedSkill({ ...selectedSkill, markdown: e.target.value })
                  }
                />
              </div>
              <Button type="button" onClick={() => void saveSkill()}>
                Save skill training
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

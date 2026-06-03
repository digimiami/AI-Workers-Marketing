"use client";

import * as React from "react";

import { Download, Search, Star } from "lucide-react";

import { ConversionCtaBanner, ConversionCtas } from "@/components/conversion-ctas";
import { Reveal } from "@/components/marketing/motion-primitives";
import { SectionHeader } from "@/components/marketing/section-header";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SKILL_CATEGORIES,
  SKILLS_CATALOG,
  type SkillItem,
} from "@/lib/skills-catalog";
import { MAIN_APP_SIGNUP } from "@/lib/constants";
import { cn } from "@/lib/utils";

function SkillCard({ skill }: { skill: SkillItem }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/60 bg-card/50 p-5 backdrop-blur-md dark:border-white/[0.08]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-bold">{skill.name}</h3>
        {skill.featured ? (
          <Badge variant="outline" className="shrink-0 border-primary/30 text-[10px]">
            Featured
          </Badge>
        ) : null}
      </div>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{skill.description}</p>
      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Star className="size-3.5 fill-primary text-primary" aria-hidden />
          {skill.rating}
        </span>
        <span>{skill.installs} installs</span>
        <span className="rounded-md bg-muted/50 px-2 py-0.5">{skill.category}</span>
      </div>
      <Link
        href={MAIN_APP_SIGNUP}
        className={buttonVariants({ size: "sm", className: "mt-4 w-full" })}
      >
        <Download className="size-4" aria-hidden />
        Install skill
      </Link>
    </div>
  );
}

export function SkillsMarketplacePageContent() {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string>("All");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return SKILLS_CATALOG.filter((s) => {
      const matchCat = category === "All" || s.category === category;
      const matchQ =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [query, category]);

  const featured = SKILLS_CATALOG.filter((s) => s.featured);
  const popular = SKILLS_CATALOG.filter((s) => s.popular);

  return (
    <>
      <section className="mkt-page pt-16 md:pt-24">
        <Reveal className="max-w-3xl space-y-4">
          <Badge className="border-primary/30 bg-primary/10">Skills Marketplace</Badge>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            <span className="text-gradient-fx">Extend every agent</span> with installable skills
          </h1>
          <p className="text-lg text-muted-foreground">
            Search a catalog of capabilities—content, ads, SEO, automation, and more—rated by operators and ready to
            deploy in one click.
          </p>
          <ConversionCtas />
        </Reveal>

        <div className="relative mt-10 max-w-xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills…"
            className="pl-10"
            aria-label="Search skills"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SKILL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                category === cat
                  ? "border-primary/40 bg-primary/15 text-foreground"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      <section className="border-t border-border/50 bg-muted/10">
        <div className="mkt-page">
          <SectionHeader eyebrow="Featured" title="Featured skills" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((s, i) => (
              <Reveal key={s.id} delay={i * 0.04}>
                <SkillCard skill={s} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/50">
        <div className="mkt-page">
          <SectionHeader eyebrow="Popular" title="Popular skills" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((s, i) => (
              <Reveal key={s.id} delay={i * 0.04}>
                <SkillCard skill={s} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/50 bg-muted/10">
        <div className="mkt-page">
          <SectionHeader
            title="Full catalog"
            description={`${filtered.length} skill${filtered.length === 1 ? "" : "s"} matching your filters`}
          />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s, i) => (
              <Reveal key={s.id} delay={Math.min(i * 0.03, 0.3)}>
                <SkillCard skill={s} />
              </Reveal>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">No skills match your search.</p>
          ) : null}
        </div>
      </section>

      <section className="border-t border-border/50">
        <div className="mkt-page pb-20">
          <ConversionCtaBanner />
        </div>
      </section>
    </>
  );
}
